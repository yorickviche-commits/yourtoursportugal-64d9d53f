CREATE OR REPLACE FUNCTION public.nethunt_push_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT CASE WHEN jsonb_typeof(value)='boolean' THEN value::text::boolean
                               WHEN jsonb_typeof(value)='string' THEN (value #>> '{}') IN ('true','1','on')
                               ELSE true END
                   FROM public.system_settings WHERE key='nethunt_push_enabled' LIMIT 1), true)
$$;
REVOKE EXECUTE ON FUNCTION public.nethunt_push_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nethunt_push_enabled() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_enqueue_nethunt()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_rid text;
BEGIN
  BEGIN
    IF NOT public.nethunt_push_enabled() THEN RETURN NULL; END IF;
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
$function$;