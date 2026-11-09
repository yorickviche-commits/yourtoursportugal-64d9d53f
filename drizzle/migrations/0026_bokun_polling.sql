ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bokun_hash text;

CREATE TABLE IF NOT EXISTS public.bokun_sync_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_full_scan_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text,
  locked_until timestamptz,
  stale_alerted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bokun_sync_state TO authenticated;
GRANT ALL ON public.bokun_sync_state TO service_role;
ALTER TABLE public.bokun_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read bokun sync state" ON public.bokun_sync_state FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.bokun_try_lock(p_seconds integer DEFAULT 300)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  INSERT INTO public.bokun_sync_state(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  UPDATE public.bokun_sync_state SET locked_until = now() + make_interval(secs => p_seconds), updated_at = now()
   WHERE id = 1 AND (locked_until IS NULL OR locked_until < now())
  RETURNING true INTO ok;
  RETURN coalesce(ok, false);
END $$;
REVOKE ALL ON FUNCTION public.bokun_try_lock(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bokun_try_lock(integer) TO service_role;