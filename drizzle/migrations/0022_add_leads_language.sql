ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS language text;
NOTIFY pgrst, 'reload schema';