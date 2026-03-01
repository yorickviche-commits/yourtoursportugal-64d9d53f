import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NETHUNT_BASE = 'https://nethunt.com/api/v1/zapier';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const NETHUNT_EMAIL = Deno.env.get('NETHUNT_EMAIL');
  const NETHUNT_API_KEY = Deno.env.get('NETHUNT_API_KEY');

  if (!NETHUNT_EMAIL || !NETHUNT_API_KEY) {
    return new Response(JSON.stringify({ error: 'NetHunt credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const basicAuth = btoa(`${NETHUNT_EMAIL}:${NETHUNT_API_KEY}`);
  const authHeaders = {
    'Authorization': `Basic ${basicAuth}`,
    'Content-Type': 'application/json',
  };

  try {
    const body = await req.json();
    const { action } = body;

    let url = '';
    let method = 'GET';
    let payload: string | undefined;

    switch (action) {
      // ── Folders ──
      case 'list-folders': {
        url = `${NETHUNT_BASE}/triggers/readable-folder`;
        break;
      }
      case 'writable-folders': {
        url = `${NETHUNT_BASE}/triggers/writable-folder`;
        break;
      }
      case 'folder-fields': {
        if (!body.folderId) throw new Error('folderId required');
        url = `${NETHUNT_BASE}/triggers/folder-field/${body.folderId}`;
        break;
      }

      // ── Find / Search ──
      case 'find-records': {
        if (!body.folderId) throw new Error('folderId required');
        const p = new URLSearchParams();
        if (body.recordId) p.set('recordId', body.recordId);
        if (body.query) p.set('query', body.query);
        p.set('limit', String(body.limit || 50));
        url = `${NETHUNT_BASE}/searches/find-record/${body.folderId}?${p}`;
        break;
      }
      case 'find-record-by-id': {
        if (!body.folderId || !body.recordId) throw new Error('folderId and recordId required');
        const p2 = new URLSearchParams();
        p2.set('recordId', body.recordId);
        p2.set('limit', '1');
        url = `${NETHUNT_BASE}/searches/find-record/${body.folderId}?${p2}`;
        break;
      }

      // ── Recent records ──
      case 'recent-records': {
        if (!body.folderId) throw new Error('folderId required');
        const rp = new URLSearchParams();
        if (body.since) rp.set('since', body.since);
        if (body.limit) rp.set('limit', String(body.limit));
        url = `${NETHUNT_BASE}/triggers/new-record/${body.folderId}?${rp}`;
        break;
      }

      // ── Updated records ──
      case 'updated-records': {
        if (!body.folderId) throw new Error('folderId required');
        const up = new URLSearchParams();
        if (body.since) up.set('since', body.since);
        if (body.limit) up.set('limit', String(body.limit));
        if (body.fieldName) {
          const names = Array.isArray(body.fieldName) ? body.fieldName : [body.fieldName];
          names.forEach((n: string) => up.append('fieldName', n));
        }
        url = `${NETHUNT_BASE}/triggers/updated-record/${body.folderId}?${up}`;
        break;
      }

      // ── Record changes ──
      case 'record-changes': {
        if (!body.folderId) throw new Error('folderId required');
        const cp = new URLSearchParams();
        if (body.recordId) cp.set('recordId', body.recordId);
        if (body.since) cp.set('since', body.since);
        if (body.limit) cp.set('limit', String(body.limit));
        url = `${NETHUNT_BASE}/triggers/record-change/${body.folderId}?${cp}`;
        break;
      }

      // ── Comments ──
      case 'recent-comments': {
        if (!body.folderId) throw new Error('folderId required');
        const ccp = new URLSearchParams();
        if (body.since) ccp.set('since', body.since);
        if (body.limit) ccp.set('limit', String(body.limit));
        url = `${NETHUNT_BASE}/triggers/new-comment/${body.folderId}?${ccp}`;
        break;
      }
      case 'create-comment': {
        if (!body.recordId || !body.text) throw new Error('recordId and text required');
        url = `${NETHUNT_BASE}/actions/create-comment/${body.recordId}`;
        method = 'POST';
        payload = JSON.stringify({ text: body.text });
        break;
      }

      // ── Call logs ──
      case 'recent-call-logs': {
        if (!body.folderId) throw new Error('folderId required');
        const clp = new URLSearchParams();
        if (body.since) clp.set('since', body.since);
        if (body.limit) clp.set('limit', String(body.limit));
        url = `${NETHUNT_BASE}/triggers/new-call-log/${body.folderId}?${clp}`;
        break;
      }

      // ── Google Drive files ──
      case 'recent-drive-files': {
        if (!body.folderId) throw new Error('folderId required');
        const dfp = new URLSearchParams();
        if (body.since) dfp.set('since', body.since);
        if (body.limit) dfp.set('limit', String(body.limit));
        url = `${NETHUNT_BASE}/triggers/new-gdrivefile/${body.folderId}?${dfp}`;
        break;
      }

      // ── CRUD ──
      case 'create-record': {
        if (!body.folderId || !body.fields) throw new Error('folderId and fields required');
        url = `${NETHUNT_BASE}/actions/create-record/${body.folderId}`;
        method = 'POST';
        payload = JSON.stringify({
          timeZone: body.timeZone || 'Europe/Lisbon',
          fields: body.fields,
        });
        break;
      }
      case 'update-record': {
        if (!body.recordId || !body.fieldActions) throw new Error('recordId and fieldActions required');
        const owParam = body.overwrite ? '?overwrite=true' : '';
        url = `${NETHUNT_BASE}/actions/update-record/${body.recordId}${owParam}`;
        method = 'POST';
        payload = JSON.stringify({ fieldActions: body.fieldActions });
        break;
      }
      case 'delete-record': {
        if (!body.recordId) throw new Error('recordId required');
        url = `${NETHUNT_BASE}/actions/delete-record/${body.recordId}`;
        method = 'POST';
        break;
      }

      // ── Gmail thread ──
      case 'link-gmail-thread': {
        if (!body.recordId || !body.gmailThreadId) throw new Error('recordId and gmailThreadId required');
        url = `${NETHUNT_BASE}/actions/link-gmail-thread/${body.recordId}`;
        method = 'POST';
        payload = JSON.stringify({ gmailThreadId: body.gmailThreadId });
        break;
      }

      // ── Auth test ──
      case 'auth-test': {
        url = `${NETHUNT_BASE}/triggers/auth-test`;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const fetchOpts: RequestInit = { method, headers: authHeaders };
    if (payload) fetchOpts.body = payload;

    const response = await fetch(url, fetchOpts);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`NetHunt API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('NetHunt proxy error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
