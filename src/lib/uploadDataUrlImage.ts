import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'proposal-images';

const isDataUrl = (url?: string | null) => !!url && url.startsWith('data:');

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  return { blob: new Blob([bytes], { type: mime }), ext };
}

/**
 * Uploads a base64 `data:` image URL to public storage and returns the public URL.
 * If the input is already an http(s) URL it is returned unchanged.
 * On failure the original value is returned so nothing is lost.
 */
export async function uploadDataUrlImage(url: string, prefix = 'proposals'): Promise<string> {
  if (!isDataUrl(url)) return url;
  try {
    const { blob, ext } = dataUrlToBlob(url);
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || url;
  } catch (e) {
    console.error('[uploadDataUrlImage] falhou, mantendo original:', e);
    return url;
  }
}

export { isDataUrl };

/** Uploads a File (e.g. a B2B partner logo) to public storage and returns the public URL. */
export async function uploadImageFile(file: File, prefix = 'logos'): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/png',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
