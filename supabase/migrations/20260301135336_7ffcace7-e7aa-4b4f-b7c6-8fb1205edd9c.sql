
-- Supplier services/protocols table
CREATE TABLE public.supplier_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'activity',
  duration TEXT,
  price NUMERIC DEFAULT 0,
  price_unit TEXT DEFAULT 'per_person',
  currency TEXT DEFAULT 'EUR',
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

-- Supplier files table
CREATE TABLE public.supplier_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT DEFAULT 'document',
  storage_path TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplier links table
CREATE TABLE public.supplier_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for supplier_services
ALTER TABLE public.supplier_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view services" ON public.supplier_services FOR SELECT USING (true);
CREATE POLICY "Admins and ops can manage services" ON public.supplier_services FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role)) WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role));

-- RLS for supplier_files
ALTER TABLE public.supplier_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view files" ON public.supplier_files FOR SELECT USING (true);
CREATE POLICY "Admins and ops can manage files" ON public.supplier_files FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role)) WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role));

-- RLS for supplier_links
ALTER TABLE public.supplier_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view links" ON public.supplier_links FOR SELECT USING (true);
CREATE POLICY "Admins and ops can manage links" ON public.supplier_links FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role)) WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role));

-- Storage bucket for supplier files
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-files', 'supplier-files', true);

CREATE POLICY "Authenticated can upload supplier files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'supplier-files' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view supplier files" ON storage.objects FOR SELECT USING (bucket_id = 'supplier-files');
CREATE POLICY "Admins can delete supplier files" ON storage.objects FOR DELETE USING (bucket_id = 'supplier-files' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));
