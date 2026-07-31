ALTER TABLE public.lead_operations
  ADD COLUMN IF NOT EXISTS activity_title text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS pax integer,
  ADD COLUMN IF NOT EXISTS net_value numeric,
  ADD COLUMN IF NOT EXISTS real_cost numeric,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'planner';