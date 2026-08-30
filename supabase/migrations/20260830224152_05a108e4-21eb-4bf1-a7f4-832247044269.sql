CREATE TABLE public.lead_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT 'V0',
  general_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (lead_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_versions TO authenticated;
GRANT ALL ON public.lead_versions TO service_role;

ALTER TABLE public.lead_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users read lead_versions" ON public.lead_versions
  FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "Internal users insert lead_versions" ON public.lead_versions
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "Internal users update lead_versions" ON public.lead_versions
  FOR UPDATE TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "Internal users delete lead_versions" ON public.lead_versions
  FOR DELETE TO authenticated USING (public.is_internal_user(auth.uid()));

CREATE TRIGGER trg_lead_versions_updated
  BEFORE UPDATE ON public.lead_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lead_versions_lead ON public.lead_versions(lead_id, version);

-- travel_plans versioning
ALTER TABLE public.travel_plans ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

UPDATE public.travel_plans tp
SET version = COALESCE(l.active_version, 0)
FROM public.leads l
WHERE tp.lead_id = l.id;

CREATE INDEX IF NOT EXISTS idx_travel_plans_lead_version ON public.travel_plans(lead_id, version);

-- Backfill lead_versions from existing data
INSERT INTO public.lead_versions (lead_id, version, name, general_data)
SELECT v.lead_id, v.version, 'V' || v.version::text,
  CASE WHEN v.version = COALESCE(l.active_version, 0) THEN
    jsonb_build_object(
      'yt_id', l.yt_id, 'client_name', l.client_name, 'email', l.email, 'phone', l.phone,
      'client_type', l.client_type, 'destination', l.destination,
      'travel_dates', l.travel_dates, 'travel_end_date', l.travel_end_date,
      'number_of_days', l.number_of_days, 'dates_type', l.dates_type,
      'pax', l.pax, 'pax_children', l.pax_children, 'pax_infants', l.pax_infants,
      'budget_level', l.budget_level, 'notes', l.notes, 'sales_owner', l.sales_owner,
      'status', l.status, 'comfort_level', l.comfort_level,
      'travel_style', COALESCE(to_jsonb(l.travel_style), '[]'::jsonb), 'source', l.source
    )
  ELSE '{}'::jsonb END
FROM (
  SELECT lead_id, version FROM public.lead_planner_data
  UNION
  SELECT lead_id, version FROM public.lead_costing_data
  UNION
  SELECT id AS lead_id, COALESCE(active_version, 0) AS version FROM public.leads
) v
JOIN public.leads l ON l.id = v.lead_id
ON CONFLICT (lead_id, version) DO NOTHING;