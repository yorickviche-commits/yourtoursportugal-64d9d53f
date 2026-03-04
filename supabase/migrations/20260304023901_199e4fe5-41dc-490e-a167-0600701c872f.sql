
-- ============================================
-- SECTION A: NEW TABLES (cost_items, contacts, documents, trip_itinerary_items)
-- ============================================

-- 1. trip_itinerary_items: per-trip itinerary (separate from lead itineraries)
CREATE TABLE public.trip_itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  title text NOT NULL DEFAULT '',
  description text,
  location text,
  start_time time,
  end_time time,
  notes text,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_itinerary_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trip_itinerary_items" ON public.trip_itinerary_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert trip_itinerary_items" ON public.trip_itinerary_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update trip_itinerary_items" ON public.trip_itinerary_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete trip_itinerary_items" ON public.trip_itinerary_items FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_trip_itinerary_items_updated_at BEFORE UPDATE ON public.trip_itinerary_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. cost_items
CREATE TABLE public.cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('accommodation','transport','guide','meals','activity','entrance','other')) DEFAULT 'other',
  description text NOT NULL DEFAULT '',
  supplier text,
  unit_cost numeric NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1,
  margin_percent numeric DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (unit_cost * quantity * (1 + margin_percent / 100)) STORED,
  notes text,
  currency text DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cost_items" ON public.cost_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert cost_items" ON public.cost_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update cost_items" ON public.cost_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete cost_items" ON public.cost_items FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_cost_items_updated_at BEFORE UPDATE ON public.cost_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text,
  phone text,
  role text CHECK (role IN ('primary','secondary','agent','partner')) DEFAULT 'primary',
  company text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contacts" ON public.contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update contacts" ON public.contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete contacts" ON public.contacts FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('lead','trip','approval','task')),
  entity_id uuid NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read documents" ON public.documents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update documents" ON public.documents FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete documents" ON public.documents FOR DELETE USING (auth.uid() IS NOT NULL);

-- Indexes on activity_logs (already exists, add indexes)
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
