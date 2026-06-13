
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='realtime')
     AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Internal users realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Internal users realtime" ON realtime.messages FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()))';
  END IF;
END $$;
