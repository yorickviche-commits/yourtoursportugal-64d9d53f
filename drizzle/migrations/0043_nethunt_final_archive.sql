CREATE TABLE public.nethunt_archive_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','review_required')),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nethunt_archive_runs TO authenticated, service_role;
ALTER TABLE public.nethunt_archive_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_runs_admin_read ON public.nethunt_archive_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.nethunt_archive_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.nethunt_archive_runs(id),
  folder_id text NOT NULL,
  folder_name text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','verified','error','unsupported')),
  source_count integer,
  archived_count integer,
  digest text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz,
  UNIQUE(run_id, folder_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nethunt_archive_sources TO authenticated, service_role;
ALTER TABLE public.nethunt_archive_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_sources_admin_read ON public.nethunt_archive_sources FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX nethunt_archive_sources_work ON public.nethunt_archive_sources(run_id, status);

CREATE TABLE public.nethunt_archive_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.nethunt_archive_runs(id),
  folder_id text NOT NULL,
  kind text NOT NULL,
  source_id text NOT NULL,
  record_id text,
  lead_id uuid REFERENCES public.leads(id),
  source_time timestamptz,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, folder_id, kind, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nethunt_archive_items TO authenticated, service_role;
ALTER TABLE public.nethunt_archive_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_items_admin_read ON public.nethunt_archive_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX nethunt_archive_items_lead ON public.nethunt_archive_items(lead_id, kind);
COMMENT ON TABLE public.nethunt_archive_items IS 'Independent raw NetHunt snapshot. Preserve source payloads and unmatched records; do not replace operational lead or task values.';