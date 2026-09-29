CREATE TABLE public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  agent_label text NOT NULL,
  model text,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  daily_call_limit integer NOT NULL DEFAULT 500,
  calls_today integer NOT NULL DEFAULT 0,
  calls_day date NOT NULL DEFAULT current_date,
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  agent_user_id uuid UNIQUE,
  rotated_from uuid REFERENCES public.agent_api_keys(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_api_keys TO authenticated;
GRANT ALL ON public.agent_api_keys TO service_role;
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent keys" ON public.agent_api_keys FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.lead_versions
  ADD COLUMN IF NOT EXISTS is_ai_proposal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposed_by_label text,
  ADD COLUMN IF NOT EXISTS proposed_by_key_id uuid,
  ADD COLUMN IF NOT EXISTS proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS promoted_by uuid,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_agent_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.agent_api_keys WHERE agent_user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.current_agent_key()
RETURNS TABLE(id uuid, name text, agent_label text, model text, scopes text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.name, k.agent_label, k.model, k.scopes
  FROM public.agent_api_keys k
  WHERE k.agent_user_id = auth.uid() AND auth.uid() IS NOT NULL
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.current_agent_key() TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_ai_proposal(p_lead_id uuid, p_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.lead_versions;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid()) OR public.is_agent_user(auth.uid()) THEN
    RAISE EXCEPTION 'Só um utilizador humano da equipa pode tornar uma proposta AI LIVE';
  END IF;
  SELECT * INTO v FROM public.lead_versions WHERE lead_id = p_lead_id AND version = p_version;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Versão % não encontrada', p_version; END IF;
  IF NOT v.is_ai_proposal THEN RAISE EXCEPTION 'A versão V% não é uma proposta AI', p_version; END IF;
  UPDATE public.lead_versions SET is_ai_proposal = false, promoted_by = auth.uid(), promoted_at = now() WHERE id = v.id;
  UPDATE public.leads SET active_version = p_version WHERE id = p_lead_id;
  INSERT INTO public.activity_logs (action_type, entity_type, entity_id, user_id, details)
  VALUES ('ai_proposal_promoted', 'lead', p_lead_id, auth.uid(),
    jsonb_build_object('version', p_version, 'proposed_by', v.proposed_by_label, 'promoted_by', auth.uid()));
END $$;
GRANT EXECUTE ON FUNCTION public.promote_ai_proposal(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ai_action_queue_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE allowed text[];
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.status <> 'pending' THEN
      RAISE EXCEPTION 'Um item da fila AI so pode nascer em pending (tentado: %)', new.status;
    END IF;
    RETURN new;
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
    IF public.is_agent_user(auth.uid()) THEN
      RAISE EXCEPTION 'Agentes AI nao podem aprovar, rejeitar ou executar itens da fila — requer um humano';
    END IF;
    allowed := CASE old.status
      WHEN 'pending'  THEN array['approved','rejected']
      WHEN 'approved' THEN array['executed','failed']
      WHEN 'failed'   THEN array['approved','rejected']
      ELSE array[]::text[]
    END;
    IF NOT (new.status = ANY(allowed)) THEN
      RAISE EXCEPTION 'Transicao invalida na fila AI: % -> %', old.status, new.status;
    END IF;

    IF new.status IN ('approved','rejected') THEN
      IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aprovar ou rejeitar requer um utilizador autenticado (o agente nao se aprova a si proprio)';
      END IF;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    END IF;

    IF new.status = 'executed' AND new.executed_at IS NULL THEN
      new.executed_at := now();
    END IF;
  END IF;

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agent_lead_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_agent_user(auth.uid()) THEN
    IF (new.nethunt_stage IS DISTINCT FROM old.nethunt_stage AND coalesce(new.nethunt_stage,'') ILIKE 'OPERATIONS%')
       OR (new.status IS DISTINCT FROM old.status AND new.status = 'won') THEN
      RAISE EXCEPTION 'Agentes AI nao podem passar uma lead para OPERATIONS — requer um humano';
    END IF;
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER trg_agent_lead_guard BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.agent_lead_guard();

CREATE OR REPLACE FUNCTION public.agent_payment_link_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_agent_user(auth.uid()) THEN
    RAISE EXCEPTION 'Agentes AI nao podem criar links de pagamento — use request_payment_link (fila de aprovacao)';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER trg_agent_payment_link_guard BEFORE INSERT ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.agent_payment_link_guard();