
-- =============================================
-- LEADS TABLE
-- =============================================
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  destination text DEFAULT '',
  travel_dates text DEFAULT '',
  travel_end_date text DEFAULT '',
  number_of_days integer DEFAULT 0,
  dates_type text DEFAULT 'concrete',
  pax integer DEFAULT 2,
  pax_children integer DEFAULT 0,
  pax_infants integer DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'direct',
  budget_level text DEFAULT 'medium',
  sales_owner text DEFAULT '',
  notes text DEFAULT '',
  travel_style jsonb DEFAULT '[]'::jsonb,
  comfort_level text DEFAULT '',
  magic_question text DEFAULT '',
  active_version integer DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read leads"
  ON public.leads FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete leads"
  ON public.leads FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Auto-generate lead_code sequence
CREATE SEQUENCE IF NOT EXISTS lead_code_seq START WITH 4200;

CREATE OR REPLACE FUNCTION public.generate_lead_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_code IS NULL OR NEW.lead_code = '' THEN
    NEW.lead_code := 'YT-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('lead_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_lead_code
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_lead_code();

-- =============================================
-- TRIPS TABLE
-- =============================================
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_code text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  destination text DEFAULT '',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'confirmed',
  sales_owner text DEFAULT '',
  budget_level text DEFAULT 'medium',
  pax integer DEFAULT 2,
  urgency text DEFAULT 'normal',
  total_value numeric DEFAULT 0,
  notes text DEFAULT '',
  has_blocker boolean DEFAULT false,
  blocker_note text DEFAULT '',
  lead_id uuid REFERENCES public.leads(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trips"
  ON public.trips FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete trips"
  ON public.trips FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- APPROVALS TABLE
-- =============================================
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id),
  lead_id uuid REFERENCES public.leads(id),
  client_name text DEFAULT '',
  type text NOT NULL DEFAULT 'itinerary',
  title text NOT NULL DEFAULT '',
  submitted_by text DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  priority text DEFAULT 'normal',
  summary text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  resolved_by text DEFAULT '',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read approvals"
  ON public.approvals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert approvals"
  ON public.approvals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update approvals"
  ON public.approvals FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete approvals"
  ON public.approvals FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- TASKS TABLE
-- =============================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  category text DEFAULT 'general',
  priority text DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  team text DEFAULT '',
  assigned_to text DEFAULT '',
  due_date date,
  trip_id uuid REFERENCES public.trips(id),
  lead_id uuid REFERENCES public.leads(id),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- UPDATE TIMESTAMPS TRIGGER (reusable)
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
