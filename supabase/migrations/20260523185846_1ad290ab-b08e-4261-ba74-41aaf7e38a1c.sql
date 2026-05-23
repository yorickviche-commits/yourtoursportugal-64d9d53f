ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS wetravel_trip_uuid    text          NULL,
  ADD COLUMN IF NOT EXISTS wetravel_trip_url     text          NULL,
  ADD COLUMN IF NOT EXISTS wetravel_checkout_url text          NULL,
  ADD COLUMN IF NOT EXISTS total_value_eur       numeric       NULL,
  ADD COLUMN IF NOT EXISTS deposit_amount_eur    numeric       NULL,
  ADD COLUMN IF NOT EXISTS deposit_percent       integer       NOT NULL DEFAULT 50;