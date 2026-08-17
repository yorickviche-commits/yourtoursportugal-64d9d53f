ALTER TABLE public.lead_operations ALTER COLUMN booking_status SET DEFAULT 'neutral';
ALTER TABLE public.lead_operations ALTER COLUMN payment_status SET DEFAULT 'neutral';
ALTER TABLE public.lead_operations ALTER COLUMN invoice_status SET DEFAULT 'not_received';

ALTER TABLE public.trip_operations ALTER COLUMN booking_status SET DEFAULT 'neutral';
ALTER TABLE public.trip_operations ALTER COLUMN payment_status SET DEFAULT 'neutral';
ALTER TABLE public.trip_operations ALTER COLUMN invoice_status SET DEFAULT 'not_received';

UPDATE public.lead_operations
SET booking_status = CASE
  WHEN booking_status = 'confirmed' THEN 'booked'
  WHEN booking_status = 'requested' THEN 'sent'
  WHEN booking_status IN ('neutral', 'sent', 'booked') THEN booking_status
  ELSE 'neutral'
END
WHERE booking_status NOT IN ('neutral', 'sent', 'booked');

UPDATE public.lead_operations
SET payment_status = CASE
  WHEN payment_status IN ('neutral', 'paid', 'partially_paid', 'monthly_account', 'guide_to_pay', 'not_paid') THEN payment_status
  ELSE 'neutral'
END
WHERE payment_status NOT IN ('neutral', 'paid', 'partially_paid', 'monthly_account', 'guide_to_pay', 'not_paid');

UPDATE public.lead_operations
SET invoice_status = CASE
  WHEN invoice_status IN ('invoice_received', 'invoice_approved', 'invoice_paid') THEN 'received'
  WHEN invoice_status IN ('not_received', 'guide_pickup', 'received') THEN invoice_status
  ELSE 'not_received'
END
WHERE invoice_status NOT IN ('not_received', 'guide_pickup', 'received');

UPDATE public.trip_operations
SET booking_status = CASE
  WHEN booking_status = 'confirmed' THEN 'booked'
  WHEN booking_status = 'requested' THEN 'sent'
  WHEN booking_status IN ('neutral', 'sent', 'booked') THEN booking_status
  ELSE 'neutral'
END
WHERE booking_status NOT IN ('neutral', 'sent', 'booked');

UPDATE public.trip_operations
SET payment_status = CASE
  WHEN payment_status IN ('neutral', 'paid', 'partially_paid', 'monthly_account', 'guide_to_pay', 'not_paid') THEN payment_status
  ELSE 'neutral'
END
WHERE payment_status NOT IN ('neutral', 'paid', 'partially_paid', 'monthly_account', 'guide_to_pay', 'not_paid');

UPDATE public.trip_operations
SET invoice_status = CASE
  WHEN invoice_status IN ('invoice_received', 'invoice_approved', 'invoice_paid') THEN 'received'
  WHEN invoice_status IN ('not_received', 'guide_pickup', 'received') THEN invoice_status
  ELSE 'not_received'
END
WHERE invoice_status NOT IN ('not_received', 'guide_pickup', 'received');