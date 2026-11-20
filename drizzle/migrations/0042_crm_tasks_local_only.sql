DROP TRIGGER IF EXISTS tasks_enqueue_nethunt_ins ON public.tasks;
DROP TRIGGER IF EXISTS tasks_enqueue_nethunt_lead_linked ON public.tasks;
DROP TRIGGER IF EXISTS tasks_enqueue_nethunt_upd ON public.tasks;
DROP TRIGGER IF EXISTS tasks_enqueue_nethunt_del ON public.tasks;
COMMENT ON TABLE public.tasks IS 'TCC native tasks. Local create/update/complete/delete do not enqueue NetHunt writes; historical NetHunt identifiers are retained.';