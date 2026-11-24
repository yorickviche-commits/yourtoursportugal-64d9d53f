-- Database integration rules: execute as a privileged query, never a migration.
-- Every fixture and state change is rolled back. No source row is deleted.
BEGIN;
DO $test$
DECLARE
 lid uuid:=gen_random_uuid(); payment_id uuid:=gen_random_uuid(); email_id uuid:=gen_random_uuid();
 op_id uuid:=gen_random_uuid(); task_a uuid:=gen_random_uuid(); task_b uuid:=gen_random_uuid(); orphan uuid:=gen_random_uuid();
 datedless uuid:=gen_random_uuid(); did uuid; payment_did uuid; email_did uuid;
 d public.decisions; result jsonb; today date:=(now() AT TIME ZONE 'Europe/Lisbon')::date;
 uid uuid:='7f1618c9-9083-4706-bbcc-387c553471e4';
BEGIN
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 IF NOT public.is_admin(uid) THEN RAISE EXCEPTION 'Test requires authorized admin'; END IF;
 INSERT INTO public.leads(id,lead_code,client_name,status,trip_start,trip_finish)
 VALUES(lid,'DECISION-REGRESSION-'||lid,'Transactional decision test','new',today+45,today+47);
 INSERT INTO public.ai_action_queue(id,type,lead_id,title,payload) VALUES(payment_id,'payment_link',lid,'Payment rule regression',jsonb_build_object('amount_eur',100,'currency','EUR'));
 SELECT decision_id INTO payment_did FROM public.decision_sources WHERE source_id=payment_id;
 IF payment_did IS NULL THEN RAISE EXCEPTION 'AI pending must enter queue'; END IF;

 -- The first run is simulation, even with a stale lead.
 UPDATE public.decisions_control SET auto_close_enabled=false WHERE singleton;
 UPDATE public.leads SET trip_finish=today-1 WHERE id=lid;
 SELECT * INTO d FROM public.decisions WHERE id=payment_did;
 IF d.candidate_rule<>'trip_past' OR d.status<>'open' THEN RAISE EXCEPTION 'Past trip should be a candidate only in simulation'; END IF;
 IF (SELECT status FROM public.ai_action_queue WHERE id=payment_id)<>'pending' THEN RAISE EXCEPTION 'Simulation mutated source'; END IF;
 UPDATE public.leads SET trip_finish=today WHERE id=lid;
 SELECT * INTO d FROM public.decisions WHERE id=payment_did;
 IF d.candidate_rule IS NOT NULL THEN RAISE EXCEPTION 'Today is not past in Lisbon'; END IF;
 UPDATE public.leads SET trip_finish=today+47,status='lost' WHERE id=lid;
 IF (SELECT candidate_rule FROM public.decisions WHERE id=payment_did)<>'lead_inactive' THEN RAISE EXCEPTION 'Lost file candidate missing'; END IF;
 UPDATE public.leads SET status='new' WHERE id=lid;

 -- A legacy end date must win over an already-past canonical start.
 UPDATE public.leads SET trip_start=today-2,trip_finish=NULL,travel_end_date=(today+2)::text WHERE id=lid;
 IF (SELECT candidate_rule FROM public.decisions WHERE id=payment_did) IS NOT NULL THEN RAISE EXCEPTION 'Ongoing legacy trip incorrectly considered past'; END IF;
 UPDATE public.leads SET trip_start=today+45,trip_finish=today+47,travel_end_date=NULL WHERE id=lid;

 -- Only received money counts. Two mirrors of the same 60 EUR cannot cover 100 EUR.
 INSERT INTO public.payments_ledger(lead_id,amount_gross,status) VALUES(lid,60,'requested');
 IF (SELECT candidate_rule FROM public.decisions WHERE id=payment_did) IS NOT NULL THEN RAISE EXCEPTION 'Requested money counted as paid'; END IF;
 UPDATE public.payments_ledger SET status='paid_channel' WHERE lead_id=lid;
 INSERT INTO public.lead_payments(lead_id,amount,method) VALUES(lid,60,'bank');
 IF (SELECT candidate_rule FROM public.decisions WHERE id=payment_did) IS NOT NULL THEN RAISE EXCEPTION 'Payment mirrors were double counted'; END IF;
 UPDATE public.lead_payments SET amount=100 WHERE lead_id=lid;
 IF (SELECT candidate_rule FROM public.decisions WHERE id=payment_did)<>'payment_received' THEN RAISE EXCEPTION 'Equal payment did not satisfy rule'; END IF;
 INSERT INTO public.lead_payments(lead_id,amount,kind,method) VALUES(lid,100,'refund','bank');
 IF (SELECT candidate_rule FROM public.decisions WHERE id=payment_did) IS NOT NULL THEN RAISE EXCEPTION 'Refund was ignored'; END IF;

 -- Exact FSE operation, not an unrelated supplier line.
 INSERT INTO public.lead_operations(id,lead_id,item_key,booking_status) VALUES(op_id,lid,'regression-operation','neutral');
 INSERT INTO public.ai_action_queue(id,type,lead_id,title,payload) VALUES(email_id,'fse_email',lid,'FSE regression',jsonb_build_object('to','regression@example.invalid','operation_id',op_id));
 SELECT decision_id INTO email_did FROM public.decision_sources WHERE source_id=email_id;
 IF (SELECT candidate_rule FROM public.decisions WHERE id=email_did) IS NOT NULL THEN RAISE EXCEPTION 'Unsent operation closed email'; END IF;
 UPDATE public.lead_operations SET booking_status='sent' WHERE id=op_id;
 IF (SELECT candidate_rule FROM public.decisions WHERE id=email_did)<>'fse_sent' THEN RAISE EXCEPTION 'Sent operation was not detected'; END IF;
 UPDATE public.lead_operations SET booking_status='booked' WHERE id=op_id;
 IF (SELECT candidate_rule FROM public.decisions WHERE id=email_did)<>'fse_sent' THEN RAISE EXCEPTION 'Booked operation was not detected'; END IF;

 -- Legacy undated/orphan noise never enters the index.
 INSERT INTO public.tasks(id,title,nethunt_record_id) VALUES(orphan,'Orphan legacy test','regression-only');
 INSERT INTO public.tasks(id,title,lead_id) VALUES(datedless,'Undated task test',lid);
 IF EXISTS(SELECT 1 FROM public.decision_sources WHERE source_id IN (orphan,datedless)) THEN RAISE EXCEPTION 'Orphan or undated task entered queue'; END IF;
 INSERT INTO public.tasks(id,title,lead_id,due_date) VALUES(task_a,'Duplicate task regression',lid,today+1),(task_b,'Duplicate task regression',lid,today+1);
 SELECT decision_id INTO did FROM public.decision_sources WHERE source_id=task_a;
 IF did IS NULL OR (SELECT decision_id FROM public.decision_sources WHERE source_id=task_b)<>did THEN RAISE EXCEPTION 'Identical cards were not deduplicated'; END IF;
 PERFORM public.decision_action(did,'snooze',NULL,now()+interval '3 days');
 IF (SELECT status FROM public.decisions WHERE id=did)<>'snoozed' THEN RAISE EXCEPTION 'Snooze failed'; END IF;
 UPDATE public.decisions SET snooze_until=now()-interval '1 minute' WHERE id=did;
 PERFORM public.reconcile_decisions();
 IF (SELECT status FROM public.decisions WHERE id=did)<>'open' THEN RAISE EXCEPTION 'Expired snooze did not resume'; END IF;
 PERFORM public.decision_action(did,'approve');
 IF (SELECT count(*) FROM public.tasks WHERE id IN (task_a,task_b) AND completed)<>2 THEN RAISE EXCEPTION 'Review did not update both preserved sources'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.decision_events WHERE decision_id=did AND action='approve' AND actor_id=uid) THEN RAISE EXCEPTION 'Human review attribution missing'; END IF;

 -- Human activation closes index only, and reopen survives the next run.
 result:=public.activate_decision_auto_close();
 IF (SELECT status FROM public.decisions WHERE id=email_did)<>'auto_closed' THEN RAISE EXCEPTION 'Activation failed to close candidate'; END IF;
 IF (SELECT status FROM public.ai_action_queue WHERE id=email_id)<>'pending' THEN RAISE EXCEPTION 'Cleanup approved/rejected/executed a source'; END IF;
 PERFORM public.decision_action(email_did,'reopen');
 PERFORM public.reconcile_decisions();
 IF (SELECT status FROM public.decisions WHERE id=email_did)<>'open' THEN RAISE EXCEPTION 'Reopen immediately closed itself'; END IF;
 IF (SELECT count(*) FROM public.tasks WHERE id IN (orphan,datedless,task_a,task_b))<>4 THEN RAISE EXCEPTION 'A source was deleted'; END IF;
END $test$;
SELECT 'PASS: simulation, dates, loss, payments, refunds, FSE, noise exclusion, dedupe, snooze, human review, activation, reopen and preservation' AS result;
ROLLBACK;