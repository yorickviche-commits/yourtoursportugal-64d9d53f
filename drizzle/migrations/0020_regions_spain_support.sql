ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'PT';
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE public.regions ADD CONSTRAINT regions_country_chk CHECK (country IN ('PT','ES'));
CREATE UNIQUE INDEX IF NOT EXISTS regions_slug_uidx ON public.regions(slug) WHERE slug IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO authenticated;
GRANT ALL ON public.regions TO service_role;

CREATE TABLE public.region_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.region_destinations TO authenticated;
GRANT ALL ON public.region_destinations TO service_role;
ALTER TABLE public.region_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY rd_read ON public.region_destinations FOR SELECT TO authenticated USING (true);
CREATE POLICY rd_admin ON public.region_destinations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS country text;

CREATE TABLE public.supplier_regions (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, region_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_regions TO authenticated;
GRANT ALL ON public.supplier_regions TO service_role;
ALTER TABLE public.supplier_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_internal ON public.supplier_regions FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can create suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));