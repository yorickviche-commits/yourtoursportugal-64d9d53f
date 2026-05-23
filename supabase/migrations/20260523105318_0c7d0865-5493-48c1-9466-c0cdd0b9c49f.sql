
-- ============ Restrict public SELECT to authenticated ============

-- partners
DROP POLICY IF EXISTS "Authenticated can view partners" ON public.partners;
CREATE POLICY "Authenticated can view partners" ON public.partners
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can view partner files" ON public.partner_files;
CREATE POLICY "Authenticated can view partner files" ON public.partner_files
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can view partner links" ON public.partner_links;
CREATE POLICY "Authenticated can view partner links" ON public.partner_links
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can view partner services" ON public.partner_services;
CREATE POLICY "Authenticated can view partner services" ON public.partner_services
  FOR SELECT TO authenticated USING (true);

-- suppliers
DROP POLICY IF EXISTS "Authenticated can view files" ON public.supplier_files;
CREATE POLICY "Authenticated can view files" ON public.supplier_files
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can view links" ON public.supplier_links;
CREATE POLICY "Authenticated can view links" ON public.supplier_links
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can view services" ON public.supplier_services;
CREATE POLICY "Authenticated can view services" ON public.supplier_services
  FOR SELECT TO authenticated USING (true);

-- ============ Permissions table -- admins only ============
DROP POLICY IF EXISTS "Authenticated can view permissions" ON public.permissions;
CREATE POLICY "Admins can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ Proposals: scope public read by token + status ============
DROP POLICY IF EXISTS "Public can view proposals by token" ON public.proposals;
CREATE POLICY "Public can view shared proposals" ON public.proposals
  FOR SELECT TO anon, authenticated
  USING (
    auth.uid() IS NOT NULL
    OR (
      public_token IS NOT NULL
      AND status IN ('sent', 'approved', 'revision_requested', 'viewed')
    )
  );

-- ============ Proposal annotations: scope public access via parent proposal token ============
DROP POLICY IF EXISTS "Anyone can view annotations" ON public.proposal_annotations;
DROP POLICY IF EXISTS "Anyone can create annotations" ON public.proposal_annotations;

CREATE POLICY "View annotations on shared proposals" ON public.proposal_annotations
  FOR SELECT TO anon, authenticated
  USING (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_annotations.proposal_id
        AND p.public_token IS NOT NULL
        AND p.status IN ('sent', 'approved', 'revision_requested', 'viewed')
    )
  );

CREATE POLICY "Create annotations on shared proposals" ON public.proposal_annotations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_annotations.proposal_id
        AND p.public_token IS NOT NULL
        AND p.status IN ('sent', 'approved', 'revision_requested', 'viewed')
    )
  );

-- ============ Proposal events: scope public access via parent proposal token ============
DROP POLICY IF EXISTS "Anyone can view events" ON public.proposal_events;
DROP POLICY IF EXISTS "Anyone can create events" ON public.proposal_events;

CREATE POLICY "View events on shared proposals" ON public.proposal_events
  FOR SELECT TO anon, authenticated
  USING (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_events.proposal_id
        AND p.public_token IS NOT NULL
        AND p.status IN ('sent', 'approved', 'revision_requested', 'viewed')
    )
  );

CREATE POLICY "Create events on shared proposals" ON public.proposal_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_events.proposal_id
        AND p.public_token IS NOT NULL
        AND p.status IN ('sent', 'approved', 'revision_requested', 'viewed')
    )
  );

-- ============ CEO approval queue: only admins may decide ============
DROP POLICY IF EXISTS "auth_update_queue" ON public.ceo_approval_queue;
CREATE POLICY "admins_decide_queue" ON public.ceo_approval_queue
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (
    public.is_admin(auth.uid())
    AND status IN ('approved', 'rejected')
  );

-- ============ Fix mutable search_path on SECURITY DEFINER helpers ============
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
