// Sends booking request emails via the connected Gmail account (reservas@yourtours.pt)
// using the Lovable connector gateway.
// Supports: HTML body, inline images (data: URIs converted to cid:), and file attachments.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

interface Attachment {
  filename: string;
  mimeType: string;
  contentBase64: string; // standard base64
  inline?: boolean;
  cid?: string;
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function chunk76(s: string): string {
  return s.replace(/.{1,76}/g, "$&\r\n");
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

// Extract data: image URIs from HTML, convert to cid: refs and inline attachments
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

function buildEmail(opts: {
  to: string; subject: string; html: string; text: string;
  cc?: string; bcc?: string; fromName?: string;
  inline: Attachment[]; attachments: Attachment[];
}) {
  const mixedB = `mix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const relB = `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const altB = `alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const headers = [
    opts.fromName ? `From: ${encodeHeader(opts.fromName)} <reservas@yourtours.pt>` : "From: reservas@yourtours.pt",
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : undefined,
    opts.bcc ? `Bcc: ${opts.bcc}` : undefined,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedB}"`,
  ].filter(Boolean) as string[];

  const lines: string[] = [];
  // related (alt + inline images)
  lines.push(`--${mixedB}`, `Content-Type: multipart/related; boundary="${relB}"`, "");
  lines.push(`--${relB}`, `Content-Type: multipart/alternative; boundary="${altB}"`, "");
  // plain
  lines.push(`--${altB}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: 8bit", "", opts.text);
  // html
  lines.push(`--${altB}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: 8bit", "", opts.html);
  lines.push(`--${altB}--`, "");
  // inline images
  for (const att of opts.inline) {
    lines.push(
      `--${relB}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${att.cid}>`,
      `Content-Disposition: inline; filename="${att.filename}"`,
      "",
      chunk76(att.contentBase64).trimEnd(),
    );
  }
  lines.push(`--${relB}--`, "");
  // attachments
  for (const att of opts.attachments) {
    lines.push(
      `--${mixedB}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      chunk76(att.contentBase64).trimEnd(),
    );
  }
  lines.push(`--${mixedB}--`, "");

  const raw = headers.join("\r\n") + "\r\n\r\n" + lines.join("\r\n");
  return b64urlFromBytes(new TextEncoder().encode(raw));
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

    // Determine HTML and plain-text representations
    const rawHtml: string = html
      ? String(html)
      : `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${String(body)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`;
    const { html: htmlWithCids, inline } = extractInlineImages(rawHtml);
    const text = body ? String(body) : htmlToText(rawHtml);

    const atts: Attachment[] = Array.isArray(attachments) ? attachments : [];
    const fromName = "Your Tours Portugal - Reservas";

    const raw = buildEmail({
      to, subject, html: htmlWithCids, text, cc, bcc, fromName,
      inline, attachments: atts,
    });

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
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
