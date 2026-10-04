CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_case_insensitive_unique
ON public.suppliers (lower(btrim(name)));

COMMENT ON INDEX public.suppliers_name_case_insensitive_unique IS 'Prevents duplicate FSE supplier names regardless of case or surrounding whitespace.';