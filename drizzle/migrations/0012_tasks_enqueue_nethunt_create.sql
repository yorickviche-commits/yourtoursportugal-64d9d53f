CREATE OR REPLACE FUNCTION public.trg_enqueue_nethunt_task_create()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.nethunt_record_id IS NULL AND NEW.lead_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.leads WHERE id = NEW.lead_id AND nethunt_record_id IS NOT NULL) THEN
      PERFORM public.enqueue_sync('nethunt','task',NEW.id,ARRAY['__create'],
        CASE WHEN TG_OP = 'INSERT' THEN 'tasks:insert' ELSE 'tasks:lead_linked' END);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_enqueue_nethunt_task_create: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_enqueue_nethunt_task_create() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_enqueue_nethunt_ins AFTER INSERT ON public.tasks
  FOR EACH ROW WHEN (NEW.nethunt_record_id IS NULL AND NEW.lead_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_enqueue_nethunt_task_create();

CREATE TRIGGER tasks_enqueue_nethunt_lead_linked AFTER UPDATE OF lead_id ON public.tasks
  FOR EACH ROW WHEN (NEW.nethunt_record_id IS NULL AND NEW.lead_id IS NOT NULL AND OLD.lead_id IS DISTINCT FROM NEW.lead_id)
  EXECUTE FUNCTION public.trg_enqueue_nethunt_task_create();