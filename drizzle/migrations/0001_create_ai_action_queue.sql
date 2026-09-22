CREATE TABLE public.ai_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (type IN ('client_email','fse_email','payment_link')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_code text,
  title text NOT NULL,
  subtitle text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','failed')),
  idempotency_key text UNIQUE,
  created_by uuid,
  created_by_label text NOT NULL DEFAULT 'AI agent (MCP)',
  reviewed_by uuid,
  reviewed_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  error text
);

GRANT SELECT, INSERT, UPDATE ON public.ai_action_queue TO authenticated;
GRANT ALL ON public.ai_action_queue TO service_role;

ALTER TABLE public.ai_action_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users read AI action queue"
ON public.ai_action_queue FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users create AI queue items"
ON public.ai_action_queue FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users review AI queue items"
ON public.ai_action_queue FOR UPDATE TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

CREATE INDEX idx_ai_action_queue_status ON public.ai_action_queue (status, created_at DESC);
CREATE INDEX idx_ai_action_queue_lead ON public.ai_action_queue (lead_id, created_at DESC);

CREATE TRIGGER trg_ai_action_queue_updated_at
BEFORE UPDATE ON public.ai_action_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ai_action_queue_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE allowed text[];
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.status <> 'pending' THEN
      RAISE EXCEPTION 'Um item da fila AI so pode nascer em pending (tentado: %)', new.status;
    END IF;
    RETURN new;
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
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
$$;

CREATE TRIGGER trg_ai_action_queue_guard
BEFORE INSERT OR UPDATE ON public.ai_action_queue
FOR EACH ROW EXECUTE FUNCTION public.ai_action_queue_guard();