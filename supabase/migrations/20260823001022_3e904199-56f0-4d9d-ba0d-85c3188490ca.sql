REVOKE ALL ON FUNCTION public.ytb_match_chunks(vector, int, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ytb_match_chunks(vector, int, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.ytb_can_edit(uuid) FROM PUBLIC, anon;