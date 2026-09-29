ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS service_language text, ADD COLUMN IF NOT EXISTS booking_origin text, ADD COLUMN IF NOT EXISTS external_booking_ref text;
ALTER TABLE public.lead_operations ADD COLUMN IF NOT EXISTS schedule_end_time time;

CREATE TABLE IF NOT EXISTS public.lead_day_ops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  guide_name text, vehicle text, vehicle_pickup text,
  pickup_time time, pickup_location text, pickup_maps_url text,
  dropoff_location text, dropoff_maps_url text,
  notes_backoffice text, notes_guide text, guide_payment_amount numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  UNIQUE (lead_id, day_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_day_ops TO authenticated, service_role;
ALTER TABLE public.lead_day_ops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users manage day ops" ON public.lead_day_ops FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

CREATE TRIGGER lead_day_ops_enqueue_calendar AFTER INSERT OR UPDATE OR DELETE ON public.lead_day_ops
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_calendar_lead();

CREATE TRIGGER leads_enqueue_calendar_upd_ops AFTER UPDATE ON public.leads
  FOR EACH ROW WHEN (
    OLD.service_language IS DISTINCT FROM NEW.service_language OR
    OLD.booking_origin IS DISTINCT FROM NEW.booking_origin OR
    OLD.external_booking_ref IS DISTINCT FROM NEW.external_booking_ref OR
    OLD.partner_id IS DISTINCT FROM NEW.partner_id)
  EXECUTE FUNCTION public.trg_enqueue_calendar_lead();

INSERT INTO public.integration_settings (name, config)
SELECT 'calendar_colors', '{"por_confirmar":"5","parcial":"6","confirmado":"9","ok":"10","cancelado":"8"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.integration_settings WHERE name = 'calendar_colors');