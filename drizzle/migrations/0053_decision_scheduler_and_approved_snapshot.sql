DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE oid='public.sync_decision_source(text,jsonb)'::regprocedure; definition:=replace(definition,'prep:=coalesce(p_row->''payload'',''{}'')','prep:=coalesce(nullif(p_row->''payload_approved'',''null''::jsonb),p_row->''payload'',''{}'')'); definition:=replace(definition,'mapped:=CASE ss WHEN','mapped:=CASE WHEN p_table=''ai_action_queue'' AND p_row->>''execution_state''=''cancelled'' THEN ''rejected'' ELSE CASE ss WHEN'); definition:=replace(definition,'ELSE ss END;','ELSE ss END END;'); EXECUTE definition; END $$;
CREATE FUNCTION public.dispatch_scheduled_decisions() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d record; secret text; count_sent integer:=0;
BEGIN
 IF extract(hour from now() AT TIME ZONE 'Europe/Lisbon')<>8 THEN RETURN 0; END IF;
 secret:=public.get_sync_worker_secret(); IF secret IS NULL THEN RETURN 0; END IF;
 FOR d IN SELECT x.id FROM public.decisions x JOIN public.ai_action_queue q ON q.id=x.source_id WHERE x.source_table='ai_action_queue' AND x.status='approved' AND q.type='client_email' AND q.status='approved' AND q.execution_state='scheduled' AND q.scheduled_for<=now() ORDER BY q.scheduled_for LIMIT 500 LOOP
  PERFORM net.http_post(url:='https://jufqscczzmioauzkqztj.supabase.co/functions/v1/execute-decision',headers:=jsonb_build_object('Content-Type','application/json','x-sync-secret',secret),body:=jsonb_build_object('decision_id',d.id,'send_now',false),timeout_milliseconds:=60000); count_sent:=count_sent+1;
 END LOOP;
 RETURN count_sent;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_scheduled_decisions() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.dispatch_scheduled_decisions() TO service_role;
SELECT cron.schedule('cockpit-client-emails-0800','0 7,8 * * *','select public.dispatch_scheduled_decisions();');