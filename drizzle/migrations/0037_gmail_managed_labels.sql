CREATE TABLE public.gmail_lead_labels (mailbox text NOT NULL, lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE, label_id text NOT NULL, name text NOT NULL, PRIMARY KEY(mailbox,lead_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_lead_labels TO authenticated, service_role;
ALTER TABLE public.gmail_lead_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_lead_labels_internal_read ON public.gmail_lead_labels FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE TABLE public.gmail_stage_labels (mailbox text NOT NULL, stage_key text NOT NULL, label_id text NOT NULL, name text NOT NULL, PRIMARY KEY(mailbox,stage_key));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_stage_labels TO authenticated, service_role;
ALTER TABLE public.gmail_stage_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_stage_labels_internal_read ON public.gmail_stage_labels FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE TABLE public.gmail_label_mailboxes (mailbox text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, lock_until timestamptz, backfill_done boolean NOT NULL DEFAULT false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_label_mailboxes TO authenticated, service_role;
ALTER TABLE public.gmail_label_mailboxes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.gmail_label_queue (mailbox text NOT NULL, thread_id text NOT NULL, lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE, requested_at timestamptz NOT NULL DEFAULT now(), done boolean NOT NULL DEFAULT false, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text, PRIMARY KEY(mailbox,thread_id,lead_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_label_queue TO authenticated, service_role;
ALTER TABLE public.gmail_label_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX gmail_label_queue_pending ON public.gmail_label_queue(mailbox,next_attempt_at) WHERE NOT done;
CREATE FUNCTION public.gmail_labels_enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='email_links' THEN
  IF TG_OP='UPDATE' AND OLD.gmail_thread_id IS NOT NULL THEN
   INSERT INTO public.gmail_label_queue(mailbox,thread_id,lead_id) VALUES(OLD.mailbox,OLD.gmail_thread_id,OLD.lead_id) ON CONFLICT(mailbox,thread_id,lead_id) DO UPDATE SET requested_at=now(),done=false,next_attempt_at=now();
  END IF;
  IF NEW.gmail_thread_id IS NOT NULL THEN
   INSERT INTO public.gmail_label_queue(mailbox,thread_id,lead_id) VALUES(NEW.mailbox,NEW.gmail_thread_id,NEW.lead_id) ON CONFLICT(mailbox,thread_id,lead_id) DO UPDATE SET requested_at=now(),done=false,next_attempt_at=now();
  END IF;
 ELSE
  INSERT INTO public.gmail_label_queue(mailbox,thread_id,lead_id) SELECT DISTINCT mailbox,gmail_thread_id,lead_id FROM public.email_links WHERE lead_id=NEW.id AND NOT unlinked AND gmail_thread_id IS NOT NULL ON CONFLICT(mailbox,thread_id,lead_id) DO UPDATE SET requested_at=now(),done=false,next_attempt_at=now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER email_links_gmail_labels AFTER INSERT OR UPDATE OF lead_id,unlinked,gmail_thread_id ON public.email_links FOR EACH ROW EXECUTE FUNCTION public.gmail_labels_enqueue();
CREATE TRIGGER leads_gmail_labels AFTER UPDATE ON public.leads FOR EACH ROW WHEN (OLD.yt_id IS DISTINCT FROM NEW.yt_id OR OLD.trip_start IS DISTINCT FROM NEW.trip_start OR OLD.travel_dates IS DISTINCT FROM NEW.travel_dates OR OLD.nethunt_stage IS DISTINCT FROM NEW.nethunt_stage OR OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.gmail_labels_enqueue();
CREATE FUNCTION public.gmail_labels_lock(p_mailbox text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.gmail_label_mailboxes SET lock_until=now()+interval '2 minutes' WHERE mailbox=p_mailbox AND (lock_until IS NULL OR lock_until<now());
 RETURN FOUND;
END $$;
CREATE FUNCTION public.gmail_labels_seed(p_mailbox text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.gmail_label_queue(mailbox,thread_id,lead_id)
 SELECT DISTINCT e.mailbox,e.gmail_thread_id,e.lead_id FROM public.email_links e WHERE e.mailbox=p_mailbox AND NOT e.unlinked AND e.gmail_thread_id IS NOT NULL AND e.sent_at>=now()-interval '90 days' AND NOT EXISTS(SELECT 1 FROM public.gmail_label_queue q WHERE q.mailbox=e.mailbox AND q.thread_id=e.gmail_thread_id AND q.lead_id=e.lead_id) LIMIT 100 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=0 THEN UPDATE public.gmail_label_mailboxes SET backfill_done=true WHERE mailbox=p_mailbox; END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.gmail_labels_enqueue(), public.gmail_labels_lock(text), public.gmail_labels_seed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gmail_labels_enqueue(), public.gmail_labels_lock(text), public.gmail_labels_seed(text) TO service_role;