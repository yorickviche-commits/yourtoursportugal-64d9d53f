import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type { Raw } from './archive.ts';

const BUCKET = 'nethunt-final-archive';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_drive/drive/v3';
const MAX_BYTES = 50 * 1024 * 1024;
async function binaryHash(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
}
export async function copyNextFile(sb: SupabaseClient, runId: string) {
  const {data,error} = await sb.from('nethunt_archive_items').select('id,source_id,payload')
    .eq('run_id',runId).eq('kind','file').eq('media_status','not_applicable').order('id').limit(1);
  if (error) throw new Error(error.message);
  const item = data?.[0];
  if (!item) return {ok:true,done:true};
  const claimed = await sb.from('nethunt_archive_items').update({media_status:'processing',media_checked_at:new Date().toISOString()})
    .eq('id',item.id).eq('media_status','not_applicable').select('id');
  if (claimed.error) throw new Error(claimed.error.message);
  if (!claimed.data?.length) return {ok:true,done:false,busy:true};
  try {
    const payload = item.payload as Raw;
    const fileId = String(payload.googleDriveFileId ?? '');
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) throw new Error('Referência Google Drive não reconhecida');
    const key = Deno.env.get('GOOGLE_DRIVE_API_KEY');
    const gateway = Deno.env.get('LOVABLE_API_KEY');
    if (!key || !gateway) throw new Error('Ligação Google Drive indisponível');
    if (String(payload.mimeType ?? '').startsWith('application/vnd.google-apps.')) throw new Error('Documento Google nativo exige formato de exportação próprio');
    const response = await fetch(`${GATEWAY_URL}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
      headers:{Authorization:`Bearer ${gateway}`,'X-Connection-Api-Key':key}, signal:AbortSignal.timeout(45000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Google Drive HTTP ${response.status}`); }
    if (!response.body) throw new Error('Ficheiro sem conteúdo');
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) { await reader.cancel(); throw new Error('Ficheiro excede 50 MB; exige cópia dedicada'); }
      parts.push(value);
    }
    if (!length) throw new Error('Ficheiro vazio');
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {bytes.set(part,offset);offset+=part.length;}
    const digest = await binaryHash(bytes);
    const path = `${runId}/${item.source_id}/${fileId}`;
    const upload = await sb.storage.from(BUCKET).upload(path,bytes,{upsert:true,contentType:String(payload.mimeType ?? response.headers.get('content-type') ?? 'application/octet-stream')});
    if (upload.error) throw new Error(`Arquivo privado: ${upload.error.message}`);
    const read = await sb.storage.from(BUCKET).download(path);
    if (read.error || !read.data) throw new Error('Não foi possível reler a cópia privada');
    const stored = new Uint8Array(await read.data.arrayBuffer());
    if (stored.length !== length || await binaryHash(stored) !== digest) throw new Error('Assinatura do ficheiro relido não coincide');
    const saved = await sb.from('nethunt_archive_items').update({media_status:'copied',storage_path:path,
      binary_sha256:digest,binary_bytes:length,media_error:null,media_checked_at:new Date().toISOString(),
    }).eq('id',item.id);
    if (saved.error) throw new Error(saved.error.message);
    return {ok:true,done:false,copied:true,bytes:length};
  } catch(e) {
    const message = e instanceof Error ? e.message : 'Falha na cópia do ficheiro';
    const saved = await sb.from('nethunt_archive_items').update({media_status:'error',media_error:message,media_checked_at:new Date().toISOString()}).eq('id',item.id);
    if (saved.error) throw new Error(saved.error.message);
    return {ok:false,done:false,copied:false,error:message};
  }
}