import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;


  const REFRESH_TOKEN = Deno.env.get('WETRAVEL_REFRESH_TOKEN');
  if (!REFRESH_TOKEN) {
    return new Response(JSON.stringify({ error: 'WeTravel refresh token not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const accessToken = await getAccessToken(REFRESH_TOKEN);
    const body_in = await req.json();
    const { action, page, per_page, filters } = body_in;

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
      case 'create-trip': {
        const {
          title, description, start_date, end_date,
          total_price, deposit_price, currency = 'EUR',
          cover_image_url, client_name,
        } = body_in;

        const tripRes = await fetch(`${WETRAVEL_BASE}/draft_trips`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: title,
            description: description || `Private tour for ${client_name} — Your Tours Portugal`,
            ...(start_date ? { start_date } : {}),
            ...(end_date ? { end_date } : {}),
            currency,
            ...(cover_image_url ? { photo_url: cover_image_url } : {}),
          }),
        });
        if (!tripRes.ok) throw new Error(`WeTravel create trip [${tripRes.status}]: ${await tripRes.text()}`);
        const tripData = await tripRes.json();
        const tripUuid = tripData.uuid ?? tripData.id ?? tripData.draft_trip?.uuid;
        if (!tripUuid) throw new Error(`No UUID returned: ${JSON.stringify(tripData)}`);

        const pkgRes = await fetch(`${WETRAVEL_BASE}/draft_trips/${tripUuid}/packages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: 'Private Programme — Full Tour',
            price: total_price,
            description: `Complete private programme as per proposal. A refundable deposit of ${currency} ${deposit_price} is due now to confirm your booking. This deposit is 100% refundable.`,
            quantity: 1,
          }),
        });
        if (!pkgRes.ok) throw new Error(`WeTravel create package [${pkgRes.status}]: ${await pkgRes.text()}`);
        const pkgData = await pkgRes.json();
        const packageId = pkgData.id ?? pkgData.package?.id;
        if (!packageId) throw new Error(`No package ID: ${JSON.stringify(pkgData)}`);

        try {
          await fetch(`${WETRAVEL_BASE}/draft_trips/${tripUuid}/packages/${packageId}/payment_plans`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              price: deposit_price,
              days_before_departure: 1,
              description: '100% Refundable Deposit — secure your spot',
            }),
          });
        } catch (e) {
          console.error('Payment plan creation failed (non-fatal):', e);
        }

        const checkoutUrl = tripData.checkout_url ?? tripData.booking_url ?? `https://www.wetravel.com/trips/${tripUuid}/checkout`;
        const tripUrl = tripData.trip_url ?? tripData.url ?? `https://www.wetravel.com/trips/${tripUuid}`;

        return new Response(JSON.stringify({ trip_uuid: tripUuid, trip_url: tripUrl, checkout_url: checkoutUrl, package_id: packageId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
