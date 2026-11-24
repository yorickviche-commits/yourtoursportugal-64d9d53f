-- Chat relay + executor authorization (Lote 2B). All effects rolled back; no external calls.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE human uuid:='7f1618c9-9083-4706-bbcc-387c553471e4'; agent uuid; lid uuid:=gen_random_uuid(); k text; qid uuid; did uuid; aid uuid; msg text; r jsonb;
BEGIN
 SELECT agent_user_id INTO agent FROM public.agent_api_keys WHERE agent_user_id IS NOT NULL LIMIT 1;
 INSERT INTO public.leads(id,lead_code,client_name,status,trip_start) VALUES(lid,'RELAY-ROLLBACK-'||lid,'Relay rollback only','new',current_date+60);
 -- seed cards as the human
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',human,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',human::text,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
 FOREACH k IN ARRAY ARRAY['client_email','payment_link','fse_email'] LOOP
  INSERT INTO public.ai_action_queue(type,lead_id,lead_code,title,payload,idempotency_key,created_by_label) VALUES(k,lid,'RELAY',k||' test',jsonb_build_object('to','test@example.invalid','subject','s','body','b'),'relay-test:'||k||':'||lid,'test');
 END LOOP;
 INSERT INTO public.workbench_alerts(lead_id,side,title,reason) VALUES(lid,'sales','RELAY','relay test') RETURNING id INTO aid;
 IF (SELECT count(*) FROM public.decisions WHERE lead_id=lid)<>4 THEN RAISE EXCEPTION 'Cards not created by source triggers: %',(SELECT count(*) FROM public.decisions WHERE lead_id=lid); END IF;
 -- 1) interactive claude.ai OAuth session (client_id claim)
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',human,'role','authenticated','client_id','claude-test')::text,true);
 IF NOT public.is_chat_relay() THEN RAISE EXCEPTION 'OAuth session classification wrong'; END IF;
 FOREACH k IN ARRAY ARRAY['client_email','payment_link'] LOOP
  SELECT id INTO did FROM public.decisions WHERE lead_id=lid AND kind=k;
  BEGIN PERFORM public.mcp_apply_human_decision(did,'approve','ok 1'); RAISE EXCEPTION 'LEAK %',k;
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg NOT LIKE 'Este cartão só pode ser aprovado por um humano no Cockpit%' THEN RAISE EXCEPTION '% wrong error: %',k,msg; END IF; END;
  BEGIN PERFORM public.claim_decision_execution(did,true); RAISE EXCEPTION 'EXEC LEAK %',k; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg LIKE 'EXEC LEAK%' THEN RAISE; END IF; END;
  IF (SELECT status FROM public.ai_action_queue WHERE lead_id=lid AND type=k)<>'pending' THEN RAISE EXCEPTION '% source changed',k; END IF;
 END LOOP;
 -- OAuth cannot invoke executor on a non-relayed fse_email
 SELECT id INTO did FROM public.decisions WHERE lead_id=lid AND kind='fse_email';
 BEGIN PERFORM public.claim_decision_execution(did,false); RAISE EXCEPTION 'EXEC LEAK fse'; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg LIKE 'EXEC LEAK%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.mcp_apply_human_decision(did,'approve','  '); RAISE EXCEPTION 'QUOTE LEAK'; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg NOT LIKE 'human_quote%' THEN RAISE EXCEPTION 'quote: %',msg; END IF; END;
 -- relay approves an alert
 SELECT id INTO did FROM public.decisions WHERE lead_id=lid AND kind='alert';
 r:=public.mcp_apply_human_decision(did,'approve','ok 2');
 IF (SELECT status FROM public.workbench_alerts WHERE id=aid)<>'handled' OR NOT (SELECT via_chat AND human_quote='ok 2' AND decided_by_label LIKE 'Yorick via chat (relayado por %' FROM public.decisions WHERE id=did) THEN RAISE EXCEPTION 'relay alert not applied'; END IF;
 -- relay approves fse_email; executor claim then allowed for the relay
 SELECT id INTO did FROM public.decisions WHERE lead_id=lid AND kind='fse_email';
 r:=public.mcp_apply_human_decision(did,'approve','ok 3');
 IF (SELECT status FROM public.ai_action_queue WHERE lead_id=lid AND type='fse_email')<>'approved' THEN RAISE EXCEPTION 'fse not approved'; END IF;
 r:=public.claim_decision_execution(did,false); IF r->>'token' IS NULL THEN RAISE EXCEPTION 'relay fse claim refused'; END IF;
 -- 2) agent key (not Orquestrador)
 IF agent IS NOT NULL THEN
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',agent,'role','authenticated')::text,true); PERFORM set_config('request.jwt.claim.sub',agent::text,true);
  FOREACH k IN ARRAY ARRAY['client_email','payment_link'] LOOP
   SELECT id INTO did FROM public.decisions WHERE lead_id=lid AND kind=k;
   BEGIN PERFORM public.mcp_apply_human_decision(did,'approve','ok'); RAISE EXCEPTION 'AGENT LEAK %',k; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg NOT LIKE 'Este cartão só pode ser aprovado por um humano no Cockpit%' THEN RAISE EXCEPTION 'agent % : %',k,msg; END IF; END;
   BEGIN PERFORM public.claim_decision_execution(did,true); RAISE EXCEPTION 'AGENT EXEC LEAK'; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg LIKE 'AGENT EXEC LEAK%' THEN RAISE; END IF; END;
   BEGIN UPDATE public.ai_action_queue SET status='approved' WHERE lead_id=lid AND type=k; RAISE EXCEPTION 'AGENT DIRECT LEAK'; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg LIKE 'AGENT DIRECT LEAK%' THEN RAISE; END IF; END;
  END LOOP;
  IF public.is_chat_relay() THEN RAISE EXCEPTION 'non-Orquestrador agent treated as relay'; END IF;
  -- touch: close proposal stays a candidate
  SELECT id INTO did FROM public.decisions WHERE lead_id=lid AND kind='client_email';
  PERFORM public.mcp_touch_decision(did,'verificado TCC','obsoleto: teste');
  PERFORM public.reconcile_decisions();
  IF (SELECT status FROM public.decisions WHERE id=did)<>'open' OR (SELECT candidate_rule FROM public.decisions WHERE id=did)<>'agent_proposed' THEN RAISE EXCEPTION 'agent close proposal closed the card'; END IF;
 END IF;
 RAISE NOTICE 'decisionRelay: all checks passed (agent fixture: %)', agent IS NOT NULL;
END $test$;
ROLLBACK;
