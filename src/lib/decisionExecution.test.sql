-- Run with the privileged test connection. No external calls; everything rolls back.
BEGIN;
DO $test$
DECLARE uid uuid:='7f1618c9-9083-4706-bbcc-387c553471e4'; lid uuid:=gen_random_uuid(); qid uuid:=gen_random_uuid(); did uuid; t uuid:=gen_random_uuid(); c jsonb; twice jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 IF public.next_client_send('2026-11-24T10:00:00Z')<>'2026-11-25T08:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Winter client schedule must be next day 08 Lisbon'; END IF;
 IF public.next_client_send('2026-07-24T10:00:00Z')<>'2026-07-25T07:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Summer client schedule must be next day 08 Lisbon'; END IF;
 IF public.next_client_send('2026-03-28T10:00:00Z')<>'2026-03-29T07:00:00Z'::timestamptz THEN RAISE EXCEPTION 'DST boundary incorrect'; END IF;
 INSERT INTO public.leads(id,lead_code,client_name,status,trip_start) VALUES(lid,'DECISION-EXEC-TEST-'||lid,'Rollback only','new',current_date+60);
 INSERT INTO public.ai_action_queue(id,type,lead_id,title,payload) VALUES(qid,'client_email',lid,'Execution test',jsonb_build_object('to','test@example.invalid','subject','Original','html','Original'));
 SELECT decision_id INTO did FROM public.decision_sources WHERE source_id=qid;
 PERFORM public.decision_action(did,'edit',NULL,NULL,jsonb_build_object('to','test@example.invalid','subject','Edited','html','Approved body'));
 IF (SELECT payload->>'subject' FROM public.ai_action_queue WHERE id=qid)<>'Original' THEN RAISE EXCEPTION 'Original proposal overwritten'; END IF;
 PERFORM public.decision_action(did,'approve');
 IF (SELECT payload_approved->>'subject' FROM public.ai_action_queue WHERE id=qid)<>'Edited' THEN RAISE EXCEPTION 'Approved edit lost'; END IF;
 IF (SELECT execution_state FROM public.ai_action_queue WHERE id=qid)<>'scheduled' THEN RAISE EXCEPTION 'Client approved without schedule'; END IF;
 c:=public.claim_decision_execution(did,false);
 IF NOT (c->>'skipped')::boolean THEN RAISE EXCEPTION 'Client email sent before 08 without override'; END IF;
 PERFORM public.decision_action(did,'approve');
 c:=public.claim_decision_execution(did,true); twice:=public.claim_decision_execution(did,true);
 IF c->>'token' IS NULL OR NOT (twice->>'skipped')::boolean THEN RAISE EXCEPTION 'Duplicate execution reservation'; END IF;
 IF c->'payload'->>'html'<>'Approved body' THEN RAISE EXCEPTION 'Sending wrong version'; END IF;
 BEGIN PERFORM public.decision_action(did,'cancel_send'); RAISE EXCEPTION 'Cancellation allowed after claim'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Cancellation allowed after claim' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM public.finish_decision_execution(did,(c->>'token')::uuid,'{"url":"https://example.invalid/sent"}',NULL,false);
 IF (SELECT status FROM public.decisions WHERE id=did)<>'executed' THEN RAISE EXCEPTION 'Result not shown'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workbench_auto_log WHERE lead_id=lid AND created_by_agent='Aprovado por Yorick Viche no Cockpit') THEN RAISE EXCEPTION 'Execution attribution missing'; END IF;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 INSERT INTO public.tasks(id,lead_id,title,due_date) VALUES(t,lid,'Complete execution test',current_date+60);
 SELECT decision_id INTO did FROM public.decision_sources WHERE source_id=t;
 PERFORM public.decision_action(did,'approve');
 IF NOT (SELECT completed FROM public.tasks WHERE id=t) OR (SELECT status FROM public.decisions WHERE id=did)<>'executed' THEN RAISE EXCEPTION 'Task approval does not complete source and card'; END IF;
 -- Unauthenticated callers cannot claim; do not borrow a real user's token.
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.claim_decision_execution(did,true); RAISE EXCEPTION 'Unauthorized claim allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Unauthorized claim allowed' THEN RAISE; END IF; END;
END $test$;
ROLLBACK;