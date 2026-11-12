DROP POLICY IF EXISTS sales_agent_runs_read_auth ON public.sales_agent_runs;
CREATE POLICY sales_agent_runs_read_internal ON public.sales_agent_runs FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
DROP POLICY IF EXISTS sales_agent_items_read_auth ON public.sales_agent_items;
CREATE POLICY sales_agent_items_read_internal ON public.sales_agent_items FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));