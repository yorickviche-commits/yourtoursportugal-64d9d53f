CREATE TABLE public.decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dedupe_key text NOT NULL UNIQUE,
 source_table text NOT NULL, source_id uuid NOT NULL,
 lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL, yt_ref text,
 side text NOT NULL CHECK(side IN ('sales','ops','finance','management')),
 kind text NOT NULL CHECK(kind IN ('client_email','fse_email','payment_link','finance_item','alert','task')),
 title text NOT NULL, why text NOT NULL, prepared jsonb NOT NULL DEFAULT '{}',
 checked_at timestamptz, checked_note text,
 close_rule text NOT NULL DEFAULT 'lead_inactive', close_params jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','snoozed','approved','rejected','auto_closed','executed','failed')),
 closed_reason text, snooze_until timestamptz, created_by_label text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 decided_by uuid, decided_at timestamptz, candidate_rule text, candidate_reason text,
 reopened_at timestamptz, source_status text
);
GRANT SELECT ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.can_read_decision(p_side text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_admin(auth.uid()) OR CASE p_side
 WHEN 'finance' THEN public.has_role(auth.uid(),'finance')
 WHEN 'sales' THEN public.has_role(auth.uid(),'sales_agent') OR public.has_role(auth.uid(),'operations_agent')
 WHEN 'ops' THEN public.has_role(auth.uid(),'operations_agent') OR public.has_role(auth.uid(),'sales_agent')
 ELSE false END
$$;
REVOKE ALL ON FUNCTION public.can_read_decision(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_decision(text) TO authenticated,service_role;
CREATE POLICY decisions_team_read ON public.decisions FOR SELECT TO authenticated USING(public.can_read_decision(side));
CREATE INDEX decisions_status_idx ON public.decisions(status,created_at);
CREATE INDEX decisions_lead_idx ON public.decisions(lead_id);
CREATE TABLE public.decision_sources (
 source_table text NOT NULL CHECK(source_table IN ('ai_action_queue','workbench_alerts','finance_batch_items','tasks')),
 source_id uuid NOT NULL, decision_id uuid NOT NULL REFERENCES public.decisions(id),
 PRIMARY KEY(source_table,source_id)
);
GRANT SELECT ON public.decision_sources TO authenticated;
GRANT ALL ON public.decision_sources TO service_role;
ALTER TABLE public.decision_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY decision_sources_read ON public.decision_sources FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.decisions d WHERE d.id=decision_id));
CREATE TABLE public.decisions_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), auto_close_enabled boolean NOT NULL DEFAULT false,
 activated_by uuid, activated_at timestamptz, last_reconciled_at timestamptz
);
GRANT SELECT ON public.decisions_control TO authenticated;
GRANT ALL ON public.decisions_control TO service_role;
ALTER TABLE public.decisions_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY decisions_control_read ON public.decisions_control FOR SELECT TO authenticated USING(public.can_use_workbench(auth.uid()) OR public.has_role(auth.uid(),'finance'));
CREATE TABLE public.decision_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision_id uuid NOT NULL REFERENCES public.decisions(id),
 action text NOT NULL, reason text, actor_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decision_events TO authenticated;
GRANT ALL ON public.decision_events TO service_role;
ALTER TABLE public.decision_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY decision_events_read ON public.decision_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.decisions d WHERE d.id=decision_id));
CREATE FUNCTION public.decision_safe_date(p text) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
 BEGIN IF p ~ '^\d{4}-\d{2}-\d{2}($|T| )' THEN RETURN left(p,10)::date; END IF; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN NULL; END
$$;
REVOKE ALL ON FUNCTION public.decision_safe_date(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.sync_decision_source(p_table text,p_row jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid := (p_row->>'id')::uuid; lid uuid := nullif(p_row->>'lead_id','')::uuid;
 did uuid; k text; s text; ss text; motive text; pending boolean; prep jsonb; ttl text; why_line text; l public.leads; mapped text;
BEGIN
 SELECT decision_id INTO did FROM public.decision_sources WHERE source_table=p_table AND source_id=sid;
 IF p_table='ai_action_queue' THEN
  k:=p_row->>'type'; IF k NOT IN ('client_email','fse_email','payment_link') THEN RETURN; END IF;
  ss:=p_row->>'status'; pending:=ss='pending'; prep:=coalesce(p_row->'payload','{}');
  ttl:=p_row->>'title'; why_line:=coalesce(nullif(p_row->>'subtitle',''),CASE k WHEN 'payment_link' THEN 'Link preparado, falta decisão humana' ELSE 'Email preparado, falta decisão humana' END);
  s:=CASE WHEN k='fse_email' THEN 'ops' ELSE 'sales' END;
  motive:=coalesce(prep->>'reason',prep->>'description',prep->>'subject',ttl)||'|'||coalesce(prep->>'supplier','')||'|'||coalesce(prep->>'to','')||'|'||coalesce(prep->>'amount_eur','')||'|'||coalesce((prep->'services')::text,'');
 ELSIF p_table='workbench_alerts' THEN
  k:='alert'; ss:=p_row->>'status'; pending:=ss IN ('open','snoozed'); s:=coalesce(p_row->>'side','management');
  ttl:=p_row->>'title'; why_line:=coalesce(p_row->>'reason',ttl); prep:=jsonb_build_object('next_step',p_row->>'next_step'); motive:=why_line;
 ELSIF p_table='finance_batch_items' THEN
  k:='finance_item'; s:='finance'; ss:=p_row->>'validation_status'; pending:=ss='pending';
  ttl:=CASE p_row->>'action' WHEN 'issue_proforma' THEN 'Emitir proforma' WHEN 'issue_fa' THEN 'Emitir fatura' WHEN 'issue_rc' THEN 'Emitir recibo' WHEN 'register_payment' THEN 'Registar pagamento' ELSE 'Rever exceção financeira' END;
  prep:=coalesce(p_row->'proposed_payload','{}')||jsonb_build_object('evidence_urls',p_row->'evidence_urls');
  why_line:='O Tesoureiro preparou o item; falta validação humana'; motive:=coalesce(p_row->>'payment_id',sid::text)||'|'||(p_row->>'action');
 ELSIF p_table='tasks' THEN
  k:='task'; ss:=CASE WHEN coalesce((p_row->>'completed')::boolean,false) OR p_row->>'status' IN ('done','completed','cancelled','canceled') THEN 'done' ELSE 'open' END;
  pending:=ss='open' AND lid IS NOT NULL AND (nullif(p_row->>'due_date','') IS NOT NULL OR nullif(p_row->>'due_at','') IS NOT NULL);
  s:=CASE WHEN lower(coalesce(p_row->>'team','')) IN ('ops','operations','operacoes','operações') THEN 'ops' ELSE 'sales' END;
  ttl:=p_row->>'title'; why_line:='Tarefa de uma file com prazo definido'; prep:=jsonb_build_object('description',p_row->>'description','due_date',p_row->>'due_date','due_at',p_row->>'due_at'); motive:=ttl||'|'||coalesce(p_row->>'due_date',p_row->>'due_at','');
 ELSE RETURN; END IF;
 IF did IS NULL AND NOT pending THEN RETURN; END IF;
 SELECT * INTO l FROM public.leads WHERE id=lid;
 IF did IS NULL THEN
  INSERT INTO public.decisions(dedupe_key,source_table,source_id,lead_id,yt_ref,side,kind,title,why,prepared,close_rule,close_params,created_by_label,created_at,source_status,status,snooze_until)
  VALUES(coalesce(lid::text,p_row->>'lead_code',p_row->>'yt_ref','sem-file')||':'||k||':'||md5(lower(regexp_replace(motive,'\s+',' ','g'))),p_table,sid,lid,coalesce(l.yt_id,l.lead_code,p_row->>'lead_code',p_row->>'yt_ref'),s,k,coalesce(ttl,'Decisão'),why_line,prep,
   CASE k WHEN 'payment_link' THEN 'payment_received' WHEN 'fse_email' THEN 'fse_sent' WHEN 'alert' THEN 'thread_replied' ELSE 'lead_inactive' END,
   jsonb_build_object('source_created_at',p_row->>'created_at'),coalesce(p_row->>'created_by_label',p_row->>'created_by','TCC'),coalesce((p_row->>'created_at')::timestamptz,now()),ss,CASE WHEN ss='snoozed' THEN 'snoozed' ELSE 'open' END,(p_row->>'snoozed_until')::timestamptz)
  ON CONFLICT(dedupe_key) DO UPDATE SET updated_at=public.decisions.updated_at RETURNING id INTO did;
  INSERT INTO public.decision_sources VALUES(p_table,sid,did) ON CONFLICT DO NOTHING;
 END IF;
 -- The earliest representative is authoritative; aliases remain preserved and linked.
 IF EXISTS(SELECT 1 FROM public.decisions WHERE id=did AND source_id=sid AND source_table=p_table) THEN
  mapped:=CASE ss WHEN 'pending' THEN 'open' WHEN 'open' THEN 'open' WHEN 'snoozed' THEN 'snoozed' WHEN 'handled' THEN 'executed' WHEN 'done' THEN 'executed' ELSE ss END;
  IF mapped NOT IN ('open','snoozed','approved','rejected','executed','failed') THEN mapped:='rejected'; END IF;
  UPDATE public.decisions SET prepared=prep,title=coalesce(ttl,title),why=why_line,yt_ref=coalesce(l.yt_id,l.lead_code,yt_ref),lead_id=lid,
   status=CASE WHEN status='auto_closed' THEN status WHEN status='snoozed' AND pending THEN status ELSE mapped END,
   source_status=ss,updated_at=now(),decided_by=coalesce(nullif(p_row->>'reviewed_by','')::uuid,decided_by),
   decided_at=CASE WHEN mapped NOT IN ('open','snoozed') THEN coalesce((p_row->>'reviewed_at')::timestamptz,decided_at,now()) ELSE decided_at END
  WHERE id=did;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_decision_source(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.decision_close_candidate(d public.decisions) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.leads; trip_end date; amount numeric; paid numeric; rule text; why_text text; matched boolean:=false; services jsonb; srv jsonb; op public.lead_operations; tid text; base_ball text; stamp timestamptz;
BEGIN
 SELECT * INTO l FROM public.leads WHERE id=d.lead_id;
 IF d.lead_id IS NULL AND d.yt_ref IS NOT NULL THEN RETURN jsonb_build_object('rule','lead_missing','reason','A file foi removida; registo mantido para consulta'); END IF;
 IF lower(coalesce(l.nethunt_stage,'')||' '||coalesce(l.status,'')) ~ '(archive|arquivad|lost|perdid|cancel)' THEN RETURN jsonb_build_object('rule','lead_inactive','reason','File arquivada, perdida ou cancelada no TCC'); END IF;
 trip_end:=coalesce(l.trip_finish,l.trip_start,public.decision_safe_date(l.travel_end_date),public.decision_safe_date(l.travel_dates));
 IF trip_end < (now() AT TIME ZONE 'Europe/Lisbon')::date THEN RETURN jsonb_build_object('rule','trip_past','reason','Viagem terminada em '||to_char(trip_end,'DD/MM/YYYY')); END IF;
 IF d.kind='payment_link' AND d.source_status='pending' THEN
  BEGIN amount:=coalesce(nullif(d.prepared->>'amount_eur','')::numeric,nullif(d.prepared->>'amount_cents','')::numeric/100); EXCEPTION WHEN OTHERS THEN amount:=NULL; END;
  -- Use the greater total of the two mirrors, never sum both and double-count a payment.
  SELECT greatest(coalesce((SELECT sum(CASE WHEN kind='refund' THEN -amount ELSE amount END) FROM public.lead_payments WHERE lead_id=d.lead_id AND upper(currency)=upper(coalesce(d.prepared->>'currency','EUR'))),0),coalesce((SELECT sum(CASE WHEN payment_type='refund' THEN -amount_gross ELSE amount_gross END) FROM public.payments_ledger WHERE lead_id=d.lead_id AND status IN ('paid_channel','invoiced','bank_received','receipt_issued','reconciled') AND upper(currency)=upper(coalesce(d.prepared->>'currency','EUR'))),0)) INTO paid;
  IF amount>0 AND round(paid,2)>=round(amount,2) THEN RETURN jsonb_build_object('rule','payment_received','reason','Pagamento registado de '||round(paid,2)||' € cobre o pedido de '||round(amount,2)||' €'); END IF;
 END IF;
 IF d.kind='fse_email' AND d.source_status='pending' THEN
  IF coalesce(d.prepared->>'operation_id',d.prepared->>'item_key') IS NOT NULL THEN
   matched:=EXISTS(SELECT 1 FROM public.lead_operations WHERE lead_id=d.lead_id AND (id::text=d.prepared->>'operation_id' OR item_key=d.prepared->>'item_key') AND booking_status IN ('sent','booked'));
  ELSE
   services:=d.prepared->'services';
   IF jsonb_typeof(services)='array' AND jsonb_array_length(services)>0 THEN
    matched:=true;
    FOR srv IN SELECT value FROM jsonb_array_elements(services) LOOP
     -- Exact supplier + title + day, not a supplier-only guess. All lines must already be sent/booked.
     IF NOT EXISTS(SELECT 1 FROM public.lead_operations o WHERE o.lead_id=d.lead_id AND o.supplier=srv->>'supplier' AND o.activity_title=srv->>'title' AND o.day_number::text=srv->>'day' AND o.booking_status IN ('sent','booked')) THEN matched:=false; EXIT; END IF;
    END LOOP;
   END IF;
  END IF;
  IF matched THEN RETURN jsonb_build_object('rule','fse_sent','reason','Todas as linhas correspondentes em Operações já estão enviadas ou reservadas'); END IF;
 END IF;
 IF d.kind='alert' AND lower(d.why) ~ '(sem resposta|no.response|à espera|a espera)' THEN
  tid:=coalesce(d.close_params->>'thread_id',d.prepared->>'thread_id',d.prepared->>'gmail_thread_id'); base_ball:=d.close_params->>'ball'; stamp:=nullif(d.close_params->>'thread_checked_at','')::timestamptz;
  IF tid IS NOT NULL AND base_ball IS NOT NULL AND EXISTS(SELECT 1 FROM public.workbench_threads t WHERE t.lead_id=d.lead_id AND (t.id::text=tid OR t.gmail_thread_id=tid) AND t.ball='ours' AND t.ball IS DISTINCT FROM base_ball AND t.last_message_at>stamp) THEN
   RETURN jsonb_build_object('rule','thread_replied','reason','A thread ligada recebeu resposta e a bola voltou para nós');
  END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.decision_close_candidate(public.decisions) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.reconcile_decisions() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.decisions; candidate jsonb; enabled boolean; candidates integer:=0; closed integer:=0;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT(public.can_use_workbench(auth.uid()) OR public.has_role(auth.uid(),'finance')) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
 INSERT INTO public.decisions_control(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT auto_close_enabled INTO enabled FROM public.decisions_control WHERE singleton;
 UPDATE public.decisions SET status='open',snooze_until=NULL,updated_at=now() WHERE status='snoozed' AND snooze_until<=now();
 FOR d IN SELECT * FROM public.decisions WHERE status IN ('open','snoozed') FOR UPDATE LOOP
  candidate:=public.decision_close_candidate(d);
  IF candidate IS NOT NULL THEN candidates:=candidates+1; END IF;
  IF candidate IS NOT NULL AND enabled AND (d.reopened_at IS NULL OR d.reopened_at<now()-interval '24 hours') THEN
   UPDATE public.decisions SET status='auto_closed',closed_reason=candidate->>'reason',candidate_rule=candidate->>'rule',candidate_reason=candidate->>'reason',decided_at=now(),checked_at=now(),checked_note='TCC: datas/estado, pagamentos, Operações e thread ligada',updated_at=now() WHERE id=d.id;
   INSERT INTO public.decision_events(decision_id,action,reason) VALUES(d.id,'auto_closed',candidate->>'reason'); closed:=closed+1;
  ELSE
   UPDATE public.decisions SET candidate_rule=candidate->>'rule',candidate_reason=candidate->>'reason',checked_at=now(),checked_note=CASE WHEN kind='alert' AND coalesce(close_params->>'thread_id',prepared->>'thread_id',prepared->>'gmail_thread_id') IS NULL THEN 'TCC: datas e estado; sem thread exata, fecho por resposta não inferido' ELSE 'TCC: datas/estado, pagamentos, Operações e thread ligada' END,updated_at=now() WHERE id=d.id;
  END IF;
 END LOOP;
 UPDATE public.decisions_control SET last_reconciled_at=now() WHERE singleton;
 RETURN jsonb_build_object('simulation',NOT enabled,'candidates',candidates,'closed',closed);
END $$;
REVOKE ALL ON FUNCTION public.reconcile_decisions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_decisions() TO authenticated,service_role;
CREATE FUNCTION public.decisions_event_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payload jsonb:=to_jsonb(NEW); alias public.decision_sources; did uuid;
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME IN ('ai_action_queue','workbench_alerts','finance_batch_items','tasks') THEN
  PERFORM public.sync_decision_source(TG_TABLE_NAME,payload);
  -- Mirror only terminal AI execution results to deduplicated, already-approved aliases; no external execution here.
  IF TG_TABLE_NAME='ai_action_queue' AND payload->>'status' IN ('executed','failed') THEN
   SELECT decision_id INTO did FROM public.decision_sources WHERE source_table=TG_TABLE_NAME AND source_id=(payload->>'id')::uuid;
   UPDATE public.ai_action_queue q SET status=payload->>'status',result=payload->'result',error=payload->>'error',executed_at=(payload->>'executed_at')::timestamptz WHERE q.status='approved' AND q.id<>(payload->>'id')::uuid AND EXISTS(SELECT 1 FROM public.decision_sources s WHERE s.decision_id=did AND s.source_table='ai_action_queue' AND s.source_id=q.id);
  END IF;
 END IF;
 PERFORM public.reconcile_decisions();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.decisions_event_sync() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER decisions_ai_source AFTER INSERT OR UPDATE ON public.ai_action_queue FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_alert_source AFTER INSERT OR UPDATE ON public.workbench_alerts FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_finance_source AFTER INSERT OR UPDATE ON public.finance_batch_items FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_task_source AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_lead_change AFTER UPDATE OF status,nethunt_stage,trip_start,trip_finish,travel_dates,travel_end_date ON public.leads FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_payment_change AFTER INSERT OR UPDATE ON public.lead_payments FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_ledger_change AFTER INSERT OR UPDATE ON public.payments_ledger FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_ops_change AFTER INSERT OR UPDATE OF booking_status ON public.lead_operations FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE TRIGGER decisions_thread_change AFTER UPDATE OF ball,last_message_at ON public.workbench_threads FOR EACH ROW EXECUTE FUNCTION public.decisions_event_sync();
CREATE FUNCTION public.decision_action(p_id uuid,p_action text,p_note text DEFAULT NULL,p_until timestamptz DEFAULT NULL,p_prepared jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.decisions; src public.decision_sources; uid uuid:=auth.uid(); changed integer; email text;
BEGIN
 SELECT * INTO d FROM public.decisions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR uid IS NULL OR public.is_agent_user(uid) OR NOT public.can_read_decision(d.side) THEN RAISE EXCEPTION 'Decisão reservada a humanos autorizados'; END IF;
 IF d.side='finance' AND NOT public.is_finance_human(uid) THEN RAISE EXCEPTION 'Validação financeira reservada à contabilidade ou administração'; END IF;
 IF p_action='reopen' THEN
  IF d.status<>'auto_closed' OR d.source_status NOT IN ('pending','open','snoozed') THEN RAISE EXCEPTION 'Só cartões fechados automaticamente e ainda pendentes podem reabrir'; END IF;
  UPDATE public.decisions SET status='open',closed_reason=NULL,reopened_at=now(),decided_by=uid,decided_at=now(),updated_at=now() WHERE id=p_id;
 ELSIF p_action='snooze' THEN
  IF d.status NOT IN ('open','snoozed') OR p_until IS NULL OR p_until<=now() THEN RAISE EXCEPTION 'Escolhe uma data futura para um cartão aberto'; END IF;
  UPDATE public.decisions SET status='snoozed',snooze_until=p_until,decided_by=uid,decided_at=now(),updated_at=now() WHERE id=p_id;
 ELSIF p_action='edit' THEN
  IF d.status NOT IN ('open','snoozed') OR p_prepared IS NULL THEN RAISE EXCEPTION 'Cartão não editável'; END IF;
  IF d.source_table='finance_batch_items' THEN RAISE EXCEPTION 'O payload financeiro é preparado pelo Tesoureiro; humanos apenas validam'; END IF;
  FOR src IN SELECT * FROM public.decision_sources WHERE decision_id=p_id LOOP
   IF src.source_table='ai_action_queue' THEN UPDATE public.ai_action_queue SET payload=p_prepared WHERE id=src.source_id AND status='pending';
   ELSIF src.source_table='tasks' THEN UPDATE public.tasks SET description=p_prepared->>'description' WHERE id=src.source_id AND NOT completed;
   ELSE UPDATE public.workbench_alerts SET next_step=p_prepared->>'next_step' WHERE id=src.source_id AND status IN ('open','snoozed'); END IF;
  END LOOP;
  UPDATE public.decisions SET prepared=p_prepared,updated_at=now() WHERE id=p_id;
 ELSIF p_action IN ('approve','reject') THEN
  IF d.status<>'open' THEN RAISE EXCEPTION 'Este cartão já não está aberto; atualiza a fila'; END IF;
  IF p_action='reject' AND coalesce(btrim(p_note),'')='' THEN RAISE EXCEPTION 'Indica o motivo da rejeição'; END IF;
  IF d.kind IN ('client_email','fse_email') AND p_action='approve' AND coalesce(btrim(d.prepared->>'to'),'')='' THEN RAISE EXCEPTION 'Falta o destinatário do email; edita antes de aprovar'; END IF;
  FOR src IN SELECT * FROM public.decision_sources WHERE decision_id=p_id LOOP
   IF src.source_table='ai_action_queue' THEN
    UPDATE public.ai_action_queue SET status=CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,reviewed_by=uid,reviewed_at=now() WHERE id=src.source_id AND status='pending';
   ELSIF src.source_table='finance_batch_items' THEN
    UPDATE public.finance_batch_items SET validation_status=CASE p_action WHEN 'approve' THEN 'approved'::public.finance_validation ELSE 'rejected'::public.finance_validation END,validated_by=uid::text,rejection_note=CASE WHEN p_action='reject' THEN p_note ELSE NULL END WHERE id=src.source_id AND validation_status='pending';
   ELSIF src.source_table='tasks' THEN
    UPDATE public.tasks SET completed=true,status=CASE p_action WHEN 'approve' THEN 'done' ELSE 'cancelled' END WHERE id=src.source_id AND NOT completed;
   ELSE UPDATE public.workbench_alerts SET status='handled',handled_by=uid,handled_at=now() WHERE id=src.source_id AND status IN ('open','snoozed'); END IF;
   GET DIAGNOSTICS changed=ROW_COUNT; IF changed=0 THEN RAISE EXCEPTION 'A origem mudou; atualiza a fila antes de decidir'; END IF;
  END LOOP;
  UPDATE public.decisions SET status=CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,decided_by=uid,decided_at=now(),closed_reason=p_note,updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
 INSERT INTO public.decision_events(decision_id,action,reason,actor_id) VALUES(p_id,p_action,p_note,uid);
 RETURN jsonb_build_object('source_table',d.source_table,'source_id',d.source_id,'prepared',d.prepared,'kind',d.kind,'lead_id',d.lead_id,'yt_ref',d.yt_ref,'title',d.title);
END $$;
REVOKE ALL ON FUNCTION public.decision_action(uuid,text,text,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decision_action(uuid,text,text,timestamptz,jsonb) TO authenticated;
CREATE FUNCTION public.activate_decision_auto_close() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) OR public.is_agent_user(auth.uid()) THEN RAISE EXCEPTION 'Só a administração humana pode confirmar a primeira limpeza'; END IF;
 UPDATE public.decisions_control SET auto_close_enabled=true,activated_by=auth.uid(),activated_at=now() WHERE singleton AND NOT auto_close_enabled;
 RETURN public.reconcile_decisions();
END $$;
REVOKE ALL ON FUNCTION public.activate_decision_auto_close() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activate_decision_auto_close() TO authenticated;
-- Additive backfill only; source rows and source states are untouched.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT to_jsonb(q) j FROM public.ai_action_queue q WHERE status='pending' ORDER BY created_at LOOP PERFORM public.sync_decision_source('ai_action_queue',r.j); END LOOP;
 FOR r IN SELECT to_jsonb(q) j FROM public.workbench_alerts q WHERE status IN ('open','snoozed') ORDER BY created_at LOOP PERFORM public.sync_decision_source('workbench_alerts',r.j); END LOOP;
 FOR r IN SELECT to_jsonb(q) j FROM public.finance_batch_items q WHERE validation_status='pending' ORDER BY created_at LOOP PERFORM public.sync_decision_source('finance_batch_items',r.j); END LOOP;
 FOR r IN SELECT to_jsonb(q) j FROM public.tasks q WHERE NOT completed AND status NOT IN ('done','completed','cancelled','canceled') AND lead_id IS NOT NULL AND (due_date IS NOT NULL OR due_at IS NOT NULL) ORDER BY created_at LOOP PERFORM public.sync_decision_source('tasks',r.j); END LOOP;
END $$;
-- A private data-free doorbell for authorized human queue readers; no row data is broadcast.
CREATE FUNCTION public.decisions_ring() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM new_rows) THEN PERFORM realtime.send('{}'::jsonb,'changed','cockpit-decisions',true); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.decisions_ring() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER decisions_insert_ring AFTER INSERT ON public.decisions REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.decisions_ring();
CREATE TRIGGER decisions_update_ring AFTER UPDATE ON public.decisions REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.decisions_ring();
CREATE POLICY decisions_private_topic ON realtime.messages FOR SELECT TO authenticated USING(realtime.topic()='cockpit-decisions' AND NOT public.is_agent_user(auth.uid()) AND (public.can_use_workbench(auth.uid()) OR public.has_role(auth.uid(),'finance')));
COMMENT ON TABLE public.decisions IS 'Human decision index only: automatic closure never approves or executes source items. All sources and history are preserved.';
COMMENT ON TABLE public.decision_sources IS 'Dedupe aliases: one human card may point to several preserved identical source rows.';