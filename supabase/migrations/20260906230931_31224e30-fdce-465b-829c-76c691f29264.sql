-- ─── ENUMS ──────────────────────────────────────────────────────────────────
CREATE TYPE public.feedback_type     AS ENUM ('bug','improvement','suggestion');
CREATE TYPE public.feedback_severity AS ENUM ('blocker','high','medium','low');
CREATE TYPE public.feedback_status   AS ENUM ('new','triaged','in_progress','in_review','done','wont_fix','duplicate');
CREATE TYPE public.feedback_priority AS ENUM ('p0','p1','p2','p3');

-- ─── AGENT NOTIFICATIONS (in-app, com destinatário opcional) ────────────────
CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('alert','info','warning','action_required')),
  priority      text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  title         text NOT NULL,
  body          text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  entity_ref    text,
  agent_name    text NOT NULL DEFAULT 'spark',
  read_at       timestamptz,
  dismissed_at  timestamptz,
  metadata      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS agent_notifications_user_idx ON public.agent_notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_notifications TO authenticated;
GRANT ALL ON public.agent_notifications TO service_role;
ALTER TABLE public.agent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications visible to team or recipient"
  ON public.agent_notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "team can update visible notifications"
  ON public.agent_notifications FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "admins can insert notifications"
  ON public.agent_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- ─── PLATFORM FEEDBACK ──────────────────────────────────────────────────────
CREATE SEQUENCE public.platform_feedback_ref_seq START 1;

CREATE TABLE public.platform_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text UNIQUE,
  type             public.feedback_type NOT NULL,
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  description      text NOT NULL,
  severity         public.feedback_severity,
  module           text NOT NULL,
  page_url         text NOT NULL,
  page_route       text NOT NULL,
  page_title       text,
  lead_ref         text,
  user_agent       text,
  browser          text,
  os               text,
  screen           text,
  viewport         text,
  app_version      text,
  locale           text,
  timezone         text,
  reported_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name    text,
  reporter_email   text,
  reporter_roles   text[],
  video_url        text CHECK (video_url IS NULL OR video_url ~* '^https?://'),
  status           public.feedback_status NOT NULL DEFAULT 'new',
  priority         public.feedback_priority,
  assignee_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  duplicate_of     uuid REFERENCES public.platform_feedback(id) ON DELETE SET NULL,
  target_release   text,
  effort           text CHECK (effort IS NULL OR effort IN ('xs','s','m','l','xl')),
  tags             text[] NOT NULL DEFAULT '{}',
  resolution_note  text,
  resolved_at      timestamptz,
  triaged_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_feedback_status_idx     ON public.platform_feedback (status);
CREATE INDEX platform_feedback_type_idx       ON public.platform_feedback (type);
CREATE INDEX platform_feedback_module_idx     ON public.platform_feedback (module);
CREATE INDEX platform_feedback_reporter_idx   ON public.platform_feedback (reported_by);
CREATE INDEX platform_feedback_created_idx    ON public.platform_feedback (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_feedback TO authenticated;
GRANT ALL ON public.platform_feedback TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_feedback_ref_seq TO authenticated, service_role;

-- ─── SATÉLITES ──────────────────────────────────────────────────────────────
CREATE TABLE public.platform_feedback_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id   uuid NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    integer NOT NULL,
  width         integer,
  height        integer,
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_feedback_attachments_fk_idx ON public.platform_feedback_attachments (feedback_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_feedback_attachments TO authenticated;
GRANT ALL ON public.platform_feedback_attachments TO service_role;

CREATE TABLE public.platform_feedback_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id   uuid NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name   text,
  body          text NOT NULL,
  is_internal   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_feedback_comments_fk_idx ON public.platform_feedback_comments (feedback_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_feedback_comments TO authenticated;
GRANT ALL ON public.platform_feedback_comments TO service_role;

CREATE TABLE public.platform_feedback_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id   uuid NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name    text,
  event_type    text NOT NULL,
  from_value    text,
  to_value      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_feedback_events_fk_idx ON public.platform_feedback_events (feedback_id, created_at);
GRANT SELECT ON public.platform_feedback_events TO authenticated;
GRANT ALL ON public.platform_feedback_events TO service_role;

CREATE TABLE public.platform_feedback_votes (
  feedback_id   uuid NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.platform_feedback_votes TO authenticated;
GRANT ALL ON public.platform_feedback_votes TO service_role;

-- ─── HELPER: pode ver o feedback? ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_view_feedback(_feedback_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_feedback f
    WHERE f.id = _feedback_id
      AND (f.reported_by = auth.uid() OR public.is_admin(auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.feedback_is_new(_feedback_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_feedback f WHERE f.id = _feedback_id AND f.status = 'new'
  )
$$;

-- ─── TRIGGERS ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_feedback_defaults() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ref IS NULL OR NEW.ref = '' THEN
    NEW.ref := 'FB-' || lpad(nextval('public.platform_feedback_ref_seq')::text, 4, '0');
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    NEW.status      := 'new';
    NEW.priority    := NULL;
    NEW.assignee_id := NULL;
    NEW.resolved_at := NULL;
    NEW.triaged_at  := NULL;
  END IF;

  IF NEW.type <> 'bug' THEN
    NEW.severity := NULL;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_feedback_defaults BEFORE INSERT ON public.platform_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_feedback_defaults();

CREATE TRIGGER trg_feedback_updated_at BEFORE UPDATE ON public.platform_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- timestamps de ciclo de vida (BEFORE UPDATE)
CREATE OR REPLACE FUNCTION public.feedback_lifecycle_stamps() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'triaged' AND NEW.triaged_at IS NULL THEN
      NEW.triaged_at := now();
    END IF;
    IF NEW.status IN ('done','wont_fix','duplicate') THEN
      IF NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    ELSE
      NEW.resolved_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_feedback_lifecycle BEFORE UPDATE ON public.platform_feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_lifecycle_stamps();

-- eventos + notificações (AFTER)
CREATE OR REPLACE FUNCTION public.feedback_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  INSERT INTO public.platform_feedback_events (feedback_id, actor_id, actor_name, event_type, to_value)
  VALUES (NEW.id, NEW.reported_by, NEW.reporter_name, 'created', NEW.type::text);

  IF NEW.severity = 'blocker' THEN
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'super_admin' LOOP
      INSERT INTO public.agent_notifications (user_id, type, priority, title, body, entity_type, entity_id, entity_ref, agent_name, metadata)
      VALUES (r.user_id, 'alert', 'urgent',
              'Bug bloqueante ' || NEW.ref,
              NEW.title,
              'platform_feedback', NEW.id, NEW.ref, 'Feedback Hub',
              jsonb_build_object('module', NEW.module, 'reported_by', NEW.reported_by));
    END LOOP;
  END IF;

  RETURN NULL;
END $$;

CREATE TRIGGER trg_feedback_after_insert AFTER INSERT ON public.platform_feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_after_insert();

CREATE OR REPLACE FUNCTION public.feedback_after_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_name text;
  v_label      text;
BEGIN
  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.platform_feedback_events (feedback_id, actor_id, actor_name, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), v_actor_name,
            CASE
              WHEN NEW.status IN ('done','wont_fix','duplicate') THEN 'resolved'
              WHEN OLD.status IN ('done','wont_fix','duplicate') THEN 'reopened'
              ELSE 'status_changed'
            END,
            OLD.status::text, NEW.status::text);

    IF NEW.status IN ('done','wont_fix','duplicate') AND NEW.reported_by IS NOT NULL THEN
      v_label := CASE NEW.status
        WHEN 'done'      THEN 'resolvido'
        WHEN 'wont_fix'  THEN 'fechado sem alteração'
        ELSE 'marcado como duplicado' END;
      INSERT INTO public.agent_notifications (user_id, type, priority, title, body, entity_type, entity_id, entity_ref, agent_name, metadata)
      VALUES (NEW.reported_by, 'info', 'medium',
              'O teu reporte ' || NEW.ref || ' foi ' || v_label,
              coalesce(NEW.resolution_note, NEW.title),
              'platform_feedback', NEW.id, NEW.ref, 'Feedback Hub',
              jsonb_build_object('user_id', NEW.reported_by, 'status', NEW.status::text));
    END IF;
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.platform_feedback_events (feedback_id, actor_id, actor_name, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), v_actor_name, 'priority_changed', OLD.priority::text, NEW.priority::text);
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.platform_feedback_events (feedback_id, actor_id, actor_name, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), v_actor_name, 'assigned', OLD.assignee_id::text, NEW.assignee_id::text);
  END IF;

  IF NEW.duplicate_of IS DISTINCT FROM OLD.duplicate_of THEN
    INSERT INTO public.platform_feedback_events (feedback_id, actor_id, actor_name, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), v_actor_name, 'marked_duplicate', OLD.duplicate_of::text, NEW.duplicate_of::text);
  END IF;

  RETURN NULL;
END $$;

CREATE TRIGGER trg_feedback_after_update AFTER UPDATE ON public.platform_feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_after_update();

-- comentário → evento
CREATE OR REPLACE FUNCTION public.feedback_comment_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.platform_feedback_events (feedback_id, actor_id, actor_name, event_type, to_value)
  VALUES (NEW.feedback_id, NEW.author_id, NEW.author_name, 'commented',
          CASE WHEN NEW.is_internal THEN 'internal' ELSE 'public' END);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_feedback_comment_event AFTER INSERT ON public.platform_feedback_comments
  FOR EACH ROW EXECUTE FUNCTION public.feedback_comment_event();

-- anexo → evento
CREATE OR REPLACE FUNCTION public.feedback_attachment_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.platform_feedback_events (feedback_id, actor_id, event_type, to_value)
  VALUES (NEW.feedback_id, NEW.uploaded_by, 'attachment_added', NEW.file_name);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_feedback_attachment_event AFTER INSERT ON public.platform_feedback_attachments
  FOR EACH ROW EXECUTE FUNCTION public.feedback_attachment_event();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_feedback             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback_votes       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback readable by reporter or admin"
  ON public.platform_feedback FOR SELECT TO authenticated
  USING (reported_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "feedback insert own"
  ON public.platform_feedback FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "feedback update admin"
  ON public.platform_feedback FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "feedback update own while new"
  ON public.platform_feedback FOR UPDATE TO authenticated
  USING (reported_by = auth.uid() AND status = 'new')
  WITH CHECK (reported_by = auth.uid() AND status = 'new');

CREATE POLICY "feedback delete super admin"
  ON public.platform_feedback FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "attachments readable with parent"
  ON public.platform_feedback_attachments FOR SELECT TO authenticated
  USING (public.can_view_feedback(feedback_id));

CREATE POLICY "attachments insert own"
  ON public.platform_feedback_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.can_view_feedback(feedback_id));

CREATE POLICY "attachments delete"
  ON public.platform_feedback_attachments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR (uploaded_by = auth.uid() AND public.feedback_is_new(feedback_id)));

CREATE POLICY "comments readable"
  ON public.platform_feedback_comments FOR SELECT TO authenticated
  USING (public.can_view_feedback(feedback_id) AND (is_internal = false OR public.is_admin(auth.uid())));

CREATE POLICY "comments insert"
  ON public.platform_feedback_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_feedback(feedback_id)
              AND (is_internal = false OR public.is_admin(auth.uid())));

CREATE POLICY "comments update own or admin"
  ON public.platform_feedback_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "comments delete own or admin"
  ON public.platform_feedback_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "events readable with parent"
  ON public.platform_feedback_events FOR SELECT TO authenticated
  USING (public.can_view_feedback(feedback_id));

CREATE POLICY "votes readable by team"
  ON public.platform_feedback_votes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "votes insert own"
  ON public.platform_feedback_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "votes delete own"
  ON public.platform_feedback_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── VIEWS ──────────────────────────────────────────────────────────────────
CREATE VIEW public.platform_feedback_overview
WITH (security_invoker = on) AS
SELECT f.*,
       (SELECT count(*) FROM public.platform_feedback_votes v       WHERE v.feedback_id = f.id) AS votes,
       (SELECT count(*) FROM public.platform_feedback_comments c    WHERE c.feedback_id = f.id) AS comments_count,
       (SELECT count(*) FROM public.platform_feedback_attachments a WHERE a.feedback_id = f.id) AS attachments_count,
       p.full_name AS assignee_name
FROM public.platform_feedback f
LEFT JOIN public.profiles p ON p.id = f.assignee_id;

GRANT SELECT ON public.platform_feedback_overview TO authenticated, service_role;

-- lista pública mínima (todos os autenticados) — sem descrição nem contexto
CREATE VIEW public.platform_feedback_public
WITH (security_invoker = off) AS
SELECT f.id, f.ref, f.type, f.title, f.module, f.status, f.severity, f.created_at,
       f.reported_by,
       (SELECT count(*) FROM public.platform_feedback_votes v WHERE v.feedback_id = f.id) AS votes
FROM public.platform_feedback f;

GRANT SELECT ON public.platform_feedback_public TO authenticated, service_role;

-- ─── PERMISSÕES DE PÁGINA ───────────────────────────────────────────────────
INSERT INTO public.permissions (role, permission, granted)
SELECT r, 'page:my_feedback', true
FROM unnest(ARRAY['super_admin','admin','sales_agent','operations_agent','finance','b2b_manager','viewer']) AS r
ON CONFLICT (role, permission) DO UPDATE SET granted = true;

INSERT INTO public.permissions (role, permission, granted)
SELECT r, 'page:admin_feedback', true
FROM unnest(ARRAY['super_admin','admin']) AS r
ON CONFLICT (role, permission) DO UPDATE SET granted = true;

-- ─── STORAGE POLICIES (bucket feedback-media) ───────────────────────────────
CREATE POLICY "feedback media insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-media' AND owner = auth.uid());

CREATE POLICY "feedback media select if parent visible"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-media'
         AND public.can_view_feedback(nullif(split_part(name, '/', 1), '')::uuid));

CREATE POLICY "feedback media delete admin or owner"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-media' AND (owner = auth.uid() OR public.is_admin(auth.uid())));