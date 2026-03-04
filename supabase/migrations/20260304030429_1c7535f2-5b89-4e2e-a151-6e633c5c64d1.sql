
-- Add missing fields to cost_items for full costing UI
ALTER TABLE public.cost_items 
  ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS num_adults integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_adults numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'neutro',
  ADD COLUMN IF NOT EXISTS day_number integer NOT NULL DEFAULT 1;

-- Add operational fields to trip_itinerary_items
ALTER TABLE public.trip_itinerary_items
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS num_people integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'nao_pago';

-- Create item_notes table for pencil notes/attachments on both cost items and operations items
CREATE TABLE public.item_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'cost_item' or 'itinerary_item'
  entity_id uuid NOT NULL,
  note_text text,
  attachment_url text,
  attachment_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.item_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage item_notes"
  ON public.item_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_item_notes_entity ON public.item_notes (entity_type, entity_id);
