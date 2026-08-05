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
