GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_services TO authenticated;
GRANT ALL ON public.supplier_services TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_links TO authenticated;
GRANT ALL ON public.supplier_links TO service_role;