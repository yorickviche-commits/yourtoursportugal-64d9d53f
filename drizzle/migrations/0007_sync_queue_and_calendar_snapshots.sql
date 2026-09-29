CREATE TABLE IF NOT EXISTS public.calendar_event_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  day_date date NOT NULL,
  google_event_id text,
  summary text,
  description text,
  color_id text,
  attachments jsonb,
  raw jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_snapshots TO authenticated, service_role;
ALTER TABLE public.calendar_event_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read snapshots" ON public.calendar_event_snapshots FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE INDEX IF NOT EXISTS calendar_event_snapshots_lead_idx ON public.calendar_event_snapshots(lead_id, day_date);

CREATE TABLE IF NOT EXISTS public.sync_queue (
  id bigserial PRIMARY KEY,
  target text NOT NULL CHECK (target IN ('calendar','nethunt')),
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  fields text[] NOT NULL DEFAULT '{}',
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_queue TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sync_queue_id_seq TO authenticated, service_role;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read sync queue" ON public.sync_queue FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE UNIQUE INDEX IF NOT EXISTS sync_queue_active_uniq ON public.sync_queue(target, entity, entity_id) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS sync_queue_pick_idx ON public.sync_queue(target, status, next_attempt_at);

-- Private worker key (no policies: only service_role / security definer functions can read it).
CREATE TABLE IF NOT EXISTS public.sync_worker_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_worker_config TO service_role;
ALTER TABLE public.sync_worker_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_sync_worker_secret()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  SELECT secret INTO v FROM public.sync_worker_config WHERE id = 1;
  IF v IS NULL THEN
    INSERT INTO public.sync_worker_config(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    SELECT secret INTO v FROM public.sync_worker_config WHERE id = 1;
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_sync_worker_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sync_worker_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_sync(p_target text, p_entity text, p_entity_id uuid, p_fields text[] DEFAULT '{}', p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF p_entity_id IS NULL THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_internal_user(auth.uid()) THEN RETURN; END IF;
  UPDATE public.sync_queue
     SET fields = ARRAY(SELECT DISTINCT unnest(fields || COALESCE(p_fields,'{}'))),
         requested_at = now(), reason = COALESCE(p_reason, reason), updated_at = now()
   WHERE target = p_target AND entity = p_entity AND entity_id = p_entity_id AND status = 'pending'
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO public.sync_queue(target, entity, entity_id, fields, reason)
    SELECT p_target, p_entity, p_entity_id, COALESCE(p_fields,'{}'), p_reason
    WHERE NOT EXISTS (SELECT 1 FROM public.sync_queue WHERE target = p_target AND entity = p_entity AND entity_id = p_entity_id AND status = 'pending');
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://jufqscczzmioauzkqztj.supabase.co/functions/v1/sync-worker',
      headers := jsonb_build_object('Content-Type','application/json','x-sync-secret', public.get_sync_worker_secret()),
      body := '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_sync failed: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_sync(text,text,uuid,text[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_sync(text,text,uuid,text[],text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_sync_items(p_target text, p_limit int DEFAULT 20)
RETURNS SETOF public.sync_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.sync_queue q SET status = 'processing', updated_at = now()
   WHERE q.id IN (
     SELECT s.id FROM public.sync_queue s
      WHERE s.target = p_target AND s.status = 'pending'
        AND s.next_attempt_at <= now() AND s.requested_at <= now() - interval '10 seconds'
        AND NOT EXISTS (SELECT 1 FROM public.sync_queue x WHERE x.target = s.target AND x.entity = s.entity AND x.entity_id = s.entity_id AND x.status = 'processing')
      ORDER BY s.requested_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED)
  RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_sync_items(text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sync_items(text,int) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_sync_item(p_id bigint, p_success boolean, p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.sync_queue; v_att int; v_delays int[] := ARRAY[1,2,5,15,60];
BEGIN
  SELECT * INTO r FROM public.sync_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_success THEN
    UPDATE public.sync_queue SET status='done', last_error=NULL, updated_at=now() WHERE id=p_id;
    RETURN false;
  END IF;
  v_att := r.attempts + 1;
  IF v_att >= 5 THEN
    UPDATE public.sync_queue SET status='failed', attempts=v_att, last_error=p_error, updated_at=now() WHERE id=p_id;
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.sync_queue WHERE target=r.target AND entity=r.entity AND entity_id=r.entity_id AND status='pending' AND id<>p_id) THEN
    UPDATE public.sync_queue SET attempts=v_att, last_error=p_error,
           next_attempt_at=GREATEST(next_attempt_at, now() + make_interval(mins => v_delays[v_att])), updated_at=now()
     WHERE target=r.target AND entity=r.entity AND entity_id=r.entity_id AND status='pending' AND id<>p_id;
    UPDATE public.sync_queue SET status='done', attempts=v_att, last_error=p_error, updated_at=now() WHERE id=p_id;
  ELSE
    UPDATE public.sync_queue SET status='pending', attempts=v_att, last_error=p_error,
           next_attempt_at=now() + make_interval(mins => v_delays[v_att]), updated_at=now() WHERE id=p_id;
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_sync_item(bigint,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sync_item(bigint,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_sync_status(p_target text, p_entity_id uuid)
RETURNS TABLE(status text, attempts int, last_error text, requested_at timestamptz, next_attempt_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.status, q.attempts, q.last_error, q.requested_at, q.next_attempt_at, q.updated_at
    FROM public.sync_queue q
   WHERE q.target = p_target AND q.entity_id = p_entity_id AND public.is_internal_user(auth.uid())
   ORDER BY CASE q.status WHEN 'processing' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, q.updated_at DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_sync_status(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sync_status(text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_enqueue_calendar_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead uuid;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'leads' THEN
      IF TG_OP = 'DELETE' THEN v_lead := OLD.id; ELSE v_lead := NEW.id; END IF;
    ELSIF TG_OP = 'DELETE' THEN
      v_lead := OLD.lead_id;
    ELSE
      v_lead := NEW.lead_id;
      IF TG_OP = 'UPDATE' AND OLD.lead_id IS DISTINCT FROM NEW.lead_id AND OLD.lead_id IS NOT NULL THEN
        PERFORM public.enqueue_sync('calendar','lead',OLD.lead_id,'{}',TG_TABLE_NAME);
      END IF;
    END IF;
    PERFORM public.enqueue_sync('calendar','lead',v_lead,'{}',TG_TABLE_NAME||':'||lower(TG_OP));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_enqueue_calendar_lead: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

CREATE TRIGGER leads_enqueue_calendar_ins_del AFTER INSERT OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_calendar_lead();
CREATE TRIGGER leads_enqueue_calendar_upd AFTER UPDATE ON public.leads
  FOR EACH ROW WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR OLD.nethunt_stage IS DISTINCT FROM NEW.nethunt_stage OR
    OLD.travel_dates IS DISTINCT FROM NEW.travel_dates OR OLD.travel_end_date IS DISTINCT FROM NEW.travel_end_date OR
    OLD.trip_start IS DISTINCT FROM NEW.trip_start OR OLD.trip_finish IS DISTINCT FROM NEW.trip_finish OR
    OLD.client_name IS DISTINCT FROM NEW.client_name OR OLD.pax IS DISTINCT FROM NEW.pax OR
    OLD.pax_children IS DISTINCT FROM NEW.pax_children OR OLD.pax_infants IS DISTINCT FROM NEW.pax_infants OR
    OLD.destination IS DISTINCT FROM NEW.destination OR OLD.notes IS DISTINCT FROM NEW.notes OR
    OLD.phone IS DISTINCT FROM NEW.phone OR OLD.email IS DISTINCT FROM NEW.email OR
    OLD.source IS DISTINCT FROM NEW.source OR OLD.yt_id IS DISTINCT FROM NEW.yt_id OR
    OLD.lead_code IS DISTINCT FROM NEW.lead_code OR OLD.active_version IS DISTINCT FROM NEW.active_version OR
    OLD.trip_briefing IS DISTINCT FROM NEW.trip_briefing)
  EXECUTE FUNCTION public.trg_enqueue_calendar_lead();
CREATE TRIGGER lead_operations_enqueue_calendar AFTER INSERT OR UPDATE OR DELETE ON public.lead_operations
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_calendar_lead();
CREATE TRIGGER lead_costing_data_enqueue_calendar AFTER INSERT OR UPDATE OR DELETE ON public.lead_costing_data
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_calendar_lead();
CREATE TRIGGER booking_emails_log_enqueue_calendar AFTER INSERT OR UPDATE OR DELETE ON public.booking_emails_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_calendar_lead();
CREATE TRIGGER proposals_enqueue_calendar AFTER INSERT OR UPDATE OR DELETE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_calendar_lead();