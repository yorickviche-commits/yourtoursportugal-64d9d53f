
CREATE TABLE public.lead_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  day_number INTEGER NOT NULL DEFAULT 1,
  schedule_time TIME WITHOUT TIME ZONE,
  booking_status TEXT NOT NULL DEFAULT 'not_requested',
  payment_status TEXT NOT NULL DEFAULT 'not_paid',
  invoice_status TEXT NOT NULL DEFAULT 'no_invoice',
  invoice_file_url TEXT,
  invoice_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, item_key)
);

ALTER TABLE public.lead_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lead_operations" ON public.lead_operations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert lead_operations" ON public.lead_operations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update lead_operations" ON public.lead_operations FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete lead_operations" ON public.lead_operations FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_operations;
