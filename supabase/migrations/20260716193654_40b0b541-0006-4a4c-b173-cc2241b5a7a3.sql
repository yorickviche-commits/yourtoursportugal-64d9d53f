
CREATE POLICY "Internal users can read lead-context files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lead-context' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can upload lead-context files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lead-context' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update lead-context files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'lead-context' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can delete lead-context files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lead-context' AND public.is_internal_user(auth.uid()));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS route_map_path text,
  ADD COLUMN IF NOT EXISTS exact_itinerary_pdf_path text;
