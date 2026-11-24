ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS title text, ADD COLUMN IF NOT EXISTS start_at timestamptz, ADD COLUMN IF NOT EXISTS end_at timestamptz, ADD COLUMN IF NOT EXISTS location text, ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS html_link text, ADD COLUMN IF NOT EXISTS details_synced_at timestamptz;
ALTER TABLE public.calendar_event_links ADD COLUMN IF NOT EXISTS location text, ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS end_at timestamptz;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE INDEX IF NOT EXISTS leads_client_name_addon_trgm_idx ON public.leads USING gin (client_name public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_email_addon_trgm_idx ON public.leads USING gin (email public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_yt_id_addon_trgm_idx ON public.leads USING gin (yt_id public.gin_trgm_ops);