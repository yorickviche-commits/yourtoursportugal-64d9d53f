ALTER TABLE public.booking_emails_log DROP CONSTRAINT IF EXISTS booking_emails_log_at_least_one_ref;
ALTER TABLE public.booking_emails_log ADD CONSTRAINT booking_emails_log_at_least_one_ref
  CHECK (operation_id IS NOT NULL OR lead_operation_id IS NOT NULL OR lead_id IS NOT NULL OR trip_id IS NOT NULL);