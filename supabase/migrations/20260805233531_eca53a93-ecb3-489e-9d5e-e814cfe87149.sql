-- Allow client actions on any proposal shared via public_token (status whitelist blocked legit events)
DROP POLICY IF EXISTS "Create events on shared proposals" ON public.proposal_events;
CREATE POLICY "Create events on shared proposals" ON public.proposal_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_events.proposal_id
        AND p.public_token IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "View events on shared proposals" ON public.proposal_events;
CREATE POLICY "View events on shared proposals" ON public.proposal_events
  FOR SELECT TO anon, authenticated
  USING (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_events.proposal_id
        AND p.public_token IS NOT NULL
    )
  );

-- RLS helper functions must be executable by anon, otherwise policies error out
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO anon, authenticated;