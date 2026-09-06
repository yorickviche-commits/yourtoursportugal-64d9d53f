DROP VIEW IF EXISTS public.platform_feedback_public;

CREATE OR REPLACE FUNCTION public.list_public_feedback()
RETURNS TABLE (
  id uuid,
  ref text,
  type public.feedback_type,
  title text,
  module text,
  status public.feedback_status,
  severity public.feedback_severity,
  created_at timestamptz,
  reported_by uuid,
  votes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.ref, f.type, f.title, f.module, f.status, f.severity, f.created_at, f.reported_by,
         (SELECT count(*) FROM public.platform_feedback_votes v WHERE v.feedback_id = f.id) AS votes
  FROM public.platform_feedback f
  WHERE auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.list_public_feedback() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_feedback() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_view_feedback(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_feedback(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.feedback_is_new(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feedback_is_new(uuid) TO authenticated, service_role;