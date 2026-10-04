CREATE TABLE public.agent_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  mailbox text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_departments TO authenticated;
GRANT ALL ON public.agent_departments TO service_role;
ALTER TABLE public.agent_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read departments" ON public.agent_departments FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "admin write departments" ON public.agent_departments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'ai',
  department_id uuid REFERENCES public.agent_departments(id) ON DELETE SET NULL,
  parent_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  owner_name text,
  backup_name text,
  objective text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read agents" ON public.agents FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "admin write agents" ON public.agents FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  replaces text,
  status text NOT NULL DEFAULT 'novo',
  level_current int NOT NULL DEFAULT 0,
  level_ceiling int NOT NULL DEFAULT 1,
  skill text,
  cadence text,
  human_role text,
  sop_url text,
  tools text[] NOT NULL DEFAULT '{}',
  last_run_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tasks TO authenticated;
GRANT ALL ON public.agent_tasks TO service_role;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read tasks" ON public.agent_tasks FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "admin write tasks" ON public.agent_tasks FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.agent_tasks_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.level_current < 0 OR NEW.level_current > 3 OR NEW.level_ceiling < 0 OR NEW.level_ceiling > 3 THEN
    RAISE EXCEPTION 'Níveis de autonomia vão de N0 a N3';
  END IF;
  IF NEW.level_current > NEW.level_ceiling THEN
    RAISE EXCEPTION 'Nível atual (N%) não pode ultrapassar o teto (N%)', NEW.level_current, NEW.level_ceiling;
  END IF;
  IF NEW.status NOT IN ('ativo','parcial','desenhado','novo','parado') THEN
    RAISE EXCEPTION 'Estado inválido: %', NEW.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER agent_tasks_guard BEFORE INSERT OR UPDATE ON public.agent_tasks FOR EACH ROW EXECUTE FUNCTION public.agent_tasks_guard();

CREATE TABLE public.agent_task_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  tool text NOT NULL,
  access text NOT NULL DEFAULT 'read',
  UNIQUE (task_id, tool)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_task_tools TO authenticated;
GRANT ALL ON public.agent_task_tools TO service_role;
ALTER TABLE public.agent_task_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read task tools" ON public.agent_task_tools FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "admin write task tools" ON public.agent_task_tools FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  task_code text,
  agent_label text,
  tool_name text,
  lead_id uuid,
  lead_code text,
  status text NOT NULL DEFAULT 'running',
  summary text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid DEFAULT auth.uid()
);
CREATE INDEX agent_runs_started_idx ON public.agent_runs (started_at DESC);
CREATE INDEX agent_runs_task_idx ON public.agent_runs (task_code, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read runs" ON public.agent_runs FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "internal insert runs" ON public.agent_runs FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "admin manage runs" ON public.agent_runs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR created_by = auth.uid()) WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;