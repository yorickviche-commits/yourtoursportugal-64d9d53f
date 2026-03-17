
-- Make operation_id nullable and add lead_operation_id to booking_emails_log
ALTER TABLE public.booking_emails_log 
  ALTER COLUMN operation_id DROP NOT NULL;

ALTER TABLE public.booking_emails_log 
  ADD COLUMN lead_operation_id uuid REFERENCES public.lead_operations(id) ON DELETE CASCADE;

-- Add check: at least one must be set
ALTER TABLE public.booking_emails_log 
  ADD CONSTRAINT booking_emails_log_at_least_one_ref 
  CHECK (operation_id IS NOT NULL OR lead_operation_id IS NOT NULL);
