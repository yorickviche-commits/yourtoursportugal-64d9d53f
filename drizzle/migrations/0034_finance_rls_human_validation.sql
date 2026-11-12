CREATE OR REPLACE FUNCTION public.is_finance_human(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND NOT public.is_agent_user(_user_id) AND (public.is_admin(_user_id) OR public.has_role(_user_id,'finance'))
$$;

DROP POLICY IF EXISTS "finance insert ledger" ON public.payments_ledger;
DROP POLICY IF EXISTS "finance update ledger" ON public.payments_ledger;
CREATE POLICY "agents insert ledger" ON public.payments_ledger FOR INSERT TO authenticated WITH CHECK (public.is_agent_user(auth.uid()));
CREATE POLICY "agents update ledger" ON public.payments_ledger FOR UPDATE TO authenticated USING (public.is_agent_user(auth.uid())) WITH CHECK (public.is_agent_user(auth.uid()));

DROP POLICY IF EXISTS "finance insert batch" ON public.finance_batch_items;
DROP POLICY IF EXISTS "finance update batch" ON public.finance_batch_items;
CREATE POLICY "agents insert batch" ON public.finance_batch_items FOR INSERT TO authenticated WITH CHECK (public.is_agent_user(auth.uid()));
CREATE POLICY "agents or validators update batch" ON public.finance_batch_items FOR UPDATE TO authenticated
  USING (public.is_agent_user(auth.uid()) OR public.is_finance_human(auth.uid()))
  WITH CHECK (public.is_agent_user(auth.uid()) OR public.is_finance_human(auth.uid()));

CREATE OR REPLACE FUNCTION public.finance_batch_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  human boolean := public.is_finance_human(auth.uid());
  agent boolean := auth.uid() IS NOT NULL AND public.is_agent_user(auth.uid());
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    IF uid IS NOT NULL AND NEW.validation_status <> 'pending' THEN RAISE EXCEPTION 'Novos itens do lote ficam pendentes'; END IF;
    RETURN NEW;
  END IF;
  IF uid IS NOT NULL AND human THEN
    -- Humanos só validam: apenas estado approved/rejected, validated_by/at e rejection_note.
    IF OLD.validation_status <> 'pending' OR NEW.validation_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Só itens pendentes podem ser aprovados ou rejeitados'; END IF;
    IF (to_jsonb(NEW) - ARRAY['validation_status','validated_by','validated_at','rejection_note','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['validation_status','validated_by','validated_at','rejection_note','updated_at']) THEN
      RAISE EXCEPTION 'A validação só pode alterar estado, validador e nota';
    END IF;
    IF NEW.validation_status = 'rejected' AND coalesce(btrim(NEW.rejection_note),'') = '' THEN RAISE EXCEPTION 'Rejeição exige nota'; END IF;
    NEW.validated_at := now();
    NEW.validated_by := coalesce((SELECT email FROM auth.users WHERE id = uid), uid::text);
    RETURN NEW;
  END IF;
  -- Agentes / service role: nunca validam nem tocam nos campos de validação.
  IF NEW.validated_by IS DISTINCT FROM OLD.validated_by OR NEW.validated_at IS DISTINCT FROM OLD.validated_at OR NEW.rejection_note IS DISTINCT FROM OLD.rejection_note THEN
    RAISE EXCEPTION 'Campos de validação só por utilizador humano';
  END IF;
  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status THEN
    IF NEW.validation_status IN ('executed','failed') AND OLD.validation_status = 'approved' THEN
      NEW.executed_at := coalesce(NEW.executed_at, now());
    ELSE
      RAISE EXCEPTION 'Só um utilizador humano pode aprovar/rejeitar; agentes só executam itens aprovados';
    END IF;
  END IF;
  RETURN NEW;
END $$;