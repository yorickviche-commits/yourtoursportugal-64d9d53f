// Sends booking request emails via the connected Gmail account (reservas@yourtours.pt)
// using the Lovable connector gateway.
// Uses Gmail's media upload endpoint (message/rfc822) to avoid double base64 encoding,
// which previously caused "Memory limit exceeded" on multi-MB PDF attachments.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  cc?: string; bcc?: string; fromName?: string;
  inline: Attachment[]; attachments: Attachment[];
}): Uint8Array {
  const mixedB = `mix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const relB = `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const altB = `alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const parts: string[] = [];
  const push = (...ls: string[]) => { for (const l of ls) parts.push(l, "\r\n"); };

  push(
    opts.fromName ? `From: ${encodeHeader(opts.fromName)} <reservas@yourtours.pt>` : "From: reservas@yourtours.pt",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!GOOGLE_MAIL_API_KEY) throw new Error("GOOGLE_MAIL_API_KEY not configured (Gmail connector not linked)");

    const { to, subject, body, html, cc, bcc, attachments } = await req.json();
    if (!to || !subject || (!body && !html)) {
      return new Response(JSON.stringify({ error: "Missing to/subject/body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawHtml: string = html
      ? String(html)
      : `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${String(body)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`;
    const { html: htmlWithCids, inline } = extractInlineImages(rawHtml);
    const text = body ? String(body) : htmlToText(rawHtml);

    const atts: Attachment[] = Array.isArray(attachments) ? attachments : [];
    const fromName = "Your Tours Portugal - Reservas";

    const rawBytes = buildRawMime({
      to, subject, html: htmlWithCids, text, cc, bcc, fromName,
      inline, attachments: atts,
    });

    const res = await fetch(GATEWAY_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "message/rfc822",
      },
      body: rawBytes,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Gmail send failed", res.status, data);
      return new Response(JSON.stringify({ error: `Gmail ${res.status}`, details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, gmail: data }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-booking-email error", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
