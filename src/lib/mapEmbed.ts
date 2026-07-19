// Helpers to turn a Google Maps share URL (as pasted by an agent) into an
// embeddable iframe src AND to extract human-readable waypoints for the PDF.
//
// The classic `maps.google.com/maps?...&output=embed` endpoint bypasses the
// consent.google.* interstitial that blocks `google.com/maps/...?output=embed`
// inside an iframe, so we normalize every supported input into that shape.

export interface ParsedMapUrl {
  embedSrc: string | null;
  waypoints: string[]; // decoded, human-readable
  originalUrl: string;
}

const decodeSeg = (s: string): string => {
  try {
    return decodeURIComponent(s).replace(/\+/g, ' ').trim();
  } catch {
    return s.replace(/\+/g, ' ').trim();
  }
};

export function parseGoogleMapsUrl(rawUrl: string): ParsedMapUrl {
  const url = (rawUrl || '').trim();
  const empty: ParsedMapUrl = { embedSrc: null, waypoints: [], originalUrl: url };
  if (!url) return empty;

  // Already an embed
  if (/\/maps\/embed(\?|\/)/i.test(url)) {
    return { embedSrc: url, waypoints: [], originalUrl: url };
  }
  if (/[?&]output=embed\b/i.test(url)) {
    return { embedSrc: url, waypoints: [], originalUrl: url };
  }

  // Short links — not embeddable without following the redirect
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url)) {
    return { embedSrc: null, waypoints: [], originalUrl: url };
  }

  // Directions: /maps/dir/A/B/C/@lat,lng/data=...
  const dirMatch = url.match(/\/maps\/dir\/([^@]+?)(?:\/@|\/data=|\?|$)/i);
  if (dirMatch) {
    const stops = dirMatch[1]
      .split('/')
      .map(decodeSeg)
      .filter(s => s && s.length > 0 && !/^[-+]?\d+\.\d+,[-+]?\d+\.\d+$/.test(s));
    if (stops.length >= 2) {
      const saddr = encodeURIComponent(stops[0]);
      const daddr = stops.slice(1).map(s => encodeURIComponent(s)).join('+to:');
      return {
        embedSrc: `https://maps.google.com/maps?saddr=${saddr}&daddr=${daddr}&output=embed`,
        waypoints: stops,
        originalUrl: url,
      };
    }
  }

  // Place: /maps/place/<name>/@lat,lng
  const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/i);
  if (placeMatch) {
    const name = decodeSeg(placeMatch[1]);
    return {
      embedSrc: `https://maps.google.com/maps?q=${encodeURIComponent(name)}&output=embed`,
      waypoints: [name],
      originalUrl: url,
    };
  }

  // Bare @lat,lng[,zoom]
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)(?:,(\d+(?:\.\d+)?)z)?/);
  if (atMatch) {
    const lat = atMatch[1];
    const lng = atMatch[2];
    const z = atMatch[3] || '10';
    return {
      embedSrc: `https://maps.google.com/maps?q=${lat},${lng}&z=${Math.round(Number(z))}&output=embed`,
      waypoints: [`${lat}, ${lng}`],
      originalUrl: url,
    };
  }

  // ?q= search
  try {
    const u = new URL(url);
    const q = u.searchParams.get('q');
    if (q) {
      return {
        embedSrc: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`,
        waypoints: [q],
        originalUrl: url,
      };
    }
  } catch {
    // ignore
  }

  return empty;
}

export function toMapEmbedSrc(url: string): string | null {
  return parseGoogleMapsUrl(url).embedSrc;
}
