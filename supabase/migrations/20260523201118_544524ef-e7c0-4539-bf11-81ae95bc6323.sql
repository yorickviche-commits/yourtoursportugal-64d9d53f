ALTER TABLE public.booking_emails_log
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS trip_id uuid,
  ADD COLUMN IF NOT EXISTS email_category text;

CREATE INDEX IF NOT EXISTS idx_booking_emails_lead_id ON public.booking_emails_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_booking_emails_trip_id ON public.booking_emails_log(trip_id);
CREATE INDEX IF NOT EXISTS idx_booking_emails_category ON public.booking_emails_log(email_category);