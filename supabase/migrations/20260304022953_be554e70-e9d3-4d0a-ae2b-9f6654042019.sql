
-- ═══════════════════════════════════════════════
-- 1. Lead Planner Data (AI-generated travel plans)
-- ═══════════════════════════════════════════════
CREATE TABLE public.lead_planner_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0,
  day_number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  activities jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(lead_id, version, day_number)
);

ALTER TABLE public.lead_planner_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lead_planner_data" ON public.lead_planner_data FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert lead_planner_data" ON public.lead_planner_data FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update lead_planner_data" ON public.lead_planner_data FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete lead_planner_data" ON public.lead_planner_data FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_lead_planner_data_updated_at BEFORE UPDATE ON public.lead_planner_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════
-- 2. Lead Costing Data (AI-generated budgets)
-- ═══════════════════════════════════════════════
CREATE TABLE public.lead_costing_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0,
  day_number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  items jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(lead_id, version, day_number)
);

ALTER TABLE public.lead_costing_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lead_costing_data" ON public.lead_costing_data FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert lead_costing_data" ON public.lead_costing_data FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update lead_costing_data" ON public.lead_costing_data FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete lead_costing_data" ON public.lead_costing_data FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_lead_costing_data_updated_at BEFORE UPDATE ON public.lead_costing_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════
-- 3. Fix Activity Logs RLS — allow any authenticated user to insert
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
