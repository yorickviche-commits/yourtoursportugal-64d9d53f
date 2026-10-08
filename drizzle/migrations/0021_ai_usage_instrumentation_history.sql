CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text UNIQUE,
  source text NOT NULL CHECK (source = ANY (ARRAY['tcc_edge','claude_mcp','claude_scheduled','claude_chrome','claude_chat','claude_cowork','other'])),
  surface text,
  agent_label text,
  actor_email text,
  provider text,
  model text,
  lead_code text,
  status text NOT NULL DEFAULT 'running' CHECK (status = ANY (ARRAY['running','ok','error','abandoned'])),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  calls integer NOT NULL DEFAULT 1,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric(12,6),
  summary text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_events_started_idx ON public.ai_usage_events (started_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_status_idx ON public.ai_usage_events (status) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS ai_usage_events_source_idx ON public.ai_usage_events (source, started_at DESC);
GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_usage_events' AND policyname='internal team reads ai usage') THEN
    CREATE POLICY "internal team reads ai usage" ON public.ai_usage_events FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ai_usage_heartbeat(p_session_key text, p_source text, p_surface text DEFAULT NULL, p_agent_label text DEFAULT NULL, p_status text DEFAULT 'running', p_summary text DEFAULT NULL, p_lead_code text DEFAULT NULL, p_provider text DEFAULT NULL, p_model text DEFAULT NULL, p_actor_email text DEFAULT NULL, p_calls_inc integer DEFAULT 0, p_input_tokens bigint DEFAULT NULL, p_output_tokens bigint DEFAULT NULL, p_cost_usd numeric DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  insert into ai_usage_events as e (session_key, source, surface, agent_label, status, summary, lead_code, provider, model, actor_email, calls, input_tokens, output_tokens, cost_usd, meta, ended_at)
  values (p_session_key, p_source, p_surface, p_agent_label, p_status, p_summary, p_lead_code, p_provider, p_model, p_actor_email, greatest(p_calls_inc,1), p_input_tokens, p_output_tokens, p_cost_usd, coalesce(p_meta,'{}'::jsonb), case when p_status <> 'running' then now() end)
  on conflict (session_key) do update set
    status = excluded.status,
    last_heartbeat_at = now(),
    ended_at = case when excluded.status <> 'running' then now() else null end,
    summary = coalesce(excluded.summary, e.summary),
    surface = coalesce(excluded.surface, e.surface),
    agent_label = coalesce(excluded.agent_label, e.agent_label),
    lead_code = coalesce(excluded.lead_code, e.lead_code),
    provider = coalesce(excluded.provider, e.provider),
    model = coalesce(excluded.model, e.model),
    calls = e.calls + coalesce(p_calls_inc,0),
    input_tokens = case when p_input_tokens is null then e.input_tokens else coalesce(e.input_tokens,0) + p_input_tokens end,
    output_tokens = case when p_output_tokens is null then e.output_tokens else coalesce(e.output_tokens,0) + p_output_tokens end,
    cost_usd = case when p_cost_usd is null then e.cost_usd else coalesce(e.cost_usd,0) + p_cost_usd end,
    meta = e.meta || coalesce(excluded.meta,'{}'::jsonb)
  returning id into v_id;
  return v_id;
end $function$;
REVOKE EXECUTE ON FUNCTION public.ai_usage_heartbeat(text,text,text,text,text,text,text,text,text,text,integer,bigint,bigint,numeric,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_heartbeat(text,text,text,text,text,text,text,text,text,text,integer,bigint,bigint,numeric,jsonb) TO service_role;

CREATE OR REPLACE VIEW public.v_ai_usage WITH (security_invoker = true) AS
SELECT id, session_key, source, surface, agent_label, actor_email, provider, model, lead_code, status,
  started_at, last_heartbeat_at, ended_at, calls, input_tokens, output_tokens, cost_usd, summary, meta, created_at,
  CASE WHEN status = 'running' AND last_heartbeat_at < now() - interval '20 minutes' THEN 'stale' ELSE status END AS live_status,
  EXTRACT(epoch FROM COALESCE(ended_at, last_heartbeat_at) - started_at)::integer AS duration_s
FROM public.ai_usage_events e;
GRANT SELECT ON public.v_ai_usage TO authenticated, service_role;