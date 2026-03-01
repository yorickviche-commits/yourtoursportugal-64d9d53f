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

  try {
    const { action, folderId, query, limit } = await req.json();

    let url = '';
    let method = 'GET';

    switch (action) {
      case 'list-folders':
        url = `${NETHUNT_BASE}/triggers/readable-folder`;
        break;
      case 'find-records':
        if (!folderId) throw new Error('folderId required');
        const params = new URLSearchParams();
        if (query) params.set('query', query);
        params.set('limit', String(limit || 50));
        url = `${NETHUNT_BASE}/searches/find-record/${folderId}?${params}`;
        break;
      case 'recent-records':
        if (!folderId) throw new Error('folderId required');
        const rParams = new URLSearchParams();
        rParams.set('limit', String(limit || 20));
        url = `${NETHUNT_BASE}/triggers/new-record/${folderId}?${rParams}`;
        break;
      case 'folder-fields':
        if (!folderId) throw new Error('folderId required');
        url = `${NETHUNT_BASE}/triggers/folder-field/${folderId}`;
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    });

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
