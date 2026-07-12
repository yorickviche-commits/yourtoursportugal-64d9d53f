
-- Mapping table: one row per (lead, day) -> Google Calendar event
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  google_event_id text,
  last_synced_at timestamptz,
  last_payload_hash text,
  status text,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, day_date)
);

CREATE INDEX idx_calendar_events_lead_id ON public.calendar_events(lead_id);
CREATE INDEX idx_calendar_events_day_date ON public.calendar_events(day_date);

GRANT SELECT ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Internal users can read all mappings (needed to render sync badges)
CREATE POLICY "Internal users can view calendar events"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

-- All writes happen from the edge function (service_role); block direct client writes.

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
