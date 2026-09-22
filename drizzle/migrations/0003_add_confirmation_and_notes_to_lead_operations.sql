ALTER TABLE public.lead_operations ADD COLUMN IF NOT EXISTS confirmation_number text;
ALTER TABLE public.lead_operations ADD COLUMN IF NOT EXISTS notes text;
COMMENT ON COLUMN public.lead_operations.confirmation_number IS 'Supplier (FSE) booking confirmation reference.';
COMMENT ON COLUMN public.lead_operations.notes IS 'Operational note for this service.';