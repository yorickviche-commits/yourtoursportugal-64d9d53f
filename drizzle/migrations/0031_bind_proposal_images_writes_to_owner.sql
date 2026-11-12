DROP POLICY IF EXISTS proposal_images_auth_update ON storage.objects;
DROP POLICY IF EXISTS proposal_images_auth_delete ON storage.objects;
CREATE POLICY proposal_images_auth_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'proposal-images' AND (owner_id = (select auth.uid()::text) OR public.is_admin((select auth.uid()))))
WITH CHECK (bucket_id = 'proposal-images' AND (owner_id = (select auth.uid()::text) OR public.is_admin((select auth.uid()))));
CREATE POLICY proposal_images_auth_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'proposal-images' AND (owner_id = (select auth.uid()::text) OR public.is_admin((select auth.uid()))));