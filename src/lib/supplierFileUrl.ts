import { supabase } from '@/integrations/supabase/client';

/**
 * The `supplier-files` bucket is private: stored public URLs no longer resolve.
 * Open files through a short-lived signed URL instead.
 */
export async function openSupplierFile(storagePath?: string | null, fallbackUrl?: string | null) {
  if (storagePath) {
    const { data, error } = await supabase.storage
      .from('supplier-files')
      .createSignedUrl(storagePath, 60 * 10);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      return;
    }
  }
  if (fallbackUrl) window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Open a supplier file when only the stored (legacy public) URL is known.
 * Extracts the object path from the URL and opens it with a signed URL.
 */
export async function openSupplierFileByUrl(fileUrl?: string | null) {
  if (!fileUrl) return;
  const marker = '/supplier-files/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  const path = decodeURIComponent(fileUrl.slice(idx + marker.length).split('?')[0]);
  await openSupplierFile(path, null);
}
