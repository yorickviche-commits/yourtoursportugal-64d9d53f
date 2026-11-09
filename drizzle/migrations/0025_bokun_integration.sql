ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bokun_confirmation_code text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS leads_bokun_confirmation_code_key ON public.leads (bokun_confirmation_code) WHERE bokun_confirmation_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bokun_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  confirmation_code text,
  event_type text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'recebido',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT bokun_events_status_check CHECK (status IN ('recebido','processado','erro','ignorado'))
);
CREATE INDEX IF NOT EXISTS bokun_events_code_idx ON public.bokun_events (confirmation_code, created_at DESC);
CREATE INDEX IF NOT EXISTS bokun_events_status_idx ON public.bokun_events (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bokun_events TO authenticated;
GRANT ALL ON public.bokun_events TO service_role;
ALTER TABLE public.bokun_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read bokun events" ON public.bokun_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update bokun events" ON public.bokun_events FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));