CREATE OR REPLACE FUNCTION public.is_sync_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u, public.integration_settings s,
      jsonb_array_elements_text(COALESCE(s.config->'emails','[]'::jsonb)) e
    WHERE u.id = _user_id AND s.name = 'sync_admins' AND lower(trim(e)) = lower(u.email)
  )
$$;
REVOKE ALL ON FUNCTION public.is_sync_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_sync_admin(uuid) TO authenticated, service_role;

CREATE TABLE public.sync_reconcile_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  emailed boolean NOT NULL DEFAULT false,
  error text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_reconcile_runs TO authenticated, service_role;
ALTER TABLE public.sync_reconcile_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync admins read reconcile runs" ON public.sync_reconcile_runs FOR SELECT TO authenticated
  USING (public.is_sync_admin(auth.uid()));

CREATE TABLE public.calendar_migration_items (
  google_event_id text PRIMARY KEY,
  calendar_id text NOT NULL,
  day_date date,
  summary text,
  description text,
  html_link text,
  yt_ref text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  classification text NOT NULL CHECK (classification IN ('linked','no_lead','not_booking')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','linked','approved','skipped','moved')),
  extracted jsonb,
  raw jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_migration_items TO authenticated, service_role;
ALTER TABLE public.calendar_migration_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync admins read migration items" ON public.calendar_migration_items FOR SELECT TO authenticated
  USING (public.is_sync_admin(auth.uid()));
CREATE INDEX calendar_migration_items_status_idx ON public.calendar_migration_items (status, classification, day_date);