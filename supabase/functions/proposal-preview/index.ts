// Public OG-preview endpoint for shared proposal links.
// Serves HTML with proper Open Graph / Twitter meta tags (image, title, description)
// so WhatsApp / Slack / iMessage / Facebook crawlers render a rich card.
// Social crawlers receive this HTML. Human visitors are redirected to the SPA
// at /proposal/:token with a real HTTP redirect so crawlers do not follow a
// meta-refresh and lose the proposal-specific tags.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const APP_ORIGIN = "https://yourtoursportugal.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(s: string): string {
  return String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isSocialCrawler(userAgent: string): boolean {
  return /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|embedly|quora link preview|vkshare|skypeuripreview|applebot/i.test(
    userAgent,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Token is provided as ?t=... OR as the last path segment
  const parts = url.pathname.split("/").filter(Boolean);
  const token = url.searchParams.get("t") || parts[parts.length - 1] || "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // Fallback OG image MUST be an absolute https URL. WhatsApp/Facebook/iMessage
  // silently drop data: URIs and relative paths, which is why previews rendered
  // no thumbnail before.
  const FALLBACK_IMAGE =
    "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/acc08188-4f2f-47be-af30-078f450e2573/id-preview-394b5f40--28f0c46d-500d-4af4-968d-f0395e1bb34b.lovable.app-1772150124040.png";

  const isHttpUrl = (u: unknown): u is string =>
    typeof u === "string" && /^https?:\/\//i.test(u.trim());

  const pickImageFromDays = (days: unknown): string | null => {
    if (!Array.isArray(days)) return null;
    for (const d of days) {
      if (d && isHttpUrl((d as any).cover_image_url)) return (d as any).cover_image_url;
      const imgs = (d as any)?.images;
      if (Array.isArray(imgs)) {
        for (const im of imgs) {
          if (im && isHttpUrl(im.url)) return im.url;
        }
      }
    }
    return null;
  };

  let title = "Your Tours Portugal — Private Tour Proposal";
  let description = "Your custom private tour in Portugal, crafted by Your Tours Portugal.";
  let image = FALLBACK_IMAGE;
  const targetUrl = `${APP_ORIGIN}/proposal/${encodeURIComponent(token)}`;

  if (token && token !== "proposal-preview") {
    try {
      const { data } = await sb
        .from("proposals")
        .select("title, client_name, date_range, hero_image_url, summary_text, booking_ref, days, lead_id")
        .eq("public_token", token)
        .maybeSingle();
      if (data) {
        let publicRef = data.booking_ref || "";
        if (!publicRef && data.lead_id) {
          const { data: lead } = await sb
            .from("leads")
            .select("lead_code")
            .eq("id", data.lead_id)
            .maybeSingle();
          publicRef = lead?.lead_code || "";
        }
        const ref = publicRef ? `${publicRef} — ` : "";
        title = `${ref}${data.title || "Private Tour"}${data.client_name ? ` · ${data.client_name}` : ""}`;
        const parts: string[] = [];
        if (data.date_range) parts.push(data.date_range);
        if (data.summary_text) parts.push(stripHtml(data.summary_text));
        description = (parts.join(" — ") || description).slice(0, 300);
        // Only use hero_image_url if it's a real http(s) URL. Some proposals
        // store base64 data: URIs, which crawlers ignore. Fall back to the
        // first http image inside days[], then to the site logo.
        if (isHttpUrl(data.hero_image_url)) {
          image = data.hero_image_url as string;
        } else {
          const fromDays = pickImageFromDays((data as any).days);
          if (fromDays) image = fromDays;
        }
      }
    } catch (e) {
      console.error("proposal-preview lookup failed:", e);
    }
  }

  const userAgent = req.headers.get("user-agent") || "";
  const debug = url.searchParams.get("debug") === "1";
  if (!debug && token && !isSocialCrawler(userAgent)) {
    return Response.redirect(targetUrl, 302);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="canonical" href="${esc(targetUrl)}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Your Tours Portugal" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:secure_url" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${esc(targetUrl)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />

<style>body{font-family:system-ui;padding:40px;text-align:center;color:#0a2540}</style>
</head>
<body>
<p>Opening your proposal…</p>
<p><a href="${esc(targetUrl)}">Click here if you are not redirected</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});
