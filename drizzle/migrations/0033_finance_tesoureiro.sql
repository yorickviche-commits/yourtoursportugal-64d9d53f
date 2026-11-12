CREATE TYPE public.payment_channel AS ENUM ('wetravel','fareharbor_stripe','bokun','viator','getyourguide','transfer_b2b','other');
CREATE TYPE public.payment_kind AS ENUM ('deposit','balance','full','addon','refund');
CREATE TYPE public.payment_ledger_status AS ENUM ('requested','paid_channel','invoiced','bank_received','receipt_issued','reconciled','exception');
CREATE TYPE public.finance_action AS ENUM ('issue_proforma','issue_fa','issue_rc','register_payment','mark_exception');
CREATE TYPE public.finance_validation AS ENUM ('pending','approved','rejected','executed','failed');

CREATE OR REPLACE FUNCTION public.can_use_finance(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id) OR public.has_role(_user_id,'finance') OR public.is_agent_user(_user_id)
$$;

CREATE TABLE public.payments_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  yt_ref text, channel public.payment_channel NOT NULL DEFAULT 'other', payer_name text,
  amount_gross numeric NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'EUR',
  payment_type public.payment_kind NOT NULL DEFAULT 'full',
  status public.payment_ledger_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz, paid_channel_at timestamptz, bank_date date, invoiced_at timestamptz, receipt_at timestamptz, reconciled_at timestamptz,
  proforma_ref text, optitravel_file text, fa_number text, rc_number text,
  channel_evidence_url text, bank_line_ref text, payout_ref text,
  notes text, exception_reason text, created_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_ledger_yt_ref_idx ON public.payments_ledger(yt_ref);
CREATE INDEX payments_ledger_status_idx ON public.payments_ledger(status);
CREATE INDEX payments_ledger_bank_date_idx ON public.payments_ledger(bank_date);
CREATE INDEX payments_ledger_lead_idx ON public.payments_ledger(lead_id);
GRANT SELECT, INSERT, UPDATE ON public.payments_ledger TO authenticated;
GRANT ALL ON public.payments_ledger TO service_role;
ALTER TABLE public.payments_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read ledger" ON public.payments_ledger FOR SELECT TO authenticated USING (public.can_use_finance(auth.uid()));
CREATE POLICY "finance insert ledger" ON public.payments_ledger FOR INSERT TO authenticated WITH CHECK (public.can_use_finance(auth.uid()));
CREATE POLICY "finance update ledger" ON public.payments_ledger FOR UPDATE TO authenticated USING (public.can_use_finance(auth.uid())) WITH CHECK (public.can_use_finance(auth.uid()));

CREATE TABLE public.finance_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Lisbon')::date),
  payment_id uuid REFERENCES public.payments_ledger(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  yt_ref text, action public.finance_action NOT NULL,
  proposed_payload jsonb NOT NULL DEFAULT '{}'::jsonb, evidence_urls text[] NOT NULL DEFAULT '{}',
  validation_status public.finance_validation NOT NULL DEFAULT 'pending',
  validated_by text, validated_at timestamptz, rejection_note text,
  executed_at timestamptz, execution_ref text, created_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_batch_date_idx ON public.finance_batch_items(batch_date, validation_status);
GRANT SELECT, INSERT, UPDATE ON public.finance_batch_items TO authenticated;
GRANT ALL ON public.finance_batch_items TO service_role;
ALTER TABLE public.finance_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read batch" ON public.finance_batch_items FOR SELECT TO authenticated USING (public.can_use_finance(auth.uid()));
CREATE POLICY "finance insert batch" ON public.finance_batch_items FOR INSERT TO authenticated WITH CHECK (public.can_use_finance(auth.uid()));
CREATE POLICY "finance update batch" ON public.finance_batch_items FOR UPDATE TO authenticated USING (public.can_use_finance(auth.uid())) WITH CHECK (public.can_use_finance(auth.uid()));

CREATE OR REPLACE FUNCTION public.finance_batch_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE human boolean := auth.uid() IS NOT NULL AND NOT public.is_agent_user(auth.uid()) AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance'));
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    IF NEW.validation_status <> 'pending' AND NOT human AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Novos itens do lote ficam pendentes'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status THEN
    IF NEW.validation_status IN ('approved','rejected') THEN
      IF OLD.validation_status <> 'pending' THEN RAISE EXCEPTION 'Só itens pendentes podem ser validados'; END IF;
      IF auth.uid() IS NOT NULL AND NOT human THEN RAISE EXCEPTION 'Só um utilizador humano pode validar itens financeiros'; END IF;
      NEW.validated_at := now();
    ELSIF NEW.validation_status IN ('executed','failed') THEN
      IF OLD.validation_status <> 'approved' THEN RAISE EXCEPTION 'Só itens aprovados podem ser executados'; END IF;
      NEW.executed_at := coalesce(NEW.executed_at, now());
    ELSE RAISE EXCEPTION 'Transição inválida';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_batch_guard BEFORE INSERT OR UPDATE ON public.finance_batch_items FOR EACH ROW EXECUTE FUNCTION public.finance_batch_guard();

CREATE OR REPLACE FUNCTION public.touch_updated_at_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER payments_ledger_touch BEFORE UPDATE ON public.payments_ledger FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_ledger();