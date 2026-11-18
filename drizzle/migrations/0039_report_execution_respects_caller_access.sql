-- run_report is called directly by the report UI. Keep its existing validated
-- field/operator construction, but never execute it with the owner's privileges.
ALTER FUNCTION public.run_report(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.run_report(jsonb) SET search_path = pg_catalog, public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.run_report(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_report(jsonb) TO authenticated, service_role;

-- Summary reports must not regain elevated privileges through their helper.
-- It was owner-only because run_report previously called it as the owner.
ALTER FUNCTION public.report_exec_summary(text, text, text[], text[], integer) SECURITY INVOKER;
ALTER FUNCTION public.report_exec_summary(text, text, text[], text[], integer) SET search_path = pg_catalog, public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.report_exec_summary(text, text, text[], text[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_exec_summary(text, text, text[], text[], integer) TO authenticated, service_role;