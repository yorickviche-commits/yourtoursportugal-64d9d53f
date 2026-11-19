CREATE TABLE public.crm_saved_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 name text NOT NULL,
 pipeline text NOT NULL DEFAULT 'sales' CHECK (pipeline IN ('sales','operations','all')),
 filters jsonb NOT NULL DEFAULT '{}'::jsonb,
 sort jsonb NOT NULL DEFAULT '{"key":"trip_start","direction":"asc"}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_saved_views TO authenticated;
GRANT ALL ON public.crm_saved_views TO service_role;
ALTER TABLE public.crm_saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their CRM views" ON public.crm_saved_views FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX crm_saved_views_user_idx ON public.crm_saved_views(user_id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;
UPDATE public.leads l SET stage_changed_at = COALESCE((SELECT max(t.event_time) FROM public.nethunt_timeline t WHERE (t.lead_id = l.id OR (t.lead_id IS NULL AND t.nethunt_record_id = l.nethunt_record_id)) AND t.event_type = 'field_change' AND t.payload->'fieldActions' ? 'Stage'), l.updated_at, l.created_at, now()) WHERE l.stage_changed_at IS NULL;
ALTER TABLE public.leads ALTER COLUMN stage_changed_at SET DEFAULT now();
CREATE FUNCTION public.crm_stamp_stage_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' OR NEW.nethunt_stage IS DISTINCT FROM OLD.nethunt_stage THEN
  NEW.stage_changed_at := now();
 END IF;
 RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_stamp_stage_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER crm_stage_changed_at BEFORE INSERT OR UPDATE OF nethunt_stage ON public.leads FOR EACH ROW EXECUTE FUNCTION public.crm_stamp_stage_change();
COMMENT ON COLUMN public.leads.stage_changed_at IS 'Actual entry time into nethunt_stage; historical backfill uses the latest Stage field_change, with updated_at fallback.';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
 END IF;
END $$;