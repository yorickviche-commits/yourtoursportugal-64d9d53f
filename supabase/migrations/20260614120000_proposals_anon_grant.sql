-- Allow anonymous visitors to read shared proposals via public_token (RLS still restricts to sent/approved/viewed)
GRANT SELECT ON public.proposals TO anon;
GRANT SELECT, INSERT, UPDATE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
