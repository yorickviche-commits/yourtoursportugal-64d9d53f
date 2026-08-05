/**
 * Renders a static "screenshot-like" route map (OpenStreetMap tiles + route line
 * + numbered stop markers) into a JPEG data URL, so it can be embedded in the
 * generated PDF and linked to the original Google Maps route.
 *
 * No API key needed: OSM tiles + Nominatim geocoding (both CORS-enabled).
 */

import { parseGoogleMapsUrl } from '@/lib/mapEmbed';

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

/**
 * @param mapUrl a Google Maps share URL (directions / place / @lat,lng / ?q=)
 */
export async function buildRouteMapImage(
  mapUrl: string,
  width = 1000,
  height = 460,
): Promise<RouteMapImage | null> {
  if (typeof document === 'undefined' || !mapUrl) return null;

  const parsed = parseGoogleMapsUrl(mapUrl);
  const labels = parsed.waypoints.filter(Boolean);

  // Coordinates from the URL itself when present
  const inlineCoords = Array.from(mapUrl.matchAll(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/g)).map(m => ({
    lat: Number(m[1]),
    lng: Number(m[2]),
  }));

  let points: LatLng[] = [];
  for (const label of labels) {
    const direct = parseCoord(label);
    if (direct) { points.push(direct); continue; }
    const geo = await geocode(label);
    if (geo) points.push(geo);
  }
  if (points.length < 1) points = inlineCoords;
  if (points.length < 1) return null;

  // Bounds + zoom fit
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  if (maxLat - minLat < 0.02) { minLat -= 0.05; maxLat += 0.05; }
  if (maxLng - minLng < 0.02) { minLng -= 0.05; maxLng += 0.05; }
  const padLat = (maxLat - minLat) * 0.15;
  const padLng = (maxLng - minLng) * 0.15;
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
  const cx = lon2x(centerLng, zoom);
  const cy = lat2y(centerLat, zoom);
  const originX = cx - width / 2;
  const originY = cy - height / 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
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
      const url = `https://tile.openstreetmap.org/${zoom}/${wrapX}/${ty}.png`;
      const dx = tx * TILE - originX;
      const dy = ty * TILE - originY;
      jobs.push(
        loadImage(url).then(img => {
          if (img) ctx.drawImage(img, Math.round(dx), Math.round(dy), TILE, TILE);
        }),
      );
    }
  }
  await Promise.all(jobs);

  const proj = (p: LatLng) => ({ x: lon2x(p.lng, zoom) - originX, y: lat2y(p.lat, zoom) - originY });

  if (points.length > 1) {
    ctx.beginPath();
    points.forEach((p, i) => {
      const { x, y } = proj(p);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(60,60,220,0.9)';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  points.forEach((p, i) => {
    const { x, y } = proj(p);
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#0a2540';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y + 1);
  });

  // Attribution
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(width - 190, height - 22, 190, 22);
  ctx.fillStyle = '#334155';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('© OpenStreetMap contributors', width - 6, height - 7);

  try {
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width, height, stops: labels };
  } catch {
    return null;
  }
}
