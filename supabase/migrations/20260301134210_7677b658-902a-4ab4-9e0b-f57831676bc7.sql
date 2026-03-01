
-- System Settings (key-value store for all platform configuration)
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, key)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Permissions table
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  contact_name text,
  contact_email text,
  contact_phone text,
  contract_type text,
  net_rates jsonb DEFAULT '{}',
  commission_structure jsonb DEFAULT '{}',
  validity_start date,
  validity_end date,
  market_pricing jsonb DEFAULT '{}',
  currency text DEFAULT 'EUR',
  cancellation_policy text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and ops can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'operations_agent'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'operations_agent'));

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'activity',
  fixed_cost numeric DEFAULT 0,
  variable_cost_per_pax numeric DEFAULT 0,
  per_day_cost numeric DEFAULT 0,
  guide_allocation jsonb DEFAULT '{}',
  vehicle_allocation jsonb DEFAULT '{}',
  markup_rules jsonb DEFAULT '{}',
  margin_calculation jsonb DEFAULT '{}',
  market_pricing jsonb DEFAULT '{}',
  currency text DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and ops can manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'operations_agent'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'operations_agent'));

-- Integration settings
CREATE TABLE public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  api_key_ref text,
  status text NOT NULL DEFAULT 'inactive',
  last_sync_at timestamptz,
  error_count int DEFAULT 0,
  config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integrations" ON public.integration_settings
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage integrations" ON public.integration_settings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed default system settings
INSERT INTO public.system_settings (category, key, value, description) VALUES
  ('general', 'company_name', '"Your Tours Portugal"', 'Company display name'),
  ('general', 'legal_name', '"Your Tours Portugal Lda"', 'Legal entity name'),
  ('general', 'vat_number', '""', 'VAT/NIF number'),
  ('general', 'address', '""', 'Company address'),
  ('general', 'default_currency', '"EUR"', 'Default currency'),
  ('general', 'default_language', '"pt"', 'Default platform language'),
  ('general', 'timezone', '"Europe/Lisbon"', 'Default timezone'),
  ('pricing', 'default_markup_pct', '30', 'Default markup percentage'),
  ('pricing', 'b2b_commission_pct', '15', 'B2B commission percentage'),
  ('pricing', 'seasonal_adjustment_pct', '0', 'Seasonal price adjustment'),
  ('pricing', 'market_adjustment_pct', '0', 'Market-specific adjustment'),
  ('pricing', 'emergency_override_margin', '10', 'Emergency minimum margin'),
  ('operations', 'minimum_margin_threshold', '25', 'Minimum acceptable margin %'),
  ('operations', 'payment_plan_default', '"30/70"', 'Default payment split'),
  ('operations', 'stripe_fee_pct', '2.9', 'Stripe fee percentage'),
  ('operations', 'vat_rate_default', '23', 'Default VAT rate'),
  ('operations', 'auto_approval_threshold', '500', 'Auto-approve below this EUR value');

-- Seed default integrations
INSERT INTO public.integration_settings (name, status, config) VALUES
  ('wetravel', 'active', '{"description": "Payment & booking platform"}'),
  ('nethunt', 'active', '{"description": "CRM system"}'),
  ('stripe', 'inactive', '{"description": "Payment processing"}'),
  ('email_service', 'inactive', '{"description": "Email sending service"}');

-- Seed default permissions
INSERT INTO public.permissions (role, permission) VALUES
  ('super_admin', 'create_proposal'), ('super_admin', 'approve_proposal'), ('super_admin', 'create_wetravel_draft'),
  ('super_admin', 'edit_pricing'), ('super_admin', 'access_financial_reports'), ('super_admin', 'export_data'),
  ('super_admin', 'modify_settings'), ('super_admin', 'manage_users'),
  ('admin', 'create_proposal'), ('admin', 'approve_proposal'), ('admin', 'create_wetravel_draft'),
  ('admin', 'edit_pricing'), ('admin', 'access_financial_reports'), ('admin', 'export_data'),
  ('admin', 'modify_settings'), ('admin', 'manage_users'),
  ('sales_agent', 'create_proposal'), ('sales_agent', 'export_data'),
  ('operations_agent', 'create_proposal'), ('operations_agent', 'create_wetravel_draft'), ('operations_agent', 'edit_pricing'),
  ('finance', 'access_financial_reports'), ('finance', 'export_data'),
  ('b2b_manager', 'create_proposal'), ('b2b_manager', 'export_data'),
  ('viewer', 'export_data');
