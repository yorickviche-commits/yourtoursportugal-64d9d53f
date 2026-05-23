// Sends booking request emails via the connected Gmail account (reservas@yourtours.pt)
// using the Lovable connector gateway. Supports optional PDF (or other) attachments.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

interface Attachment {
  filename: string;
  mimeType: string;
  contentBase64: string; // standard base64 (not url-safe)
}

function b64urlFromString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function chunk76(s: string): string {
  return s.replace(/.{1,76}/g, "$&\r\n");
}

function buildPlainEmail(opts: {
  to: string; subject: string; body: string; cc?: string; bcc?: string; fromName?: string;
}) {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`;
  const lines = [
    opts.fromName ? `From: ${opts.fromName} <reservas@yourtours.pt>` : undefined,
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : undefined,
    opts.bcc ? `Bcc: ${opts.bcc}` : undefined,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.body,
  ].filter(Boolean) as string[];
  return b64urlFromString(lines.join("\r\n"));
}

function buildMultipartEmail(opts: {
  to: string; subject: string; body: string; cc?: string; bcc?: string; fromName?: string;
  attachments: Attachment[];
}) {
  const boundary = `=_yt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`;

  const headers = [
    opts.fromName ? `From: ${opts.fromName} <reservas@yourtours.pt>` : undefined,
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : undefined,
    opts.bcc ? `Bcc: ${opts.bcc}` : undefined,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean) as string[];

  const parts: string[] = [];
  // Text body
  parts.push(
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.body,
  );
  // Attachments
  for (const att of opts.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      chunk76(att.contentBase64).trimEnd(),
    );
  }
  parts.push(`--${boundary}--`, "");

  const raw = headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");
  // Convert to base64url preserving bytes
  const bytes = new TextEncoder().encode(raw);
  return b64urlFromBytes(bytes);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!GOOGLE_MAIL_API_KEY) throw new Error("GOOGLE_MAIL_API_KEY not configured (Gmail connector not linked)");

    const { to, subject, body, cc, bcc, attachments } = await req.json();
    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Missing to/subject/body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const atts: Attachment[] = Array.isArray(attachments) ? attachments : [];
    const fromName = "Your Tours Portugal - Reservas";

    const raw = atts.length > 0
      ? buildMultipartEmail({ to, subject, body, cc, bcc, fromName, attachments: atts })
      : buildPlainEmail({ to, subject, body, cc, bcc, fromName });

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
