// Gmail connector-gateway helpers (read-only) shared by CRM email functions.
const GW = 'https://connector-gateway.lovable.dev/google_mail';
export const MAILBOX_KEY_RE = /^GOOGLE_MAIL_API_KEY(?:_\d+)?$/;
function headers(keyName: string) {
  const api = Deno.env.get('LOVABLE_API_KEY'), key = Deno.env.get(keyName);
  if (!api || !key) throw new Error(`Ligação Gmail ${keyName} indisponível`);
  return { Authorization: `Bearer ${api}`, 'X-Connection-Api-Key': key };
}
export async function gmailGet(keyName: string, path: string): Promise<{ status: number; body: any }> {
  const r = await fetch(`${GW}/gmail/v1/users/me${path}`, { headers: headers(keyName) });
  const text = await r.text();
  let body: any = text; try { body = JSON.parse(text); } catch { /* keep text */ }
  return { status: r.status, body };
}
/** Multipart batch GET (sent in chunks of 20). Returns one result per path, in order. */
export async function gmailBatch(keyName: string, paths: string[]): Promise<{ status: number; body: any }[]> {
  const out: { status: number; body: any }[] = [];
  for (let i = 0; i < paths.length; i += 20) {
    const chunk = paths.slice(i, i + 20), boundary = 'crm_batch';
    const body = chunk.map((p, j) => `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <item${j}>\r\n\r\nGET /gmail/v1/users/me${p} HTTP/1.1\r\n\r\n`).join('') + `--${boundary}--\r\n`;
    const r = await fetch(`${GW}/batch/gmail/v1`, { method: 'POST', headers: { ...headers(keyName), 'Content-Type': `multipart/mixed; boundary=${boundary}` }, body });
    if (!r.ok) throw new Error(`Gmail batch [${r.status}]: ${await r.text()}`);
    const ct = r.headers.get('Content-Type') || '', rb = ct.match(/boundary="?([^";\s]+)/i)?.[1];
    if (!ct.includes('multipart/mixed') || !rb) throw new Error('Resposta Gmail inesperada');
    const parts = (await r.text()).split(`--${rb}`).filter((x) => x.includes('HTTP/1.1'));
    const byId = new Map<number, { status: number; body: any }>();
    parts.forEach((part, k) => {
      const idx = Number(part.match(/Content-ID:\s*<response-item(\d+)>/i)?.[1] ?? k);
      const http = part.slice(part.indexOf('HTTP/1.1')), status = Number(http.match(/^HTTP\/1\.1 (\d+)/)?.[1]), sep = http.indexOf('\r\n\r\n');
      let b: any = http.slice(sep + 4).trim(); try { b = JSON.parse(b); } catch { /* text */ }
      byId.set(idx, { status, body: b });
    });
    for (let j = 0; j < chunk.length; j++) {
      let res = byId.get(j) ?? { status: 0, body: 'sem resposta' };
      // Gmail limits concurrent requests per user: retry throttled parts one by one.
      for (let a = 0; (res.status === 429 || res.status === 0 || res.status >= 500) && a < 4; a++) { await new Promise((ok) => setTimeout(ok, 700 * (a + 1))); res = await gmailGet(keyName, chunk[j]); }
      out.push(res);
    }
  }
  return out;
}
export const META_QS = '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=Date&metadataHeaders=In-Reply-To&metadataHeaders=References&fields=id,threadId,labelIds,snippet,internalDate,payload/headers';
export const hdr = (m: any, name: string) => m?.payload?.headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
export const gmailThreadUrl = (mailbox: string, threadId: string | null) => threadId ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#all/${threadId}` : null;
