DROP POLICY IF EXISTS "Anyone can view supplier files" ON storage.objects;

CREATE POLICY "Internal users can view supplier files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'supplier-files' AND public.is_internal_user(auth.uid()));