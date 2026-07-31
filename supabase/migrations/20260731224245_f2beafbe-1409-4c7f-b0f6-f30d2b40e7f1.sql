ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS participant_fees text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS days_before_departure integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_cents integer,
  ADD COLUMN IF NOT EXISTS installments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allow_auto_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_partial_payment boolean NOT NULL DEFAULT false;