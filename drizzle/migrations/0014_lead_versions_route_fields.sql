ALTER TABLE public.lead_versions
  ADD COLUMN IF NOT EXISTS route_map_url text,
  ADD COLUMN IF NOT EXISTS route_day_maps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS route_map_path text,
  ADD COLUMN IF NOT EXISTS exact_itinerary_pdf_path text,
  ADD COLUMN IF NOT EXISTS pvp_override numeric;

INSERT INTO public.lead_versions (lead_id, version, name, general_data, route_map_url, route_day_maps, route_map_path, exact_itinerary_pdf_path, pvp_override)
SELECT l.id, COALESCE(l.active_version, 0), 'V' || COALESCE(l.active_version, 0), '{}'::jsonb,
       l.route_map_url, COALESCE(l.route_day_maps, '[]'::jsonb), l.route_map_path, l.exact_itinerary_pdf_path, l.pvp_override
FROM public.leads l
ON CONFLICT (lead_id, version) DO UPDATE SET
  route_map_url = EXCLUDED.route_map_url,
  route_day_maps = EXCLUDED.route_day_maps,
  route_map_path = EXCLUDED.route_map_path,
  exact_itinerary_pdf_path = EXCLUDED.exact_itinerary_pdf_path,
  pvp_override = EXCLUDED.pvp_override;

COMMENT ON COLUMN public.leads.route_day_maps IS 'Mirror of the LIVE version (lead_versions.route_day_maps is the source of truth per version)';