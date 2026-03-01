
ALTER TABLE public.supplier_services 
  ADD COLUMN IF NOT EXISTS price_child numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_conditions text DEFAULT NULL;

ALTER TABLE public.partner_services 
  ADD COLUMN IF NOT EXISTS price_child numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_conditions text DEFAULT NULL;
