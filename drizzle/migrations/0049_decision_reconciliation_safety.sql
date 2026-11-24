CREATE OR REPLACE FUNCTION public.reconcile_decisions() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.decisions; candidate jsonb; enabled boolean; candidates integer:=0; closed integer:=0; previous_flag text:=current_setting('app.decisions_reconcile',true);
BEGIN
 IF pg_trigger_depth()=0 AND auth.uid() IS NOT NULL AND NOT(public.can_use_workbench(auth.uid()) OR public.has_role(auth.uid(),'finance')) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
 IF previous_flag='on' THEN RETURN '{}'::jsonb; END IF;
 PERFORM set_config('app.decisions_reconcile','on',true);
 INSERT INTO public.decisions_control(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT auto_close_enabled INTO enabled FROM public.decisions_control WHERE singleton;
 UPDATE public.decisions SET status='open',snooze_until=NULL,updated_at=now() WHERE status='snoozed' AND snooze_until<=now();
 FOR d IN SELECT * FROM public.decisions WHERE status IN ('open','snoozed') FOR UPDATE LOOP
  candidate:=public.decision_close_candidate(d);
  IF candidate IS NULL AND d.kind='task' AND NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=d.source_id AND t.lead_id IS NOT NULL AND (t.due_date IS NOT NULL OR t.due_at IS NOT NULL)) THEN candidate:=jsonb_build_object('rule','task_ineligible','reason','A tarefa deixou de ter file e prazo; mantida para consulta'); END IF;
  IF candidate IS NOT NULL THEN candidates:=candidates+1; END IF;
  IF candidate IS NOT NULL AND enabled AND (d.reopened_at IS NULL OR d.reopened_at<now()-interval '24 hours') THEN
   UPDATE public.decisions SET status='auto_closed',closed_reason=candidate->>'reason',candidate_rule=candidate->>'rule',candidate_reason=candidate->>'reason',decided_at=now(),checked_at=now(),checked_note='TCC: datas/estado, pagamentos, Operações e thread ligada',updated_at=now() WHERE id=d.id;
   INSERT INTO public.decision_events(decision_id,action,reason) VALUES(d.id,'auto_closed',candidate->>'reason'); closed:=closed+1;
  ELSE
   UPDATE public.decisions SET candidate_rule=candidate->>'rule',candidate_reason=candidate->>'reason',checked_at=now(),checked_note=CASE WHEN kind='alert' AND coalesce(close_params->>'thread_id',prepared->>'thread_id',prepared->>'gmail_thread_id') IS NULL THEN 'TCC: datas e estado; sem thread exata, fecho por resposta não inferido' ELSE 'TCC: datas/estado, pagamentos, Operações e thread ligada' END,updated_at=now() WHERE id=d.id;
  END IF;
 END LOOP;
 UPDATE public.decisions_control SET last_reconciled_at=now() WHERE singleton;
 PERFORM set_config('app.decisions_reconcile',coalesce(previous_flag,''),true);
 PERFORM realtime.send('{}'::jsonb,'changed','cockpit-decisions',true);
 RETURN jsonb_build_object('simulation',NOT enabled,'candidates',candidates,'closed',closed);
END $$;
CREATE OR REPLACE FUNCTION public.decisions_ring() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('app.decisions_reconcile',true) IS DISTINCT FROM 'on' AND EXISTS(SELECT 1 FROM new_rows) THEN PERFORM realtime.send('{}'::jsonb,'changed','cockpit-decisions',true); END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION public.resume_decision(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.decisions;
BEGIN
 SELECT * INTO d FROM public.decisions WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR public.is_agent_user(auth.uid()) OR NOT public.can_read_decision(d.side) THEN RAISE EXCEPTION 'Sem acesso humano a esta decisão'; END IF;
 IF d.status<>'snoozed' THEN RAISE EXCEPTION 'Este cartão não está adiado'; END IF;
 UPDATE public.decisions SET status='open',snooze_until=NULL,decided_by=auth.uid(),decided_at=now(),updated_at=now() WHERE id=p_id;
 INSERT INTO public.decision_events(decision_id,action,actor_id) VALUES(p_id,'resume',auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.resume_decision(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resume_decision(uuid) TO authenticated;
CREATE TRIGGER decisions_lead_removed AFTER DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
COMMENT ON FUNCTION public.reconcile_decisions() IS 'Hourly and event-driven simulation until the first explicit human activation; index closures never change or execute sources.';