GRANT SELECT ON public.proposals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;

GRANT SELECT, INSERT ON public.proposal_annotations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_annotations TO authenticated;
GRANT ALL ON public.proposal_annotations TO service_role;

GRANT SELECT, INSERT ON public.proposal_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_events TO authenticated;
GRANT ALL ON public.proposal_events TO service_role;