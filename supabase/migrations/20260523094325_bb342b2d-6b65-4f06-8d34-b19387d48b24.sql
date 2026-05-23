
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "Authenticated can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.activity_logs;

CREATE POLICY "Allow authenticated inserts" ON public.activity_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins and service can view logs" ON public.activity_logs;
CREATE POLICY "Admins and service can view logs" ON public.activity_logs
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.is_admin(auth.uid())
  );
