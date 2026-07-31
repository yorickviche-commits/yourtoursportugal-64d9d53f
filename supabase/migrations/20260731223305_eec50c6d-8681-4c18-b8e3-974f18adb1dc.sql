CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  wetravel_uuid text UNIQUE,
  url text,
  title text NOT NULL,
  trip_ref text,
  start_date date,
  end_date date,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'EUR',
  expires_at timestamptz,
  payment_fees_paid_by text NOT NULL DEFAULT 'participant' CHECK (payment_fees_paid_by IN ('organizer','participant')),
  wetravel_fee_paid_by text NOT NULL DEFAULT 'participant' CHECK (wetravel_fee_paid_by IN ('organizer','participant')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','failed')),
  last_error text,
  idempotency_key text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_links_lead_id_idx ON public.payment_links (lead_id);

GRANT SELECT ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view payment links"
ON public.payment_links FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

CREATE TRIGGER update_payment_links_updated_at
BEFORE UPDATE ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();