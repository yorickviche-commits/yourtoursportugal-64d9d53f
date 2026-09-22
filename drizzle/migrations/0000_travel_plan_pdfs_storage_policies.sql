-- Private bucket for server-generated Travel Plan PDFs (MCP export tool).
-- Only internal (authenticated TCC) users may read/write these objects.
CREATE POLICY "Internal users read travel plan pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'travel-plan-pdfs' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users upload travel plan pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'travel-plan-pdfs' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users update travel plan pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'travel-plan-pdfs' AND public.is_internal_user(auth.uid()))
WITH CHECK (bucket_id = 'travel-plan-pdfs' AND public.is_internal_user(auth.uid()));