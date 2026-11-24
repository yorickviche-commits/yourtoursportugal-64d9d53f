// Use the Gmail media upload host through the connector gateway.
const GATEWAY_UPLOAD_URL = "https://connector-gateway.lovable.dev/google_mail/upload/gmail/v1/users/me/messages/send?uploadType=media";

interface Attachment {
  filename: string;
  mimeType: string;
  contentBase64: string; // standard base64
  inline?: boolean;
  cid?: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Insert CRLF every 76 chars without piling up huge intermediate strings.
function chunk76Into(parts: string[], s: string) {
  for (let i = 0; i < s.length; i += 76) {
    parts.push(s.slice(i, i + 76), "\r\n");
  }
}

function extractInlineImages(html: string): { html: string; inline: Attachment[] } {
  const inline: Attachment[] = [];
  const re = /<img[^>]+src="(data:([^;]+);base64,([^"]+))"[^>]*>/gi;
  let i = 0;
  const out = html.replace(re, (match, _full, mime, b64) => {
    i += 1;
    const cid = `inlineimg${Date.now().toString(36)}${i}@yourtours.pt`;
    const ext = (mime.split("/")[1] || "png").split("+")[0];
    inline.push({
      filename: `image-${i}.${ext}`,
      mimeType: mime,
      contentBase64: b64,
      inline: true,
      cid,
    });
    return match.replace(_full, `cid:${cid}`);
  });
  return { html: out, inline };
}

function encodeHeader(value: string) {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(value)))}?=`
    : value;
}

function buildRawMime(opts: {
  to: string; subject: string; html: string; text: string;
  cc?: string; bcc?: string; fromName?: string; fromAddress?: string;
  inline: Attachment[]; attachments: Attachment[];
}): Uint8Array {
  const mixedB = `mix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const relB = `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const altB = `alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const parts: string[] = [];
  const push = (...ls: string[]) => { for (const l of ls) parts.push(l, "\r\n"); };

  push(
    opts.fromName ? `From: ${encodeHeader(opts.fromName)} <${opts.fromAddress || "reservas@yourtours.pt"}>` : "From: reservas@yourtours.pt",
    `To: ${opts.to}`,
  );
  if (opts.cc) push(`Cc: ${opts.cc}`);
  if (opts.bcc) push(`Bcc: ${opts.bcc}`);
  push(
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedB}"`,
    "",
    `--${mixedB}`,
    `Content-Type: multipart/related; boundary="${relB}"`,
    "",
    `--${relB}`,
    `Content-Type: multipart/alternative; boundary="${altB}"`,
    "",
    `--${altB}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.text,
    `--${altB}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.html,
    `--${altB}--`,
    "",
  );

  for (const att of opts.inline) {
    push(
      `--${relB}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${att.cid}>`,
      `Content-Disposition: inline; filename="${att.filename}"`,
      "",
    );
    chunk76Into(parts, att.contentBase64);
  }
  push(`--${relB}--`, "");

  for (const att of opts.attachments) {
    push(
      `--${mixedB}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
    );
    chunk76Into(parts, att.contentBase64);
  }
  push(`--${mixedB}--`, "");

  // Encode each part incrementally to keep peak memory low.
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const p of parts) {
    const u = enc.encode(p);
    chunks.push(u);
    total += u.byteLength;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}


export async function sendPreparedEmail(db: any, side: 'sales' | 'ops', p: any) {
  if (!p.to || !p.subject || !p.html) throw new Error('Falta destinatário, assunto ou corpo do email');
  const { data: setting, error } = await db.from('workbench_settings').select('value').eq('key', `mailbox_${side}`).single();
  if (error) throw new Error('Caixa de email não configurada');
  const { address, secret_name: keyName } = setting.value || {};
  if (!/^GOOGLE_MAIL_API_KEY(?:_\d+)?$/.test(keyName || '')) throw new Error('Ligação Gmail inválida');
  const key = Deno.env.get(keyName), api = Deno.env.get('LOVABLE_API_KEY');
  if (!key || !api) throw new Error('Ligação Gmail indisponível');
  const headers = { Authorization: `Bearer ${api}`, 'X-Connection-Api-Key': key };
  const profile = await fetch('https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/profile', { headers });
  if (!profile.ok || (await profile.json()).emailAddress?.toLowerCase() !== address?.toLowerCase()) throw new Error('A ligação Gmail não corresponde à caixa selecionada');
  const attachments: Attachment[] = [];
  for (const a of p.attachments || []) {
    if (!a.path) throw new Error('Anexo sem referência de armazenamento');
    const {data, error} = await db.storage.from('travel-plan-pdfs').download(a.path);
    if (error || !data) throw new Error('Não foi possível obter o anexo');
    const bytes = new Uint8Array(await data.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    attachments.push({filename: a.filename, mimeType: 'application/pdf', contentBase64: btoa(binary)});
  }
  const {html, inline} = extractInlineImages(p.html);
  const bytes = buildRawMime({to:p.to, subject:p.subject, html, text:htmlToText(html), cc:(p.cc || []).join(', '), bcc:(p.bcc || []).join(', '), fromAddress:address, fromName:side === 'ops' ? 'Your Tours Portugal - Operações' : 'Your Tours Portugal - Reservas', inline, attachments});
  let response: Response;
  try { response = await fetch(GATEWAY_UPLOAD_URL, {method:'POST', headers:{...headers, 'Content-Type':'message/rfc822'}, body:bytes}); }
  catch { throw Object.assign(new Error('Não foi possível confirmar a entrega; verifica Enviados antes de repetir'), {uncertain:true}); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Gmail recusou o envio (${response.status})`), {uncertain:response.status >= 500});
  const id = result.id || result.gmail?.id;
  return {sent:true, message_id:id || null, mailbox:address, url:id ? `https://mail.google.com/mail/u/${encodeURIComponent(address)}/#sent/${id}` : `https://mail.google.com/mail/u/${encodeURIComponent(address)}/#sent`};
}
