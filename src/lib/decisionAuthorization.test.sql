-- Authorization regression: isolated fixtures and all effects rolled back, no external calls.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE human uuid:='7f1618c9-9083-4706-bbcc-387c553471e4'; agent uuid;
 lid uuid:=gen_random_uuid(); qid uuid; fid uuid:=gen_random_uuid(); did uuid; k text; actor text; target text; claim jsonb;
BEGIN
 SELECT agent_user_id INTO agent FROM public.agent_api_keys WHERE agent_user_id IS NOT NULL LIMIT 1;
 IF agent IS NULL THEN RAISE EXCEPTION 'An existing agent identity is required'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',human,'role','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',human::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 IF NOT public.is_cockpit_human() THEN RAISE EXCEPTION 'Human app session rejected'; END IF;
 INSERT INTO public.leads(id,lead_code,client_name,status,trip_start) VALUES(lid,'AUTH-ROLLBACK-'||lid,'Authorization rollback only','new',current_date+60);
 FOREACH k IN ARRAY ARRAY['client_email','payment_link','finance_item'] LOOP
  qid:=gen_random_uuid();
  IF k='finance_item' THEN
   PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
   PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claim.role','service_role',true);
   INSERT INTO public.finance_batch_items(id,lead_id,action,proposed_payload) VALUES(fid,lid,'issue_fa','{"amount":123}');
   SELECT decision_id INTO did FROM public.decision_sources WHERE source_id=fid AND source_table='finance_batch_items';
  ELSE
   INSERT INTO public.ai_action_queue(id,type,lead_id,title,payload) VALUES(qid,k,lid,k||' rollback test',jsonb_build_object('to','test@example.invalid','subject',k,'html','Never sent','amount_eur',123));
   SELECT decision_id INTO did FROM public.decision_sources WHERE source_id=qid AND source_table='ai_action_queue';
  END IF;
  IF did IS NULL THEN RAISE EXCEPTION 'Missing test decision: %',k; END IF;
  IF k='client_email' THEN
   PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
   PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claim.role','service_role',true);
   BEGIN PERFORM public.claim_decision_execution(did,false); RAISE EXCEPTION 'Unreviewed scheduler claim allowed'; EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'Execução exige aprovação humana%' THEN RAISE; END IF;
   END;
  END IF;
  FOREACH actor IN ARRAY ARRAY['agent','oauth','azp'] LOOP
   PERFORM set_config('request.jwt.claims',CASE actor WHEN 'agent' THEN jsonb_build_object('sub',agent,'role','authenticated') WHEN 'oauth' THEN jsonb_build_object('sub',human,'role','authenticated','client_id','test-mcp-client') ELSE jsonb_build_object('sub',human,'role','authenticated','azp','test-mcp-client') END::text,true);
   PERFORM set_config('request.jwt.claim.sub',CASE WHEN actor='agent' THEN agent ELSE human END::text,true);
   PERFORM set_config('request.jwt.claim.role','authenticated',true);
   IF public.is_cockpit_human() THEN RAISE EXCEPTION 'Non-app identity recognized as human: %',actor; END IF;
   BEGIN PERFORM public.assert_cockpit_decision_access(did); RAISE EXCEPTION 'Access guard allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN PERFORM public.decision_action(did,'approve'); RAISE EXCEPTION 'Approval RPC allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN PERFORM public.decision_action_original(did,'approve'); RAISE EXCEPTION 'Original RPC allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   FOREACH target IN ARRAY ARRAY['approved','executed'] LOOP
    BEGIN UPDATE public.decisions SET status=target WHERE id=did; RAISE EXCEPTION 'Decision transition allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF k='finance_item' THEN
     BEGIN UPDATE public.finance_batch_items SET validation_status=target::public.finance_validation WHERE id=fid; RAISE EXCEPTION 'Finance transition allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    ELSE
     BEGIN UPDATE public.ai_action_queue SET status=target WHERE id=qid; RAISE EXCEPTION 'AI transition allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END IF;
   END LOOP;
   IF k<>'finance_item' THEN BEGIN PERFORM public.claim_decision_execution(did,true); RAISE EXCEPTION 'Claim allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END IF;
   -- A protected kind cannot be relabelled to bypass the guard in the same write.
   BEGIN UPDATE public.decisions SET kind='task',status='approved' WHERE id=did; RAISE EXCEPTION 'Relabel bypass allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   IF (SELECT status FROM public.decisions WHERE id=did)<>'open' THEN RAISE EXCEPTION 'Blocked attempts changed decision'; END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',human,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',human::text,true);
  PERFORM public.decision_action(did,'approve');
  IF (SELECT status FROM public.decisions WHERE id=did)<>'approved' THEN RAISE EXCEPTION 'Human approval failed for %',k; END IF;
  IF k='client_email' THEN
   IF (SELECT scheduled_for FROM public.ai_action_queue WHERE id=qid) IS DISTINCT FROM public.next_client_send() THEN RAISE EXCEPTION 'Client must stay scheduled for tomorrow 08 Lisbon'; END IF;
   claim:=public.claim_decision_execution(did,false);
   IF NOT (claim->>'skipped')::boolean THEN RAISE EXCEPTION 'Client sent before schedule'; END IF;
  END IF;
  -- Even items already approved by a human cannot be executed or altered by MCP/agents.
  FOREACH actor IN ARRAY ARRAY['agent','oauth'] LOOP
   PERFORM set_config('request.jwt.claims',CASE actor WHEN 'agent' THEN jsonb_build_object('sub',agent,'role','authenticated') ELSE jsonb_build_object('sub',human,'role','authenticated','client_id','test-mcp-client') END::text,true);
   PERFORM set_config('request.jwt.claim.sub',CASE WHEN actor='agent' THEN agent ELSE human END::text,true);
   BEGIN UPDATE public.decisions SET status='executed' WHERE id=did; RAISE EXCEPTION 'Post-approval decision execution allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   IF k='finance_item' THEN
    BEGIN UPDATE public.finance_batch_items SET validation_status='executed' WHERE id=fid; RAISE EXCEPTION 'Post-approval finance execution allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   ELSE
    BEGIN UPDATE public.ai_action_queue SET status='executed' WHERE id=qid; RAISE EXCEPTION 'Post-approval AI execution allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN UPDATE public.ai_action_queue SET payload_approved='{}' WHERE id=qid; RAISE EXCEPTION 'Approved payload tampering allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM public.claim_decision_execution(did,true); RAISE EXCEPTION 'Post-approval claim allowed %',k; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   END IF;
  END LOOP;
  IF k='client_email' THEN
   -- Trusted scheduler keeps working, but only on the prior human-approved snapshot.
   PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
   PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claim.role','service_role',true);
   UPDATE public.ai_action_queue SET scheduled_for=now()-interval '1 minute' WHERE id=qid;
   claim:=public.claim_decision_execution(did,false);
   IF claim->>'token' IS NULL THEN RAISE EXCEPTION 'Trusted scheduled claim failed'; END IF;
   PERFORM public.finish_decision_execution(did,(claim->>'token')::uuid,'{"url":"https://example.invalid/no-email-sent"}',NULL,false);
   IF (SELECT status FROM public.decisions WHERE id=did)<>'executed' THEN RAISE EXCEPTION 'Trusted execution result failed'; END IF;
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',human,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',human::text,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
 END LOOP;
 RAISE NOTICE 'PASS: all three protected kinds; agent, OAuth client_id/azp; RPC/direct writes; post-approval execution; human schedule and trusted scheduler';
END $test$;
-- Exercise actual authenticated RLS: an MCP token using Yorick's identity cannot write approved sources.
SELECT set_config('request.jwt.claims','{"sub":"7f1618c9-9083-4706-bbcc-387c553471e4","role":"authenticated","client_id":"test-mcp-client"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
 UPDATE public.finance_batch_items SET execution_ref='must not persist' WHERE lead_id IN(SELECT id FROM public.leads WHERE lead_code LIKE 'AUTH-ROLLBACK-%') AND validation_status='approved';
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'Finance restrictive RLS bypassed'; END IF;
 UPDATE public.ai_action_queue SET title='must not persist' WHERE lead_id IN(SELECT id FROM public.leads WHERE lead_code LIKE 'AUTH-ROLLBACK-%') AND status='approved';
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'AI restrictive RLS bypassed'; END IF;
 RAISE NOTICE 'PASS: restrictive RLS hides approved AI/finance writes from MCP';
END $$;
RESET ROLE;
ROLLBACK;