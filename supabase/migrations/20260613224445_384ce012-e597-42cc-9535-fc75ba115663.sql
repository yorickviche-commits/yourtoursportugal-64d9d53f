
CREATE TABLE public.lead_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment','refund')),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL CHECK (method IN ('wetravel','bank','cash','other')),
  method_other TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_payments_lead ON public.lead_payments(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_payments TO authenticated;
GRANT ALL ON public.lead_payments TO service_role;
ALTER TABLE public.lead_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read payments" ON public.lead_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert payments" ON public.lead_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update payments" ON public.lead_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete payments" ON public.lead_payments FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_lead_payments_updated_at BEFORE UPDATE ON public.lead_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
