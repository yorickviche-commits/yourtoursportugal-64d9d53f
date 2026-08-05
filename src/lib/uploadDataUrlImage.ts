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

/**
 * Removes a (near-)white/uniform background from a raster logo, returning a
 * transparent PNG File. SVGs and images that already have transparency are
 * returned unchanged.
 */
export async function removeWhiteBackground(file: File): Promise<File> {
  if (file.type === 'image/svg+xml') return file;
  try {
    const bitmapUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = bitmapUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(bitmapUrl);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    // Already transparent somewhere? keep as-is (just re-encode to png)
    let hasAlpha = false;
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] < 250) { hasAlpha = true; break; }
    }

    if (!hasAlpha) {
      // Sample corners to detect a uniform background colour
      const corner = (x: number, y: number) => {
        const o = (y * canvas.width + x) * 4;
        return [px[o], px[o + 1], px[o + 2]];
      };
      const corners = [
        corner(0, 0),
        corner(canvas.width - 1, 0),
        corner(0, canvas.height - 1),
        corner(canvas.width - 1, canvas.height - 1),
      ];
      const [br, bg, bb] = corners[0];
      const uniform = corners.every(c => Math.abs(c[0] - br) < 12 && Math.abs(c[1] - bg) < 12 && Math.abs(c[2] - bb) < 12);
      if (uniform) {
        const tol = 26;
        for (let i = 0; i < px.length; i += 4) {
          const d = Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb);
          if (d < tol * 3) {
            px[i + 3] = 0;
          } else if (d < tol * 6) {
            px[i + 3] = Math.round(px[i + 3] * ((d - tol * 3) / (tol * 3)));
          }
        }
        ctx.putImageData(data, 0, 0);
      }
    }

    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  } catch (e) {
    console.warn('[removeWhiteBackground] falhou, mantendo original:', e);
    return file;
  }
}

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

