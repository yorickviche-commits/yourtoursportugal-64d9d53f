
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_agents uuid[] NOT NULL DEFAULT '{}'::uuid[];
CREATE INDEX IF NOT EXISTS leads_assigned_agents_gin ON public.leads USING gin (assigned_agents);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Backfill assigned_agents from created_by when empty
UPDATE public.leads SET assigned_agents = ARRAY[created_by]::uuid[] WHERE (assigned_agents IS NULL OR array_length(assigned_agents,1) IS NULL) AND created_by IS NOT NULL;
