DO $$ DECLARE mx bigint; BEGIN
  SELECT coalesce(max(nullif(regexp_replace(yt_id,'\D','','g'),'')::bigint),0) INTO mx FROM public.leads WHERE yt_id ~* '^\s*YT[\s-]*\d{1,6}\s*$';
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.yt_id_seq START WITH %s', mx+1);
END $$;
REVOKE ALL ON SEQUENCE public.yt_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.yt_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.next_yt_id() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (coalesce(auth.role(),'')='service_role' OR public.is_internal_user(auth.uid())) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN 'YT' || nextval('public.yt_id_seq');
END $$;
CREATE OR REPLACE FUNCTION public.peek_next_yt_id() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v bigint; c boolean;
BEGIN
  IF NOT (coalesce(auth.role(),'')='service_role' OR public.is_internal_user(auth.uid())) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT last_value, is_called INTO v, c FROM public.yt_id_seq;
  RETURN 'YT' || (v + CASE WHEN c THEN 1 ELSE 0 END);
END $$;
REVOKE EXECUTE ON FUNCTION public.next_yt_id(), public.peek_next_yt_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_yt_id(), public.peek_next_yt_id() TO authenticated, service_role;

-- Legacy duplicates are kept untouched; new/changed YT ids may never collide.
CREATE OR REPLACE FUNCTION public.leads_yt_id_unique_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.yt_id IS NOT NULL AND (TG_OP='INSERT' OR upper(NEW.yt_id) IS DISTINCT FROM upper(OLD.yt_id)) THEN
    IF EXISTS (SELECT 1 FROM public.leads WHERE upper(yt_id)=upper(NEW.yt_id) AND id<>NEW.id) THEN
      RAISE EXCEPTION 'O ID % já existe noutra file', NEW.yt_id USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS leads_yt_id_unique_guard ON public.leads;
CREATE TRIGGER leads_yt_id_unique_guard BEFORE INSERT OR UPDATE OF yt_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leads_yt_id_unique_guard();
CREATE UNIQUE INDEX IF NOT EXISTS leads_yt_id_upper_new_uniq ON public.leads (upper(yt_id)) WHERE yt_id IS NOT NULL AND created_at >= '2026-11-13 00:00:00+00';

CREATE TABLE public.email_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  mailbox text NOT NULL, gmail_message_id text NOT NULL, gmail_thread_id text, rfc822_message_id text,
  direction text CHECK (direction IN ('in','out')), from_email text, from_name text, to_emails text[] DEFAULT '{}',
  subject text, snippet text, body_excerpt text, sent_at timestamptz,
  link_source text NOT NULL DEFAULT 'manual', unlinked boolean NOT NULL DEFAULT false, linked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mailbox, gmail_message_id)
);
CREATE INDEX email_links_rfc_idx ON public.email_links (rfc822_message_id);
CREATE INDEX email_links_lead_idx ON public.email_links (lead_id, sent_at DESC);
CREATE INDEX email_links_thread_idx ON public.email_links (mailbox, gmail_thread_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_links TO authenticated, service_role;
ALTER TABLE public.email_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read email_links" ON public.email_links FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "internal update email_links" ON public.email_links FOR UPDATE TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal insert email_links" ON public.email_links FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

CREATE TABLE public.calendar_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  calendar_id text NOT NULL, event_id text NOT NULL, title text, start_at timestamptz, html_link text,
  link_source text NOT NULL DEFAULT 'manual', unlinked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (calendar_id, event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_links TO authenticated, service_role;
ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read cal links" ON public.calendar_event_links FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "internal update cal links" ON public.calendar_event_links FOR UPDATE TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

CREATE TABLE public.mailbox_sync_state (
  mailbox text PRIMARY KEY, secret_name text, last_history_id text, last_run_at timestamptz, last_error text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailbox_sync_state TO authenticated, service_role;
ALTER TABLE public.mailbox_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read mailbox state" ON public.mailbox_sync_state FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

CREATE TABLE public.email_link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox text NOT NULL, gmail_message_id text NOT NULL, gmail_thread_id text, rfc822_message_id text,
  from_email text, subject text, snippet text, sent_at timestamptz, candidate_lead_ids uuid[] NOT NULL DEFAULT '{}',
  reason text, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','linked','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (mailbox, gmail_message_id)
);
CREATE INDEX email_link_suggestions_open_idx ON public.email_link_suggestions (status, sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_link_suggestions TO authenticated, service_role;
ALTER TABLE public.email_link_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal read suggestions" ON public.email_link_suggestions FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "internal update suggestions" ON public.email_link_suggestions FOR UPDATE TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- Mark suggestion linked whenever the same message gets linked.
CREATE OR REPLACE FUNCTION public.email_links_close_suggestion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT NEW.unlinked THEN
    UPDATE public.email_link_suggestions SET status='linked'
     WHERE status='open' AND ((mailbox=NEW.mailbox AND gmail_message_id=NEW.gmail_message_id) OR (NEW.rfc822_message_id IS NOT NULL AND rfc822_message_id=NEW.rfc822_message_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER email_links_close_suggestion AFTER INSERT OR UPDATE ON public.email_links FOR EACH ROW EXECUTE FUNCTION public.email_links_close_suggestion();

INSERT INTO public.workbench_settings (key, value) VALUES
 ('mailbox_finance', '{"address":"contabilidade@yourtours.pt","secret_name":null}'::jsonb),
 ('addon_shared_mailboxes', '["reservas@yourtours.pt","operations@yourtours.pt","contabilidade@yourtours.pt"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.mailbox_sync_state (mailbox, secret_name)
SELECT coalesce(value->>'address', CASE key WHEN 'mailbox_sales' THEN 'reservas@yourtours.pt' WHEN 'mailbox_ops' THEN 'operations@yourtours.pt' ELSE 'contabilidade@yourtours.pt' END), value->>'secret_name'
FROM public.workbench_settings WHERE key IN ('mailbox_sales','mailbox_ops','mailbox_finance')
ON CONFLICT (mailbox) DO NOTHING;