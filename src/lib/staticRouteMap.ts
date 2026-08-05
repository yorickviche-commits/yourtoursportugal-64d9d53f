/**
 * Renders a static "screenshot-like" route map into a JPEG data URL, so the PDF
 * can show the same route the digital itinerary shows (and link it to the
 * original Google Maps route).
 *
 * The real driving route comes from the Google Routes API (via the
 * `route-map-image` edge function); tiles come from the CARTO Voyager basemap
 * (Google-Maps-like look, CORS-enabled, retina @2x).
 */

import { parseGoogleMapsUrl } from '@/lib/mapEmbed';
import { supabase } from '@/integrations/supabase/client';

const TILE = 256;

interface LatLng { lat: number; lng: number }

const lon2x = (lng: number, z: number) => ((lng + 180) / 360) * Math.pow(2, z) * TILE;
const lat2y = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return ((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z)) * TILE;
};

const geoCache = new Map<string, LatLng | null>();

async function geocode(query: string): Promise<LatLng | null> {
  const key = query.toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key)!;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    const hit = Array.isArray(d) && d[0] ? { lat: Number(d[0].lat), lng: Number(d[0].lon) } : null;
    geoCache.set(key, hit);
    return hit;
  } catch {
    geoCache.set(key, null);
    return null;
  }
}

function parseCoord(s: string): LatLng | null {
  const m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

/** Google encoded-polyline decoder. */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface RouteMapImage {
  dataUrl: string;
  width: number;
  height: number;
  stops: string[];
}

const routeCache = new Map<string, { polyline: string | null; stops: string[] } | null>();

async function fetchRoute(mapUrl: string) {
  const key = mapUrl.trim();
  if (routeCache.has(key)) return routeCache.get(key)!;
  try {
    const { data, error } = await supabase.functions.invoke('route-map-image', { body: { mapUrl: key } });
    if (error) throw error;
    const d = data as { polyline?: string | null; stops?: string[] } | null;
    const res = d ? { polyline: d.polyline ?? null, stops: d.stops || [] } : null;
    routeCache.set(key, res);
    return res;
  } catch (e) {
    console.warn('Route lookup failed, falling back to straight lines', e);
    routeCache.set(key, null);
    return null;
  }
}

/**
 * @param mapUrl a Google Maps share URL (directions / place / @lat,lng / ?q=)
 */
export async function buildRouteMapImage(
  mapUrl: string,
  width = 1000,
  height = 460,
): Promise<RouteMapImage | null> {
  if (typeof document === 'undefined' || !mapUrl) return null;

  const route = await fetchRoute(mapUrl);
  const parsed = parseGoogleMapsUrl(mapUrl);
  const labels = (route?.stops?.length ? route.stops : parsed.waypoints).filter(Boolean);

  // Coordinates from the URL itself when present
  const inlineCoords = Array.from(mapUrl.matchAll(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/g)).map(m => ({
    lat: Number(m[1]),
    lng: Number(m[2]),
  }));

  const routePath = route?.polyline ? decodePolyline(route.polyline) : [];

  // Stop markers
  let stopPoints: LatLng[] = [];
  for (const label of labels) {
    const direct = parseCoord(label);
    if (direct) { stopPoints.push(direct); continue; }
    const geo = await geocode(label);
    if (geo) stopPoints.push(geo);
  }
  if (stopPoints.length < 1) stopPoints = inlineCoords;

  const linePath = routePath.length > 1 ? routePath : stopPoints;
  const fitPoints = routePath.length > 1 ? routePath : [...stopPoints, ...inlineCoords];
  if (fitPoints.length < 1) return null;

  // Bounds + zoom fit
  const lats = fitPoints.map(p => p.lat);
  const lngs = fitPoints.map(p => p.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  if (maxLat - minLat < 0.02) { minLat -= 0.03; maxLat += 0.03; }
  if (maxLng - minLng < 0.02) { minLng -= 0.03; maxLng += 0.03; }
  const padLat = (maxLat - minLat) * 0.1;
  const padLng = (maxLng - minLng) * 0.1;
  minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;

  let zoom = 16;
  while (zoom > 3) {
    const w = lon2x(maxLng, zoom) - lon2x(minLng, zoom);
    const h = lat2y(minLat, zoom) - lat2y(maxLat, zoom);
    if (w <= width && h <= height) break;
    zoom -= 1;
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const originX = lon2x(centerLng, zoom) - width / 2;
  const originY = lat2y(centerLat, zoom) - height / 2;

  // Render at 2x for a crisp PDF image
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#e8eef4';
  ctx.fillRect(0, 0, width, height);

  const tileMin = { x: Math.floor(originX / TILE), y: Math.floor(originY / TILE) };
  const tileMax = { x: Math.floor((originX + width) / TILE), y: Math.floor((originY + height) / TILE) };
  const maxTile = Math.pow(2, zoom) - 1;

  const jobs: Promise<void>[] = [];
  for (let tx = tileMin.x; tx <= tileMax.x; tx++) {
    for (let ty = tileMin.y; ty <= tileMax.y; ty++) {
      if (ty < 0 || ty > maxTile) continue;
      const wrapX = ((tx % (maxTile + 1)) + maxTile + 1) % (maxTile + 1);
      const url = `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${wrapX}/${ty}@2x.png`;
      const fallback = `https://tile.openstreetmap.org/${zoom}/${wrapX}/${ty}.png`;
      const dx = tx * TILE - originX;
      const dy = ty * TILE - originY;
      jobs.push(
        loadImage(url)
          .then(img => img || loadImage(fallback))
          .then(img => {
            if (img) ctx.drawImage(img, Math.round(dx), Math.round(dy), TILE, TILE);
          }),
      );
    }
  }
  await Promise.all(jobs);

  const proj = (p: LatLng) => ({ x: lon2x(p.lng, zoom) - originX, y: lat2y(p.lat, zoom) - originY });

  if (linePath.length > 1) {
    const stroke = (color: string, w: number) => {
      ctx.beginPath();
      linePath.forEach((p, i) => {
        const { x, y } = proj(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    stroke('rgba(255,255,255,0.9)', 8);
    stroke('#2a3ad6', 5);
  }

  stopPoints.forEach((p, i) => {
    const { x, y } = proj(p);
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#0a2540';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y + 1);
  });

  // Attribution
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(width - 205, height - 20, 205, 20);
  ctx.fillStyle = '#334155';
  ctx.font = '11px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('© OpenStreetMap · CARTO · Google routes', width - 5, height - 6);

  try {
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: width * scale, height: height * scale, stops: labels };
  } catch {
    return null;
  }
}
