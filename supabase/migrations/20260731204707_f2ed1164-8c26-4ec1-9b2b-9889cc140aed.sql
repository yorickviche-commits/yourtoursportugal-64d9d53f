CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.magpie_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  magpie_id text NOT NULL UNIQUE,
  version_id text,
  internal_id text,
  name text NOT NULL,
  account_id text,
  account_name text,
  summary text,
  description text,
  long_description text,
  additional_info text,
  category text,
  location text,
  currency text,
  language text,
  timezone text,
  duration_text text,
  duration_type text,
  duration_from numeric,
  duration_to numeric,
  duration_unit text,
  min_pax integer,
  max_pax integer,
  max_group_size integer,
  multiday boolean,
  private boolean,
  confirmation_required boolean,
  redemption_type text,
  guide_type text,
  trip_difficulty text,
  cancellation_policy text,
  cancellation_cutoff text,
  cancellation_notes text,
  terms_and_conditions text,
  voucher_info text,
  booking_cutoff text,
  valid_for text,
  start_date date,
  end_date date,
  retail_rate_adult numeric,
  retail_rate_youth numeric,
  retail_rate_child numeric,
  retail_rate_infant numeric,
  retail_rate_senior numeric,
  highlights jsonb NOT NULL DEFAULT '[]',
  included jsonb NOT NULL DEFAULT '[]',
  excluded jsonb NOT NULL DEFAULT '[]',
  before_booking jsonb NOT NULL DEFAULT '[]',
  before_arrival jsonb NOT NULL DEFAULT '[]',
  restrictions jsonb NOT NULL DEFAULT '[]',
  addresses jsonb NOT NULL DEFAULT '[]',
  commentaries jsonb NOT NULL DEFAULT '[]',
  opening_hours jsonb NOT NULL DEFAULT '{}',
  health_items jsonb NOT NULL DEFAULT '[]',
  images jsonb NOT NULL DEFAULT '[]',
  accessibility jsonb NOT NULL DEFAULT '{}',
  raw_payload jsonb NOT NULL,
  availability_status text NOT NULL DEFAULT 'available',
  imported_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'ok',
  sync_error text
);

GRANT SELECT ON public.magpie_products TO authenticated;
GRANT ALL ON public.magpie_products TO service_role;
ALTER TABLE public.magpie_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users can view magpie products"
  ON public.magpie_products FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE INDEX idx_magpie_products_category ON public.magpie_products (category);
CREATE INDEX idx_magpie_products_location ON public.magpie_products (location);
CREATE INDEX idx_magpie_products_availability ON public.magpie_products (availability_status);
CREATE INDEX idx_magpie_products_name_trgm ON public.magpie_products USING gin (name gin_trgm_ops);

CREATE TABLE public.product_local (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  magpie_id text NOT NULL UNIQUE REFERENCES public.magpie_products(magpie_id) ON DELETE CASCADE,
  workflow_status text NOT NULL DEFAULT 'draft',
  is_visible boolean NOT NULL DEFAULT false,
  internal_tags text[] NOT NULL DEFAULT '{}',
  commercial_notes text,
  custom_title text,
  custom_summary text,
  sort_weight integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_local TO authenticated;
GRANT ALL ON public.product_local TO service_role;
ALTER TABLE public.product_local ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users can view product_local"
  ON public.product_local FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));
CREATE POLICY "Internal users can insert product_local"
  ON public.product_local FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "Internal users can update product_local"
  ON public.product_local FOR UPDATE TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "Admins can delete product_local"
  ON public.product_local FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_product_local_updated_at
  BEFORE UPDATE ON public.product_local
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.magpie_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  products_requested integer NOT NULL DEFAULT 0,
  products_succeeded integer NOT NULL DEFAULT 0,
  products_failed integer NOT NULL DEFAULT 0,
  http_status integer,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'
);

GRANT SELECT ON public.magpie_sync_log TO authenticated;
GRANT ALL ON public.magpie_sync_log TO service_role;
ALTER TABLE public.magpie_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users can view sync log"
  ON public.magpie_sync_log FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE INDEX idx_magpie_sync_log_started_at ON public.magpie_sync_log (started_at DESC);