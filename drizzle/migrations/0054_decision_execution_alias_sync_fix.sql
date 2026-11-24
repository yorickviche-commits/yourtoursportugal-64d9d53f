CREATE OR REPLACE FUNCTION public.decisions_event_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event_payload jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; did uuid;
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP<>'DELETE' AND TG_TABLE_NAME IN ('ai_action_queue','workbench_alerts','finance_batch_items','tasks') THEN
  PERFORM public.sync_decision_source(TG_TABLE_NAME,event_payload);
  IF TG_TABLE_NAME='ai_action_queue' AND event_payload->>'status' IN ('executed','failed') THEN
   SELECT decision_id INTO did FROM public.decision_sources WHERE source_table=TG_TABLE_NAME AND source_id=(event_payload->>'id')::uuid;
   UPDATE public.ai_action_queue q SET status=event_payload->>'status',result=event_payload->'result',error=event_payload->>'error',executed_at=(event_payload->>'executed_at')::timestamptz,execution_state=event_payload->>'execution_state',retry_safe=coalesce((event_payload->>'retry_safe')::boolean,true) WHERE q.status='approved' AND q.id<>(event_payload->>'id')::uuid AND EXISTS(SELECT 1 FROM public.decision_sources s WHERE s.decision_id=did AND s.source_table='ai_action_queue' AND s.source_id=q.id);
  END IF;
 END IF;
 PERFORM public.reconcile_decisions(); RETURN coalesce(NEW,OLD);
END $$;