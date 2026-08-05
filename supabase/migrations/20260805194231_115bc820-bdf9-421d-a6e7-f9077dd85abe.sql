CREATE POLICY "proposal_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'proposal-images');
CREATE POLICY "proposal_images_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'proposal-images');
CREATE POLICY "proposal_images_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'proposal-images');
CREATE POLICY "proposal_images_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'proposal-images');