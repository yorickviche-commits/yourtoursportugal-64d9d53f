alter table public.decisions
  add column if not exists via_chat boolean not null default false,
  add column if not exists decided_by_label text,
  add column if not exists human_quote text,
  add column if not exists agent_dedupe text,
  add column if not exists agent_close_reason text,
  add column if not exists agent_close_label text,
  add column if not exists agent_close_at timestamptz,
  add column if not exists checked_by_label text,
  add column if not exists urgency text;
create index if not exists decisions_agent_dedupe_idx on public.decisions(agent_dedupe);

create or replace function public.mcp_actor_label() returns text language sql stable security definer set search_path='' as $$
 select coalesce((select k.agent_label from public.current_agent_key() k limit 1),
   (select coalesce(full_name,'Equipa')||' (claude.ai)' from public.profiles where id=auth.uid()),'AI agent (MCP)') $$;

create or replace function public.mcp_can_use_decisions() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_agent_user(auth.uid()) or public.is_internal_user(auth.uid())) $$;

create or replace function public.is_chat_relay() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  (public.is_agent_user(auth.uid()) and exists(select 1 from public.current_agent_key() k where k.agent_label ilike '%orquestrador%' or k.name ilike '%orquestrador%'))
  or (not public.is_agent_user(auth.uid()) and public.is_internal_user(auth.uid()) and coalesce(nullif(auth.jwt()->>'client_id',''),nullif(auth.jwt()->>'azp',''),'')<>'')) $$;

create or replace function public.mcp_list_decisions(p_status text default 'open', p_side text default null, p_kind text default null, p_lead uuid default null, p_older_than_days int default null, p_updated_since timestamptz default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
BEGIN
 IF NOT public.mcp_can_use_decisions() THEN RAISE EXCEPTION 'Sem acesso à fila'; END IF;
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'trip_date' NULLS LAST, x->>'created_at') FROM (
  SELECT jsonb_build_object('id',d.id,'yt_ref',d.yt_ref,'client',to_jsonb(l)->>'client_name','trip_date',coalesce(to_jsonb(l)->>'trip_start',to_jsonb(l)->>'travel_dates'),
   'side',d.side,'kind',d.kind,'title',d.title,'why',d.why,'prepared',left(coalesce(d.prepared->>'subject','')||' '||coalesce(d.prepared->>'amount','')||' '||left(coalesce(d.prepared->>'body',d.prepared->>'next_step',d.prepared->>'description',''),200),300),
   'checked_at',d.checked_at,'checked_note',d.checked_note,'age_days',extract(day from now()-d.created_at)::int,'close_rule',d.close_rule,'status',d.status,
   'candidate_close',d.candidate_reason,'human_only',d.kind in ('client_email','payment_link','finance_item'),'via_chat',d.via_chat,'created_at',d.created_at,
   'lead_path',CASE WHEN d.lead_id IS NOT NULL THEN '/leads/'||d.lead_id END) x
  FROM public.decisions d LEFT JOIN public.leads l ON l.id=d.lead_id
  WHERE (p_status IS NULL OR p_status='all' OR d.status=p_status) AND (p_side IS NULL OR d.side=p_side) AND (p_kind IS NULL OR d.kind=p_kind)
   AND (p_lead IS NULL OR d.lead_id=p_lead) AND (p_older_than_days IS NULL OR d.created_at<now()-make_interval(days=>p_older_than_days))
   AND (p_updated_since IS NULL OR d.updated_at>=p_updated_since)
  ORDER BY d.created_at LIMIT least(coalesce(p_limit,100),300)) s),'[]'::jsonb);
END $$;

create or replace function public.mcp_decision_by_dedupe(p_lead uuid, p_kind text, p_reason text) returns jsonb language plpgsql stable security definer set search_path='' as $$
DECLARE k text:=p_lead::text||':'||p_kind||':'||md5(lower(btrim(p_reason))); d public.decisions;
BEGIN
 IF NOT public.mcp_can_use_decisions() THEN RAISE EXCEPTION 'Sem acesso à fila'; END IF;
 SELECT * INTO d FROM public.decisions WHERE agent_dedupe=k AND (status IN ('open','snoozed') OR (status='rejected' AND decided_at>now()-interval '30 days')) ORDER BY (status IN ('open','snoozed')) DESC, decided_at DESC NULLS LAST LIMIT 1;
 RETURN jsonb_build_object('dedupe',k,'id',d.id,'status',d.status,'decided_at',d.decided_at,
  'note',coalesce(d.closed_reason,(SELECT e.reason FROM public.decision_events e WHERE e.decision_id=d.id AND e.action='reject' ORDER BY e.created_at DESC LIMIT 1)));
END $$;

create or replace function public.mcp_set_decision_meta(p_id uuid, p_source_table text, p_source_id uuid, p_dedupe text, p_why text, p_prepared jsonb, p_checked_note text, p_close_rule text, p_close_params jsonb, p_urgency text)
returns jsonb language plpgsql security definer set search_path='' as $$
DECLARE did uuid:=p_id; label text:=public.mcp_actor_label();
BEGIN
 IF NOT public.mcp_can_use_decisions() THEN RAISE EXCEPTION 'Sem acesso à fila'; END IF;
 IF did IS NULL THEN SELECT decision_id INTO did FROM public.decision_sources WHERE source_table=p_source_table AND source_id=p_source_id; END IF;
 IF did IS NULL THEN RAISE EXCEPTION 'Cartão não encontrado para a origem'; END IF;
 UPDATE public.decisions SET agent_dedupe=coalesce(p_dedupe,agent_dedupe), why=coalesce(p_why,why),
  prepared=CASE WHEN source_table='ai_action_queue' OR p_prepared IS NULL THEN prepared ELSE prepared||p_prepared END,
  checked_at=now(), checked_note=coalesce(p_checked_note,checked_note), checked_by_label=label,
  close_rule=coalesce(p_close_rule,close_rule), close_params=coalesce(p_close_params,close_params), urgency=coalesce(p_urgency,urgency), updated_at=now()
 WHERE id=did AND status IN ('open','snoozed');
 IF NOT FOUND THEN RAISE EXCEPTION 'Este cartão já não está aberto'; END IF;
 INSERT INTO public.decision_events(decision_id,action,actor_id,details) VALUES(did,'agent_propose',auth.uid(),jsonb_build_object('by',label));
 RETURN jsonb_build_object('id',did);
END $$;

create or replace function public.mcp_touch_decision(p_id uuid, p_checked_note text, p_close_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
DECLARE label text:=public.mcp_actor_label();
BEGIN
 IF NOT public.mcp_can_use_decisions() THEN RAISE EXCEPTION 'Sem acesso à fila'; END IF;
 UPDATE public.decisions SET checked_at=now(), checked_note=coalesce(p_checked_note,checked_note), checked_by_label=label,
  agent_close_reason=coalesce(p_close_reason,agent_close_reason), agent_close_label=CASE WHEN p_close_reason IS NOT NULL THEN label ELSE agent_close_label END,
  agent_close_at=CASE WHEN p_close_reason IS NOT NULL THEN now() ELSE agent_close_at END,
  candidate_rule=CASE WHEN p_close_reason IS NOT NULL AND candidate_rule IS NULL THEN 'agent_proposed' ELSE candidate_rule END,
  candidate_reason=CASE WHEN p_close_reason IS NOT NULL AND candidate_rule IS NULL THEN 'Proposto por '||label||': '||p_close_reason ELSE candidate_reason END, updated_at=now()
 WHERE id=p_id AND status IN ('open','snoozed');
 IF NOT FOUND THEN RAISE EXCEPTION 'Cartão não encontrado ou já fechado'; END IF;
 INSERT INTO public.decision_events(decision_id,action,reason,actor_id,details) VALUES(p_id,CASE WHEN p_close_reason IS NULL THEN 'agent_check' ELSE 'agent_close_proposal' END,coalesce(p_close_reason,p_checked_note),auth.uid(),jsonb_build_object('by',label));
 PERFORM realtime.send('{}'::jsonb,'changed','cockpit-decisions',true);
 RETURN jsonb_build_object('id',p_id,'close_proposed',p_close_reason IS NOT NULL);
END $$;

create or replace function public.mcp_decision_updates(p_since timestamptz, p_limit int default 200) returns jsonb language plpgsql stable security definer set search_path='' as $$
BEGIN
 IF NOT public.mcp_can_use_decisions() THEN RAISE EXCEPTION 'Sem acesso à fila'; END IF;
 RETURN coalesce((SELECT jsonb_agg(u ORDER BY u->>'at') FROM (
  SELECT jsonb_build_object('decision_id',d.id,'yt_ref',d.yt_ref,'kind',d.kind,'title',d.title,'action',e.action,'at',e.created_at,'note',e.reason,
    'by',coalesce(e.details->>'by',p.full_name,'Sistema'),'via_chat',coalesce((e.details->>'via_chat')::boolean,false),
    'human_quote',e.details->>'quote','before',CASE WHEN e.action='edit' THEN e.details->'before' END,'after',CASE WHEN e.action='edit' THEN e.details->'after' END) u
  FROM public.decision_events e JOIN public.decisions d ON d.id=e.decision_id LEFT JOIN public.profiles p ON p.id=e.actor_id
  WHERE e.created_at>=p_since AND e.action NOT IN ('agent_check','agent_propose','agent_close_proposal')
  UNION ALL
  SELECT jsonb_build_object('decision_id',d.id,'yt_ref',d.yt_ref,'kind',d.kind,'title',d.title,'action',d.status,'at',d.executed_at,'note',coalesce(d.execution_error,d.execution_result->>'url'),'by','Executor')
  FROM public.decisions d WHERE d.executed_at>=p_since AND d.status IN ('executed','failed')
  LIMIT least(coalesce(p_limit,200),500)) s),'[]'::jsonb);
END $$;

create or replace function public.mcp_apply_human_decision(p_id uuid, p_action text, p_quote text, p_note text default null, p_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
DECLARE d public.decisions; src public.decision_sources; label text; ok boolean:=false;
BEGIN
 SELECT * INTO d FROM public.decisions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cartão não encontrado'; END IF;
 IF d.kind NOT IN ('fse_email','alert','task') THEN RAISE EXCEPTION 'Este cartão só pode ser aprovado por um humano no Cockpit — /cockpit#decision-%',p_id USING ERRCODE='42501'; END IF;
 IF NOT public.is_chat_relay() THEN RAISE EXCEPTION 'Só o agente Orquestrador ou a sessão interativa do claude.ai podem relayar decisões' USING ERRCODE='42501'; END IF;
 IF coalesce(btrim(p_quote),'')='' THEN RAISE EXCEPTION 'human_quote é obrigatório (texto literal do Yorick)'; END IF;
 IF p_action NOT IN ('approve','reject','snooze') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
 IF d.status<>'open' AND NOT (p_action='snooze' AND d.status='snoozed') THEN RAISE EXCEPTION 'Este cartão já não está aberto'; END IF;
 label:='Yorick via chat (relayado por '||public.mcp_actor_label()||')';
 IF p_action='snooze' THEN
  IF p_until IS NULL OR p_until<=now() THEN RAISE EXCEPTION 'Indica uma data futura'; END IF;
  UPDATE public.decisions SET status='snoozed',snooze_until=p_until,decided_by=auth.uid(),decided_at=now(),decided_by_label=label,via_chat=true,human_quote=p_quote,updated_at=now() WHERE id=p_id;
 ELSE
  IF d.kind='fse_email' AND p_action='approve' AND coalesce(btrim(d.prepared->>'to'),'')='' THEN RAISE EXCEPTION 'Falta o destinatário do email; edita no Cockpit antes de aprovar'; END IF;
  PERFORM set_config('app.chat_relay','on',true);
  FOR src IN SELECT * FROM public.decision_sources WHERE decision_id=p_id LOOP
   IF src.source_table='ai_action_queue' THEN
    UPDATE public.ai_action_queue SET status=CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,payload_approved=CASE WHEN p_action='approve' THEN coalesce(payload_approved,payload) ELSE payload_approved END,execution_state=CASE WHEN p_action='approve' THEN 'idle' ELSE execution_state END WHERE id=src.source_id AND status='pending' AND type='fse_email';
   ELSIF src.source_table='tasks' THEN UPDATE public.tasks SET completed=true,status=CASE p_action WHEN 'approve' THEN 'done' ELSE 'cancelled' END WHERE id=src.source_id AND NOT completed;
   ELSIF src.source_table='workbench_alerts' THEN UPDATE public.workbench_alerts SET status='handled',handled_by=auth.uid(),handled_at=now() WHERE id=src.source_id AND status IN ('open','snoozed');
   ELSE CONTINUE; END IF;
   IF FOUND THEN ok:=true; END IF;
  END LOOP;
  PERFORM set_config('app.chat_relay','',true);
  IF NOT ok THEN RAISE EXCEPTION 'A origem já mudou; atualiza a fila'; END IF;
  UPDATE public.decisions SET status=CASE WHEN p_action='reject' THEN 'rejected' WHEN d.kind='fse_email' THEN 'approved' ELSE 'executed' END,
   executed_at=CASE WHEN p_action='approve' AND d.kind<>'fse_email' THEN now() ELSE executed_at END,
   execution_result=CASE WHEN p_action='approve' AND d.kind<>'fse_email' THEN jsonb_build_object('handled',true) ELSE execution_result END,
   closed_reason=CASE WHEN p_action='reject' THEN coalesce(p_note,p_quote) ELSE closed_reason END,
   decided_by=auth.uid(),decided_at=now(),decided_by_label=label,via_chat=true,human_quote=p_quote,updated_at=now() WHERE id=p_id;
  IF p_action='approve' AND d.kind<>'fse_email' THEN
   INSERT INTO public.workbench_auto_log(lead_id,side,what,trace,created_by_agent) VALUES(d.lead_id,CASE WHEN d.side='ops' THEN 'ops' ELSE 'sales' END,d.title||' — concluído',CASE WHEN d.lead_id IS NOT NULL THEN '/leads/'||d.lead_id::text ELSE '/cockpit' END,label);
  END IF;
 END IF;
 INSERT INTO public.decision_events(decision_id,action,reason,actor_id,details) VALUES(p_id,p_action,coalesce(p_note,p_quote),auth.uid(),jsonb_build_object('via_chat',true,'quote',p_quote,'by',label));
 PERFORM realtime.send('{}'::jsonb,'changed','cockpit-decisions',true);
 RETURN jsonb_build_object('id',p_id,'action',p_action,'kind',d.kind,'needs_execution',p_action='approve' AND d.kind='fse_email');
END $$;

CREATE OR REPLACE FUNCTION public.ai_action_queue_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE allowed text[];
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.status <> 'pending' THEN RAISE EXCEPTION 'Um item da fila AI so pode nascer em pending (tentado: %)', new.status; END IF;
    RETURN new;
  END IF;
  IF new.status IS DISTINCT FROM old.status THEN
    IF public.is_agent_user(auth.uid()) AND NOT (coalesce(current_setting('app.chat_relay',true),'')='on' AND new.type='fse_email' AND old.status='pending' AND new.status IN ('approved','rejected') AND public.is_chat_relay()) THEN
      RAISE EXCEPTION 'Agentes AI nao podem aprovar, rejeitar ou executar itens da fila — requer um humano';
    END IF;
    allowed := CASE old.status WHEN 'pending' THEN array['approved','rejected'] WHEN 'approved' THEN array['executed','failed'] WHEN 'failed' THEN array['approved','rejected'] ELSE array[]::text[] END;
    IF NOT (new.status = ANY(allowed)) THEN RAISE EXCEPTION 'Transicao invalida na fila AI: % -> %', old.status, new.status; END IF;
    IF new.status IN ('approved','rejected') THEN
      IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Aprovar ou rejeitar requer um utilizador autenticado (o agente nao se aprova a si proprio)'; END IF;
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    END IF;
    IF new.status = 'executed' AND new.executed_at IS NULL THEN new.executed_at := now(); END IF;
  END IF;
  RETURN new;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_decision_execution(p_id uuid, p_send_now boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE d public.decisions; q public.ai_action_queue; token uuid:=gen_random_uuid(); scheduler boolean:=auth.role()='service_role';
BEGIN
 SELECT * INTO d FROM public.decisions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR d.source_table<>'ai_action_queue' THEN RAISE EXCEPTION 'Execução AI indisponível'; END IF;
 IF NOT scheduler THEN PERFORM public.assert_cockpit_decision_access(p_id); END IF;
 IF scheduler THEN
  IF d.kind<>'client_email' OR p_send_now THEN RAISE EXCEPTION 'Agendamento reservado a emails aprovados'; END IF;
 ELSIF NOT ((public.is_cockpit_human() AND public.can_read_decision(d.side)) OR (d.kind='fse_email' AND d.via_chat AND public.is_chat_relay())) THEN
  RAISE EXCEPTION 'Execução reservada a humanos autorizados no Cockpit' USING ERRCODE='42501';
 END IF;
 SELECT * INTO q FROM public.ai_action_queue WHERE id=d.source_id FOR UPDATE; IF q.type IN ('client_email','payment_link') AND (q.reviewed_by IS NULL OR q.reviewed_at IS NULL OR public.is_agent_user(q.reviewed_by)) THEN RAISE EXCEPTION 'Execução exige aprovação humana anterior no Cockpit' USING ERRCODE='42501'; END IF;
 IF q.status='executed' OR q.execution_state IN ('running','done','cancelled','uncertain') THEN RETURN jsonb_build_object('skipped',true,'state',q.execution_state); END IF;
 IF q.status NOT IN ('approved','failed') OR (q.status='failed' AND NOT q.retry_safe) THEN RAISE EXCEPTION 'Item não aprovado ou envio incerto; verificar antes de repetir'; END IF;
 IF scheduler AND (q.execution_state<>'scheduled' OR q.scheduled_for>now()) THEN RETURN jsonb_build_object('skipped',true); END IF;
 IF NOT scheduler AND q.type='client_email' AND NOT p_send_now THEN RETURN jsonb_build_object('skipped',true,'scheduled_for',q.scheduled_for); END IF;
 IF q.status='failed' THEN UPDATE public.ai_action_queue SET status='approved' WHERE id=q.id; END IF;
 UPDATE public.ai_action_queue SET execution_state='running',execution_token=token,error=NULL WHERE id=q.id;
 RETURN jsonb_build_object('token',token,'item',to_jsonb(q),'payload',coalesce(q.payload_approved,q.payload));
END $function$;

CREATE OR REPLACE FUNCTION public.reconcile_decisions() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
  IF candidate IS NULL AND d.agent_close_reason IS NOT NULL THEN candidate:=jsonb_build_object('rule','agent_proposed','reason','Proposto por '||coalesce(d.agent_close_label,'agente')||': '||d.agent_close_reason); END IF;
  IF candidate IS NOT NULL THEN candidates:=candidates+1; END IF;
  IF candidate IS NOT NULL AND candidate->>'rule'<>'agent_proposed' AND enabled AND (d.reopened_at IS NULL OR d.reopened_at<now()-interval '24 hours') THEN
   UPDATE public.decisions SET status='auto_closed',closed_reason=candidate->>'reason',candidate_rule=candidate->>'rule',candidate_reason=candidate->>'reason',decided_at=now(),checked_at=now(),checked_note='TCC: datas/estado, pagamentos, Operações e thread ligada',updated_at=now() WHERE id=d.id;
   INSERT INTO public.decision_events(decision_id,action,reason) VALUES(d.id,'auto_closed',candidate->>'reason'); closed:=closed+1;
  ELSE
   UPDATE public.decisions SET candidate_rule=candidate->>'rule',candidate_reason=candidate->>'reason',checked_at=now(),checked_note=CASE WHEN checked_by_label IS NOT NULL THEN checked_note WHEN kind='alert' AND coalesce(close_params->>'thread_id',prepared->>'thread_id',prepared->>'gmail_thread_id') IS NULL THEN 'TCC: datas e estado; sem thread exata, fecho por resposta não inferido' ELSE 'TCC: datas/estado, pagamentos, Operações e thread ligada' END,updated_at=now() WHERE id=d.id;
  END IF;
 END LOOP;
 UPDATE public.decisions_control SET last_reconciled_at=now() WHERE singleton;
 PERFORM set_config('app.decisions_reconcile',coalesce(previous_flag,''),true);
 PERFORM realtime.send('{}'::jsonb,'changed','cockpit-decisions',true);
 RETURN jsonb_build_object('simulation',NOT enabled,'candidates',candidates,'closed',closed);
END $function$;

revoke all on function public.mcp_list_decisions(text,text,text,uuid,int,timestamptz,int), public.mcp_decision_by_dedupe(uuid,text,text), public.mcp_set_decision_meta(uuid,text,uuid,text,text,jsonb,text,text,jsonb,text), public.mcp_touch_decision(uuid,text,text), public.mcp_decision_updates(timestamptz,int), public.mcp_apply_human_decision(uuid,text,text,text,timestamptz), public.is_chat_relay(), public.mcp_actor_label(), public.mcp_can_use_decisions() from public, anon;
grant execute on function public.mcp_list_decisions(text,text,text,uuid,int,timestamptz,int), public.mcp_decision_by_dedupe(uuid,text,text), public.mcp_set_decision_meta(uuid,text,uuid,text,text,jsonb,text,text,jsonb,text), public.mcp_touch_decision(uuid,text,text), public.mcp_decision_updates(timestamptz,int), public.mcp_apply_human_decision(uuid,text,text,text,timestamptz), public.is_chat_relay(), public.mcp_actor_label(), public.mcp_can_use_decisions() to authenticated, service_role;