
-- Partners (resellers) table
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  commission_percent NUMERIC DEFAULT 0,
  contract_type TEXT,
  currency TEXT DEFAULT 'EUR',
  payment_terms TEXT,
  territory TEXT,
  cancellation_policy TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  validity_start DATE,
  validity_end DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner services/protocols
CREATE TABLE public.partner_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'private_tour',
  duration TEXT,
  price NUMERIC DEFAULT 0,
  price_unit TEXT DEFAULT 'per_person',
  currency TEXT DEFAULT 'EUR',
  commission_percent NUMERIC DEFAULT 0,
  payment_conditions TEXT,
  cancellation_policy TEXT,
  refund_policy TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  validity_start DATE,
  validity_end DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner files
CREATE TABLE public.partner_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT DEFAULT 'document',
  storage_path TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner links
CREATE TABLE public.partner_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view partners" ON public.partners FOR SELECT USING (true);
CREATE POLICY "Admins and ops can manage partners" ON public.partners FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role)) WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role));

-- RLS for partner_services
ALTER TABLE public.partner_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view partner services" ON public.partner_services FOR SELECT USING (true);
CREATE POLICY "Admins and ops can manage partner services" ON public.partner_services FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role)) WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role));

-- RLS for partner_files
ALTER TABLE public.partner_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view partner files" ON public.partner_files FOR SELECT USING (true);
CREATE POLICY "Admins and ops can manage partner files" ON public.partner_files FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role)) WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role));

-- RLS for partner_links
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view partner links" ON public.partner_links FOR SELECT USING (true);
CREATE POLICY "Admins and ops can manage partner links" ON public.partner_links FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role)) WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role) OR has_role(auth.uid(), 'b2b_manager'::app_role));

-- Storage policy for partner files (reuse supplier-files bucket)
