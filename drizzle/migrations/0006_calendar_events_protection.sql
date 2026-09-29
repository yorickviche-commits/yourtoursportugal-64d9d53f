ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS google_etag text,
  ADD COLUMN IF NOT EXISTS google_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_edit_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS protection_status text NOT NULL DEFAULT 'ok';
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_protection_status_chk CHECK (protection_status IN ('ok','manual_edit','orphan'));