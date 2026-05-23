CREATE TABLE IF NOT EXISTS public.used_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  proposal_id uuid NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  photo_id text NOT NULL,
  photo_url text NOT NULL,
  used_in text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_photo_per_lead UNIQUE (lead_id, photo_id),
  CONSTRAINT unique_photo_per_proposal UNIQUE (proposal_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_used_photos_lead ON public.used_photos(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_used_photos_proposal ON public.used_photos(proposal_id) WHERE proposal_id IS NOT NULL;

ALTER TABLE public.used_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage used_photos" ON public.used_photos
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access used_photos" ON public.used_photos
  FOR ALL USING (auth.role() = 'service_role');