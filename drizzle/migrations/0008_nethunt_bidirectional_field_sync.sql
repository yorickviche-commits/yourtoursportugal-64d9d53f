ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_value numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_via text;

CREATE TABLE IF NOT EXISTS public.nethunt_field_state (
  entity text NOT NULL CHECK (entity IN ('lead','task')),
  entity_id uuid NOT NULL,
  field text NOT NULL,
  value jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity, entity_id, field)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nethunt_field_state TO authenticated, service_role;
ALTER TABLE public.nethunt_field_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read nethunt field state" ON public.nethunt_field_state FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.nethunt_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  tcc_value jsonb,
  nethunt_value jsonb,
  winner text NOT NULL CHECK (winner IN ('tcc','nethunt')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nethunt_conflicts TO authenticated, service_role;
ALTER TABLE public.nethunt_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read nethunt conflicts" ON public.nethunt_conflicts FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE INDEX IF NOT EXISTS nethunt_conflicts_entity_idx ON public.nethunt_conflicts(entity, entity_id);

-- Live PVP of a lead: pvp_override, else sum of base lines (not 'opcionais'/'eliminar') of the active version.
-- NULL when the lead has no costing lines (then estimated_value is the source).
CREATE OR REPLACE FUNCTION public.lead_live_pvp(p_lead_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH l AS (SELECT id, pvp_override, COALESCE(active_version,0) v FROM public.leads WHERE id = p_lead_id),
  items AS (
    SELECT it FROM public.lead_costing_data c JOIN l ON c.lead_id = l.id AND c.version = l.v,
      LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.items)='array' THEN c.items ELSE '[]'::jsonb END) it
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM items) THEN NULL
    WHEN (SELECT pvp_override FROM l) IS NOT NULL THEN round((SELECT pvp_override FROM l)::numeric, 2)
    ELSE round(COALESCE((SELECT sum(COALESCE(NULLIF(it->>'pvpTotal','')::numeric,0)) FROM items
      WHERE COALESCE(it->>'status','') NOT IN ('opcionais','eliminar')),0), 2)
  END
$$;
REVOKE ALL ON FUNCTION public.lead_live_pvp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_live_pvp(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_enqueue_nethunt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_rid text;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'leads' THEN
      v_id := NEW.id; v_rid := NEW.nethunt_record_id;
      IF v_rid IS NOT NULL THEN PERFORM public.enqueue_sync('nethunt','lead',v_id,'{}','leads:update'); END IF;
    ELSIF TG_TABLE_NAME = 'lead_costing_data' THEN
      IF TG_OP = 'DELETE' THEN v_id := OLD.lead_id; ELSE v_id := NEW.lead_id; END IF;
      IF EXISTS (SELECT 1 FROM public.leads WHERE id = v_id AND nethunt_record_id IS NOT NULL) THEN
        PERFORM public.enqueue_sync('nethunt','lead',v_id,ARRAY['value'],'costing');
      END IF;
    ELSIF TG_TABLE_NAME = 'tasks' THEN
      IF TG_OP = 'DELETE' THEN
        IF OLD.nethunt_record_id IS NOT NULL THEN
          INSERT INTO public.nethunt_field_state(entity, entity_id, field, value, synced_at)
          VALUES ('task', OLD.id, '__deleted', jsonb_build_object('rid', OLD.nethunt_record_id, 'description', OLD.description), now())
          ON CONFLICT (entity, entity_id, field) DO UPDATE SET value = EXCLUDED.value, synced_at = now();
          PERFORM public.enqueue_sync('nethunt','task',OLD.id,ARRAY['__deleted'],'tasks:delete');
        END IF;
      ELSIF NEW.nethunt_record_id IS NOT NULL THEN
        PERFORM public.enqueue_sync('nethunt','task',NEW.id,'{}','tasks:update');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_enqueue_nethunt: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

CREATE TRIGGER leads_enqueue_nethunt AFTER UPDATE ON public.leads
  FOR EACH ROW WHEN (
    OLD.nethunt_stage IS DISTINCT FROM NEW.nethunt_stage OR OLD.status IS DISTINCT FROM NEW.status OR
    OLD.trip_start IS DISTINCT FROM NEW.trip_start OR OLD.trip_finish IS DISTINCT FROM NEW.trip_finish OR
    OLD.close_date IS DISTINCT FROM NEW.close_date OR OLD.client_type IS DISTINCT FROM NEW.client_type OR
    OLD.source IS DISTINCT FROM NEW.source OR OLD.client_name IS DISTINCT FROM NEW.client_name OR
    OLD.estimated_value IS DISTINCT FROM NEW.estimated_value OR OLD.pvp_override IS DISTINCT FROM NEW.pvp_override OR
    OLD.active_version IS DISTINCT FROM NEW.active_version)
  EXECUTE FUNCTION public.trg_enqueue_nethunt();
CREATE TRIGGER lead_costing_data_enqueue_nethunt AFTER INSERT OR UPDATE OR DELETE ON public.lead_costing_data
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_nethunt();
CREATE TRIGGER tasks_enqueue_nethunt_upd AFTER UPDATE ON public.tasks
  FOR EACH ROW WHEN (
    OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description OR
    OLD.priority IS DISTINCT FROM NEW.priority OR OLD.completed IS DISTINCT FROM NEW.completed OR
    OLD.due_at IS DISTINCT FROM NEW.due_at OR OLD.all_day IS DISTINCT FROM NEW.all_day OR
    OLD.assignee_emails IS DISTINCT FROM NEW.assignee_emails)
  EXECUTE FUNCTION public.trg_enqueue_nethunt();
CREATE TRIGGER tasks_enqueue_nethunt_del AFTER DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_nethunt();