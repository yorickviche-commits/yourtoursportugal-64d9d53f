
CREATE TABLE public.travel_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_id text,
  trip_title text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  pax text,
  narrative text,
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  extra_instructions text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read travel_plans" ON public.travel_plans FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert travel_plans" ON public.travel_plans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update travel_plans" ON public.travel_plans FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete travel_plans" ON public.travel_plans FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_travel_plans_updated_at BEFORE UPDATE ON public.travel_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
