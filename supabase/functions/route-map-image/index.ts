// Resolves a day's Google Maps share URL into the REAL driving route polyline
// (Google Routes API through the Lovable connector gateway), so the PDF map can
// draw the same route the digital itinerary shows.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_maps';

const decodeSeg = (s: string) => {
  try { return decodeURIComponent(s).replace(/\+/g, ' ').trim(); } catch { return s.replace(/\+/g, ' ').trim(); }
};

async function resolveShortLink(url: string): Promise<string> {
  if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url)) return url;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    return r.url || url;
  } catch { return url; }
}

function extractStops(url: string): string[] {
  const dir = url.match(/\/maps\/dir\/([^@]+?)(?:\/@|\/data=|\?|$)/i);
  if (dir) {
    const stops = dir[1].split('/').map(decodeSeg).filter(Boolean);
    if (stops.length >= 2) return stops;
  }
  try {
    const u = new URL(url);
    const origin = u.searchParams.get('origin') || u.searchParams.get('saddr');
    const dest = u.searchParams.get('destination') || u.searchParams.get('daddr');
    const way = u.searchParams.get('waypoints') || '';
    if (origin && dest) {
      return [origin, ...way.split('|').filter(Boolean), dest].map(decodeSeg);
    }
    const q = u.searchParams.get('q');
    if (q) return [decodeSeg(q)];
  } catch { /* ignore */ }
  const place = url.match(/\/maps\/place\/([^/@?]+)/i);
  if (place) return [decodeSeg(place[1])];
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return [`${at[1]},${at[2]}`];
  return [];
}

const isCoord = (s: string) => /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(s);
const wp = (s: string) => (isCoord(s)
  ? { location: { latLng: { latitude: Number(s.split(',')[0]), longitude: Number(s.split(',')[1]) } } }
  : { address: s });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const mapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!lovableKey || !mapsKey) return json({ error: 'Google Maps connection not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body?.mapUrl === 'string' ? body.mapUrl.trim() : '';
    const width = Math.min(Math.max(Number(body?.width) || 640, 200), 640);
    const height = Math.min(Math.max(Number(body?.height) || 300, 120), 640);
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return json({ error: 'mapUrl is required' }, 400);

    const url = await resolveShortLink(rawUrl);
    const stops = extractStops(url).slice(0, 12);
    if (stops.length === 0) return json({ error: 'Could not read stops from map URL' }, 422);

    const h = { Authorization: `Bearer ${lovableKey}`, 'X-Connection-Api-Key': mapsKey };

    let polyline: string | null = null;
    if (stops.length >= 2) {
      const routeRes = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'routes.polyline.encodedPolyline' },
        body: JSON.stringify({
          origin: wp(stops[0]),
          destination: wp(stops[stops.length - 1]),
          intermediates: stops.slice(1, -1).map(wp),
          travelMode: 'DRIVE',
          polylineQuality: 'OVERVIEW',
        }),
      });
      if (routeRes.ok) {
        const rj = await routeRes.json();
        polyline = rj?.routes?.[0]?.polyline?.encodedPolyline ?? null;
      } else {
        console.error('Routes API failed', routeRes.status, await routeRes.text());
      }
    }

    return json({ polyline, stops, hasRoute: !!polyline });
  } catch (e) {
    console.error('route-map-image error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
