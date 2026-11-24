ALTER TABLE public.ai_action_queue ADD COLUMN payload_approved jsonb, ADD COLUMN scheduled_for timestamptz, ADD COLUMN execution_state text NOT NULL DEFAULT 'idle' CHECK(execution_state IN ('idle','scheduled','running','done','failed','uncertain','cancelled')), ADD COLUMN execution_token uuid, ADD COLUMN retry_safe boolean NOT NULL DEFAULT true;
ALTER TABLE public.decisions ADD COLUMN execution_result jsonb, ADD COLUMN executed_at timestamptz, ADD COLUMN scheduled_for timestamptz, ADD COLUMN execution_error text;
ALTER TABLE public.decision_events ADD COLUMN details jsonb;
CREATE FUNCTION public.next_client_send(p_now timestamptz DEFAULT now()) RETURNS timestamptz LANGUAGE sql STABLE SET search_path='' AS $$ SELECT (((p_now AT TIME ZONE 'Europe/Lisbon')::date+1)+time '08:00') AT TIME ZONE 'Europe/Lisbon' $$;
REVOKE ALL ON FUNCTION public.next_client_send(timestamptz) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.next_client_send(timestamptz) TO authenticated,service_role;
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE oid='public.decision_action(uuid,text,text,timestamptz,jsonb)'::regprocedure; EXECUTE replace(definition,'public.decision_action(','public.decision_action_original('); END $$;
REVOKE ALL ON FUNCTION public.decision_action_original(uuid,text,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.decision_action(p_id uuid,p_action text,p_note text DEFAULT NULL,p_until timestamptz DEFAULT NULL,p_prepared jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.decisions; r jsonb; stamp timestamptz; label text;
BEGIN
 SELECT * INTO d FROM public.decisions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR public.is_agent_user(auth.uid()) OR NOT public.can_read_decision(d.side) THEN RAISE EXCEPTION 'Decisão reservada a humanos autorizados'; END IF;
 IF p_action='edit' AND d.source_table='ai_action_queue' THEN
  IF d.status NOT IN ('open','snoozed') OR p_prepared IS NULL OR jsonb_typeof(p_prepared)<>'object' THEN RAISE EXCEPTION 'Cartão não editável'; END IF;
  UPDATE public.ai_action_queue SET payload_approved=p_prepared WHERE status='pending' AND id IN(SELECT source_id FROM public.decision_sources WHERE decision_id=p_id AND source_table='ai_action_queue');
  UPDATE public.decisions SET prepared=p_prepared,updated_at=now() WHERE id=p_id;
  INSERT INTO public.decision_events(decision_id,action,actor_id,details) VALUES(p_id,'edit',auth.uid(),jsonb_build_object('before',d.prepared,'after',p_prepared));
  RETURN jsonb_build_object('saved',true);
 END IF;
 IF p_action='cancel_send' THEN
  IF d.kind<>'client_email' OR d.status<>'approved' THEN RAISE EXCEPTION 'Este envio não está agendado'; END IF;
  UPDATE public.ai_action_queue SET execution_state='cancelled',scheduled_for=NULL WHERE id=d.source_id AND execution_state='scheduled';
  IF NOT FOUND THEN RAISE EXCEPTION 'Envio já reservado; não é possível cancelar'; END IF;
  UPDATE public.decisions SET status='rejected',scheduled_for=NULL,closed_reason='Envio cancelado por decisão humana',decided_by=auth.uid(),decided_at=now() WHERE id=p_id;
  INSERT INTO public.decision_events(decision_id,action,actor_id) VALUES(p_id,'cancel_send',auth.uid()); RETURN jsonb_build_object('cancelled',true);
 END IF;
 IF p_action='approve' AND d.status IN ('approved','executed') THEN RETURN jsonb_build_object('already_approved',true,'scheduled_for',d.scheduled_for); END IF;
 r:=public.decision_action_original(p_id,p_action,p_note,p_until,p_prepared);
 IF p_action='approve' THEN
  SELECT coalesce(full_name,'Equipa') INTO label FROM public.profiles WHERE id=auth.uid();
  IF d.source_table='ai_action_queue' THEN
   stamp:=CASE WHEN d.kind='client_email' THEN public.next_client_send() ELSE NULL END;
   UPDATE public.ai_action_queue SET payload_approved=coalesce(payload_approved,payload),scheduled_for=stamp,execution_state=CASE WHEN stamp IS NULL THEN 'idle' ELSE 'scheduled' END WHERE id IN(SELECT source_id FROM public.decision_sources WHERE decision_id=p_id AND source_table='ai_action_queue');
   UPDATE public.decisions SET scheduled_for=stamp,prepared=coalesce((SELECT payload_approved FROM public.ai_action_queue WHERE id=d.source_id),prepared) WHERE id=p_id;
  ELSIF d.kind IN ('task','alert') THEN
   UPDATE public.decisions SET status='executed',executed_at=now(),execution_result=jsonb_build_object('handled',true) WHERE id=p_id;
   INSERT INTO public.workbench_auto_log(lead_id,side,what,trace,created_by_agent) VALUES(d.lead_id,CASE WHEN d.side='ops' THEN 'ops' ELSE 'sales' END,d.title||' — concluído',CASE WHEN d.lead_id IS NOT NULL THEN '/leads/'||d.lead_id::text ELSE '/cockpit' END,'Aprovado por '||coalesce(label,'Equipa')||' no Cockpit');
  END IF;
 END IF;
 RETURN r||jsonb_build_object('scheduled_for',stamp);
END $$;
CREATE FUNCTION public.claim_decision_execution(p_id uuid,p_send_now boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.decisions; q public.ai_action_queue; token uuid:=gen_random_uuid(); scheduler boolean:=auth.role()='service_role';
BEGIN
 SELECT * INTO d FROM public.decisions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR d.source_table<>'ai_action_queue' THEN RAISE EXCEPTION 'Execução AI indisponível'; END IF;
 IF scheduler THEN
  IF d.kind<>'client_email' OR p_send_now THEN RAISE EXCEPTION 'Agendamento reservado a emails aprovados'; END IF;
 ELSE
  IF auth.uid() IS NULL OR public.is_agent_user(auth.uid()) OR NOT public.can_read_decision(d.side) THEN RAISE EXCEPTION 'Execução reservada a humanos autorizados'; END IF;
 END IF;
 SELECT * INTO q FROM public.ai_action_queue WHERE id=d.source_id FOR UPDATE;
 IF q.status='executed' OR q.execution_state IN ('running','done','cancelled','uncertain') THEN RETURN jsonb_build_object('skipped',true,'state',q.execution_state); END IF;
 IF q.status NOT IN ('approved','failed') OR (q.status='failed' AND NOT q.retry_safe) THEN RAISE EXCEPTION 'Item não aprovado ou envio incerto; verificar antes de repetir'; END IF;
 IF scheduler AND (q.execution_state<>'scheduled' OR q.scheduled_for>now()) THEN RETURN jsonb_build_object('skipped',true); END IF;
 IF NOT scheduler AND q.type='client_email' AND NOT p_send_now THEN RETURN jsonb_build_object('skipped',true,'scheduled_for',q.scheduled_for); END IF;
 IF q.status='failed' THEN UPDATE public.ai_action_queue SET status='approved' WHERE id=q.id; END IF;
 UPDATE public.ai_action_queue SET execution_state='running',execution_token=token,error=NULL WHERE id=q.id;
 RETURN jsonb_build_object('token',token,'item',to_jsonb(q),'payload',coalesce(q.payload_approved,q.payload));
END $$;
REVOKE ALL ON FUNCTION public.claim_decision_execution(uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.claim_decision_execution(uuid,boolean) TO authenticated,service_role;
CREATE FUNCTION public.finish_decision_execution(p_id uuid,p_token uuid,p_result jsonb DEFAULT NULL,p_error text DEFAULT NULL,p_retry_safe boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.decisions; q public.ai_action_queue; label text; link text;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Résultat réservé au exécuteur'; END IF;
 SELECT * INTO d FROM public.decisions WHERE id=p_id FOR UPDATE; SELECT * INTO q FROM public.ai_action_queue WHERE id=d.source_id FOR UPDATE;
 IF q.execution_state<>'running' OR q.execution_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Réservation invalide'; END IF;
 UPDATE public.ai_action_queue SET status=CASE WHEN p_error IS NULL THEN 'executed' ELSE 'failed' END,result=p_result,error=p_error,execution_state=CASE WHEN p_error IS NULL THEN 'done' WHEN p_retry_safe THEN 'failed' ELSE 'uncertain' END,retry_safe=p_retry_safe,executed_at=CASE WHEN p_error IS NULL THEN now() ELSE NULL END WHERE id=q.id;
 UPDATE public.decisions SET execution_result=p_result,execution_error=p_error,scheduled_for=NULL,executed_at=CASE WHEN p_error IS NULL THEN now() ELSE NULL END WHERE id=p_id;
 SELECT coalesce(full_name,'Equipa') INTO label FROM public.profiles WHERE id=q.reviewed_by;
 link:=coalesce(p_result->>'url',CASE WHEN d.lead_id IS NOT NULL THEN '/leads/'||d.lead_id::text ELSE '/cockpit' END);
 INSERT INTO public.workbench_auto_log(lead_id,side,what,trace,created_by_agent) VALUES(d.lead_id,CASE WHEN d.side='ops' THEN 'ops' ELSE 'sales' END,d.title||CASE WHEN p_error IS NULL THEN ' — executado' ELSE ' — falhou: '||p_error END,link,'Aprovado por '||coalesce(label,'Equipa')||' no Cockpit');
 INSERT INTO public.decision_events(decision_id,action,actor_id,reason,details) VALUES(p_id,CASE WHEN p_error IS NULL THEN 'executed' ELSE 'failed' END,q.reviewed_by,p_error,p_result);
END $$;
REVOKE ALL ON FUNCTION public.finish_decision_execution(uuid,uuid,jsonb,text,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.finish_decision_execution(uuid,uuid,jsonb,text,boolean) TO service_role;
CREATE FUNCTION public.protect_queue_execution_fields() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF current_user IN ('authenticated','anon') AND (NEW.execution_state IS DISTINCT FROM OLD.execution_state OR NEW.execution_token IS DISTINCT FROM OLD.execution_token OR NEW.payload_approved IS DISTINCT FROM OLD.payload_approved OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for OR NEW.retry_safe IS DISTINCT FROM OLD.retry_safe) THEN RAISE EXCEPTION 'Campos de execução reservados ao executor'; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_queue_execution_fields BEFORE UPDATE ON public.ai_action_queue FOR EACH ROW EXECUTE FUNCTION public.protect_queue_execution_fields();