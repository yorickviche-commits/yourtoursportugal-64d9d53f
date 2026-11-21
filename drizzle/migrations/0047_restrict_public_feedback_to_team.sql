CREATE OR REPLACE FUNCTION public.list_public_feedback()
 RETURNS TABLE(id uuid, ref text, type feedback_type, title text, module text, status feedback_status, severity feedback_severity, created_at timestamp with time zone, reported_by uuid, votes bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT f.id, f.ref, f.type, f.title, f.module, f.status, f.severity, f.created_at, f.reported_by,
         (SELECT count(*) FROM public.platform_feedback_votes v WHERE v.feedback_id = f.id) AS votes
  FROM public.platform_feedback f
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid())
$function$;
REVOKE ALL ON FUNCTION public.list_public_feedback() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_feedback() TO authenticated, service_role;