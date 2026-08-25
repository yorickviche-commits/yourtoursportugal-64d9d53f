CREATE TABLE public.ops_bookings (
  id text PRIMARY KEY,
  client_name text NOT NULL,
  product text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'deposit_received',
  departure_date date,
  pax integer NOT NULL DEFAULT 0,
  language text NOT NULL DEFAULT 'EN',
  days_in_stage integer NOT NULL DEFAULT 0,
  last_contact_days integer NOT NULL DEFAULT 0,
  missing jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_bookings TO authenticated;
GRANT ALL ON public.ops_bookings TO service_role;
ALTER TABLE public.ops_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_bookings_auth_all" ON public.ops_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ops_actions (
  id text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES public.ops_bookings(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'deposit_received',
  deadline_label text NOT NULL DEFAULT '',
  deadline_iso timestamptz,
  state text NOT NULL DEFAULT 'pending',
  priority_score integer NOT NULL DEFAULT 0,
  primary_label text NOT NULL DEFAULT '',
  secondary_label text NOT NULL DEFAULT '',
  draft_subject text NOT NULL DEFAULT '',
  draft_body text NOT NULL DEFAULT '',
  recipient text NOT NULL DEFAULT '',
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_actions TO authenticated;
GRANT ALL ON public.ops_actions TO service_role;
ALTER TABLE public.ops_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_actions_auth_all" ON public.ops_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX ops_actions_booking_idx ON public.ops_actions(booking_id);
CREATE INDEX ops_bookings_stage_idx ON public.ops_bookings(stage);

CREATE TRIGGER ops_bookings_updated_at BEFORE UPDATE ON public.ops_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ops_actions_updated_at BEFORE UPDATE ON public.ops_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();