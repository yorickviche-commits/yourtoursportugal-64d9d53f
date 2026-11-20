-- Integration regression: run as a privileged database query, never as a migration.
-- All fixtures, deletion effects and queue entries roll back; no production lead is touched.
BEGIN;
DO $test$
DECLARE
  lead uuid := gen_random_uuid();
  run uuid := gen_random_uuid();
  archive_item uuid := gen_random_uuid();
  approval uuid := gen_random_uuid();
  trip uuid := gen_random_uuid();
  relation text;
  remaining bigint;
BEGIN
  INSERT INTO public.leads(id, lead_code, client_name, status, nethunt_stage)
    VALUES (lead, 'DELETE-REGRESSION-' || lead::text, 'Temporary deletion regression', 'lost', 'SALES - Archive');
  INSERT INTO public.workbench_checklist(lead_id, item_key, label, source)
    VALUES (lead, 'regression', 'Temporary regression', 'manual');
  INSERT INTO public.workbench_threads(lead_id, mailbox, gmail_thread_id)
    VALUES (lead, 'sales', 'regression-' || lead::text);
  INSERT INTO public.workbench_alerts(lead_id, side, title, reason)
    VALUES (lead, 'sales', 'Temporary regression', 'Temporary regression');
  INSERT INTO public.workbench_auto_log(lead_id, side, what, created_by_agent)
    VALUES (lead, 'sales', 'Temporary regression', 'regression-test');
  INSERT INTO public.tasks(lead_id, title) VALUES (lead, 'Temporary regression');
  INSERT INTO public.nethunt_archive_runs(id, created_by) VALUES (run, lead);
  INSERT INTO public.nethunt_archive_items(id, run_id, folder_id, kind, source_id, lead_id, payload, payload_sha256, media_status, storage_path, binary_sha256, binary_bytes)
    VALUES (archive_item, run, 'regression', 'records', 'regression', lead, '{"historical":"preserve"}', 'payload-regression-hash', 'copied', 'regression/private-file', 'binary-regression-hash', 123);
  INSERT INTO public.approvals(id, lead_id, title) VALUES (approval, lead, 'Temporary regression');
  INSERT INTO public.trips(id, lead_id, client_name) VALUES (trip, lead, 'Temporary regression');

  DELETE FROM public.leads WHERE id = lead;
  IF EXISTS (SELECT 1 FROM public.leads WHERE id = lead) THEN
    RAISE EXCEPTION 'Lead deletion failed';
  END IF;

  -- Rule: lead-owned Workbench rows and tasks are removed, not left orphaned.
  FOREACH relation IN ARRAY ARRAY['workbench_checklist','workbench_threads','workbench_alerts','workbench_auto_log','tasks'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE lead_id = $1', relation) INTO remaining USING lead;
    IF remaining <> 0 THEN RAISE EXCEPTION '% did not cascade', relation; END IF;
  END LOOP;

  -- Rule: historical payload, identifiers and private binary metadata survive unchanged.
  IF NOT EXISTS (SELECT 1 FROM public.nethunt_archive_items WHERE id = archive_item AND lead_id IS NULL
      AND run_id = run AND source_id = 'regression' AND payload = '{"historical":"preserve"}'::jsonb
      AND payload_sha256 = 'payload-regression-hash' AND media_status = 'copied'
      AND storage_path = 'regression/private-file' AND binary_sha256 = 'binary-regression-hash' AND binary_bytes = 123) THEN
    RAISE EXCEPTION 'Historical archive was deleted or changed';
  END IF;
  -- Rule: approvals remain readable even after their lead is removed.
  IF NOT EXISTS (SELECT 1 FROM public.approvals WHERE id = approval AND lead_id IS NULL AND title = 'Temporary regression') THEN
    RAISE EXCEPTION 'Approval was not preserved';
  END IF;
  -- Rule: existing trips are not silently deleted with a lead.
  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = trip AND lead_id IS NULL AND client_name = 'Temporary regression') THEN
    RAISE EXCEPTION 'Trip was not preserved';
  END IF;
END
$test$;
SELECT 'PASS: cascade, archive payload/binary metadata, approvals and trips' AS regression_result;
ROLLBACK;