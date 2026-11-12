DROP POLICY IF EXISTS auth_read_regions ON public.regions;
CREATE POLICY auth_read_regions ON public.regions FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
DROP POLICY IF EXISTS auth_read_stage_codes ON public.nethunt_stage_codes;
CREATE POLICY auth_read_stage_codes ON public.nethunt_stage_codes FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
DROP POLICY IF EXISTS rd_read ON public.region_destinations;
CREATE POLICY rd_read ON public.region_destinations FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can upload supplier files" ON storage.objects;
CREATE POLICY "Authenticated can upload supplier files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-files' AND owner_id = (select auth.uid()::text) AND public.is_internal_user(auth.uid()));
DROP POLICY IF EXISTS proposal_images_auth_insert ON storage.objects;
CREATE POLICY proposal_images_auth_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposal-images' AND owner_id = (select auth.uid()::text) AND public.is_internal_user(auth.uid()));