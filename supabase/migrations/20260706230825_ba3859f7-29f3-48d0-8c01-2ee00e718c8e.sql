DROP POLICY IF EXISTS "Anon view shared proposals" ON public.proposals;
CREATE POLICY "Anon view shared proposals"
ON public.proposals
FOR SELECT
TO anon
USING (
  public_token IS NOT NULL
  AND status = ANY (ARRAY['draft','sent','approved','revision_requested','viewed']::text[])
);