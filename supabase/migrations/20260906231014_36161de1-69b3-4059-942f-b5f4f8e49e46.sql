REVOKE ALL ON FUNCTION public.set_feedback_defaults()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feedback_lifecycle_stamps()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feedback_after_insert()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feedback_after_update()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feedback_comment_event()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feedback_attachment_event()  FROM PUBLIC, anon, authenticated;