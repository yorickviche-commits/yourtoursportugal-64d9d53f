ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
GRANT UPDATE ON public.payment_links TO authenticated;
DROP POLICY IF EXISTS "Internal users can update payment links" ON public.payment_links;
CREATE POLICY "Internal users can update payment links"
ON public.payment_links FOR UPDATE TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));