// Fetches recent Gmail messages to/from a specific email address via Gmail connector.
// Used by CRM record detail to populate the timeline with real Gmail history.
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GATEWAY = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1';

function getHeader(headers: any[] | undefined, name: string): string {
  const h = (headers || []).find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function snippetDecode(s: string | undefined): string {
  if (!s) return '';
  try {
    const txt = document.createElement('textarea');
    txt.innerHTML = s;
    return txt.value;
  } catch {
    return s;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GOOGLE_MAIL_API_KEY = Deno.env.get('GOOGLE_MAIL_API_KEY');
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
    return new Response(JSON.stringify({ error: 'Gmail connector not configured', fallback: true, emails: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const emails: string[] = Array.isArray(body.emails) ? body.emails.filter(Boolean) : (body.email ? [body.email] : []);
    const extraQueries: string[] = Array.isArray(body.queries) ? body.queries.filter(Boolean) : [];
    const limit = Math.min(Number(body.limit) || 20, 50);

    const parts: string[] = [];
    emails.forEach((e) => parts.push(`(from:${e} OR to:${e})`));
    extraQueries.forEach((q) => parts.push(`(subject:"${q}" OR "${q}")`));

    if (parts.length === 0) {
      return new Response(JSON.stringify({ emails: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gwHeaders = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_MAIL_API_KEY,
    };

    const q = parts.join(' OR ');
    const listUrl = `${GATEWAY}/users/me/messages?maxResults=${limit}&q=${encodeURIComponent(q)}`;
    const listRes = await fetch(listUrl, { headers: gwHeaders });
    const listJson = await listRes.json();

    if (!listRes.ok) {
      console.error('Gmail list error', listRes.status, listJson);
      return new Response(JSON.stringify({ error: listJson?.error?.message || 'Gmail API error', status: listRes.status, fallback: true, emails: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ids: string[] = (listJson.messages || []).map((m: any) => m.id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ emails: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch metadata for each in parallel
    const details = await Promise.all(ids.map(async (id) => {
      const r = await fetch(`${GATEWAY}/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`, { headers: gwHeaders });
      if (!r.ok) return null;
      const m = await r.json();
      const headers = m.payload?.headers || [];
      const from = getHeader(headers, 'From');
      const to = getHeader(headers, 'To');
      const subject = getHeader(headers, 'Subject');
      const dateStr = getHeader(headers, 'Date');
      const internalDate = m.internalDate ? new Date(Number(m.internalDate)).toISOString() : (dateStr ? new Date(dateStr).toISOString() : new Date().toISOString());
      // direction: if From contains any of the contact emails -> IN, else OUT
      const lowerFrom = from.toLowerCase();
      const isInbound = emails.some((e) => lowerFrom.includes(e.toLowerCase()));
      return {
        id: m.id,
        threadId: m.threadId,
        subject,
        from,
        to,
        snippet: m.snippet || '',
        date: internalDate,
        direction: isInbound ? 'IN' : 'OUT',
        labelIds: m.labelIds || [],
        url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
      };
    }));

    const items = details.filter(Boolean);

    return new Response(JSON.stringify({ emails: items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('gmail-record-emails error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error', fallback: true, emails: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
