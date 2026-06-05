
CREATE TABLE public.fse_drive_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id text NOT NULL UNIQUE,
  parent_drive_id text,
  name text NOT NULL,
  mime_type text NOT NULL,
  category text,
  region text,
  supplier_name text,
  path text,
  web_view_link text,
  depth int NOT NULL DEFAULT 0,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fse_drive_category ON public.fse_drive_index(category);
CREATE INDEX idx_fse_drive_supplier ON public.fse_drive_index(supplier_name);
GRANT SELECT ON public.fse_drive_index TO authenticated;
GRANT ALL ON public.fse_drive_index TO service_role;
ALTER TABLE public.fse_drive_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read fse_drive_index" ON public.fse_drive_index FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage fse_drive_index" ON public.fse_drive_index FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
