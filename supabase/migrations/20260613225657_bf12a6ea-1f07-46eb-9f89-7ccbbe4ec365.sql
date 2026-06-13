
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['leads','contacts','cost_items','tasks','approvals','travel_plans','documents','lead_operations','trip_operations','lead_planner_data','lead_costing_data','booking_emails_log','trip_itinerary_items','trips','lead_payments'];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Internal users read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Internal users insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "Internal users update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()))', t);
  END LOOP;
END $$;

CREATE POLICY "Only admins delete approvals" ON public.approvals
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DO $$
DECLARE
  t text;
  internal_delete text[] := ARRAY['contacts','tasks','travel_plans','documents','lead_operations','trip_operations','lead_planner_data','lead_costing_data','booking_emails_log','trip_itinerary_items','lead_payments'];
  admin_delete text[] := ARRAY['leads','cost_items','trips'];
BEGIN
  FOREACH t IN ARRAY internal_delete LOOP
    EXECUTE format('CREATE POLICY "Internal users delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_internal_user(auth.uid()))', t);
  END LOOP;
  FOREACH t IN ARRAY admin_delete LOOP
    EXECUTE format('CREATE POLICY "Only admins delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_admin(auth.uid()))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated can manage proposals" ON public.proposals;
DROP POLICY IF EXISTS "Public can view shared proposals" ON public.proposals;

CREATE POLICY "Internal users manage proposals"
  ON public.proposals FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Anon view shared proposals"
  ON public.proposals FOR SELECT TO anon
  USING (public_token IS NOT NULL AND status = ANY (ARRAY['sent','approved','revision_requested','viewed']));

REVOKE SELECT ON public.proposals FROM anon;
GRANT SELECT (id, public_token, client_name, title, date_range, participants, hero_image_url, summary_text, language, status, days, map_stops, created_at, updated_at, sent_at, approved_at, wetravel_trip_url, wetravel_checkout_url, total_value_eur, deposit_amount_eur, deposit_percent)
  ON public.proposals TO anon;

DROP POLICY IF EXISTS "Authenticated can manage annotations" ON public.proposal_annotations;
DROP POLICY IF EXISTS "Create annotations on shared proposals" ON public.proposal_annotations;
DROP POLICY IF EXISTS "View annotations on shared proposals" ON public.proposal_annotations;

CREATE POLICY "Internal users manage annotations"
  ON public.proposal_annotations FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Anon view shared annotations"
  ON public.proposal_annotations FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_annotations.proposal_id
    AND p.public_token IS NOT NULL
    AND p.status = ANY (ARRAY['sent','approved','revision_requested','viewed'])));

CREATE POLICY "Anon create annotations on shared proposals"
  ON public.proposal_annotations FOR INSERT TO anon
  WITH CHECK (
    author_type = 'client'
    AND EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_annotations.proposal_id
      AND p.public_token IS NOT NULL
      AND p.status = ANY (ARRAY['sent','approved','revision_requested','viewed']))
  );

REVOKE SELECT, INSERT ON public.proposal_annotations FROM anon;
GRANT SELECT (id, proposal_id, level, target_day_index, target_item_index, author_type, author_name, content, is_resolved, parent_id, created_at)
  ON public.proposal_annotations TO anon;
GRANT INSERT (proposal_id, level, target_day_index, target_item_index, author_type, author_name, content, parent_id)
  ON public.proposal_annotations TO anon;
