ALTER TABLE public.nethunt_archive_items ADD COLUMN media_status text NOT NULL DEFAULT 'not_applicable' CHECK (media_status IN ('not_applicable','processing','copied','error'));
ALTER TABLE public.nethunt_archive_items ADD COLUMN storage_path text;
ALTER TABLE public.nethunt_archive_items ADD COLUMN binary_sha256 text;
ALTER TABLE public.nethunt_archive_items ADD COLUMN binary_bytes bigint;
ALTER TABLE public.nethunt_archive_items ADD COLUMN media_error text;
ALTER TABLE public.nethunt_archive_items ADD COLUMN media_checked_at timestamptz;
CREATE POLICY nethunt_archive_private_files_admin_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'nethunt-final-archive' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));