CREATE TABLE IF NOT EXISTS public.fse_sync_state (
  id integer PRIMARY KEY DEFAULT 1,
  change_token text,
  last_full_sync_at timestamptz,
  last_sync_at timestamptz,
  root_folder_id text,
  CONSTRAINT fse_sync_state_singleton CHECK (id = 1)
);

GRANT SELECT ON public.fse_sync_state TO authenticated;
GRANT ALL ON public.fse_sync_state TO service_role;

ALTER TABLE public.fse_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fse sync state"
ON public.fse_sync_state FOR SELECT TO authenticated USING (true);

INSERT INTO public.fse_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;