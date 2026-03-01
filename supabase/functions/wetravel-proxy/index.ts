import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WETRAVEL_BASE = 'https://api.wetravel.com/v2';

// Cache access token in memory (valid for 1 hour)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(refreshToken: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const response = await fetch(`${WETRAVEL_BASE}/auth/tokens/access`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeTravel auth failed [${response.status}]: ${body}`);
  }

  const data = await response.json();
  const token = data.access_token || data.token;
  if (!token) {
    throw new Error(`No access token in response: ${JSON.stringify(data)}`);
  }

  // Cache for 55 minutes (token valid for 60)
  cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const REFRESH_TOKEN = Deno.env.get('WETRAVEL_REFRESH_TOKEN');
  if (!REFRESH_TOKEN) {
    return new Response(JSON.stringify({ error: 'WeTravel refresh token not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const accessToken = await getAccessToken(REFRESH_TOKEN);
    const { action, page, per_page, filters } = await req.json();

    let url = '';
    let method = 'GET';
    let body: string | undefined;

    switch (action) {
      case 'list-trips':
        const tripParams = new URLSearchParams();
        tripParams.set('per_page', String(per_page || 50));
        tripParams.set('page', String(page || 1));
        url = `${WETRAVEL_BASE}/draft_trips?${tripParams}`;
        break;
      case 'list-transactions':
        url = `${WETRAVEL_BASE}/transactions`;
        method = 'POST';
        body = JSON.stringify({
          page: page || 1,
          per_page: per_page || 50,
          ...(filters ? { filters } : {}),
        });
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, { method, headers, ...(body ? { body } : {}) });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`WeTravel API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WeTravel proxy error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
