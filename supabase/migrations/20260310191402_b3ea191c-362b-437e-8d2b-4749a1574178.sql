
-- Trip Operations table (linked to cost_items)
CREATE TABLE public.trip_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_item_id UUID NOT NULL REFERENCES public.cost_items(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  schedule_time TIME WITHOUT TIME ZONE,
  booking_status TEXT NOT NULL DEFAULT 'not_requested',
  payment_status TEXT NOT NULL DEFAULT 'not_paid',
  invoice_status TEXT NOT NULL DEFAULT 'no_invoice',
  invoice_file_url TEXT,
  invoice_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cost_item_id)
);

ALTER TABLE public.trip_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trip_operations" ON public.trip_operations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert trip_operations" ON public.trip_operations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update trip_operations" ON public.trip_operations FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete trip_operations" ON public.trip_operations FOR DELETE USING (auth.uid() IS NOT NULL);

-- Booking emails log
CREATE TABLE public.booking_emails_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_id UUID NOT NULL REFERENCES public.trip_operations(id) ON DELETE CASCADE,
  supplier_email TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.booking_emails_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read booking_emails_log" ON public.booking_emails_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert booking_emails_log" ON public.booking_emails_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for trip_operations
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_operations;
