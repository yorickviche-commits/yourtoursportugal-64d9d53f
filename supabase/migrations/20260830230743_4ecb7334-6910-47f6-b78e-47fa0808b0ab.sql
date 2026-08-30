ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

UPDATE public.proposals p
SET version = COALESCE(l.active_version, 0)
FROM public.leads l
WHERE p.lead_id = l.id;

-- Deduplicate any pre-existing (lead_id, version) collisions, keeping the newest row.
DELETE FROM public.proposals p
USING public.proposals q
WHERE p.lead_id IS NOT NULL
  AND p.lead_id = q.lead_id
  AND p.version = q.version
  AND (p.created_at, p.id) < (q.created_at, q.id);

CREATE UNIQUE INDEX IF NOT EXISTS proposals_lead_version_key
  ON public.proposals (lead_id, version)
  WHERE lead_id IS NOT NULL;