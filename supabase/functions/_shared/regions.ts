// Loads active regions (PT + ES) and their cities from the database.
export interface RegionRow { name: string; country: string; cities: string[] }

export async function loadRegions(): Promise<RegionRow[]> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return [];
  try {
    const h = { apikey: key, Authorization: `Bearer ${key}` };
    const [r, d] = await Promise.all([
      fetch(`${url}/rest/v1/regions?select=id,name,country&is_active=eq.true&order=sort_order`, { headers: h }).then(x => x.json()),
      fetch(`${url}/rest/v1/region_destinations?select=region_id,name&is_active=eq.true&order=sort_order`, { headers: h }).then(x => x.json()),
    ]);
    if (!Array.isArray(r)) return [];
    return r.map((x: any) => ({
      name: x.name, country: x.country || 'PT',
      cities: (Array.isArray(d) ? d : []).filter((c: any) => c.region_id === x.id).map((c: any) => c.name),
    }));
  } catch { return []; }
}

export function regionsDirective(regions: RegionRow[]): string {
  if (!regions.length) return '';
  const fmt = (c: string) => regions.filter(r => r.country === c)
    .map(r => r.cities.length ? `${r.name} (${r.cities.join(', ')})` : r.name).join('; ');
  return `\n\nDESTINATIONS WE OPERATE (Portugal + Spain):\n- Portugal: ${fmt('PT')}\n- Spain: ${fmt('ES')}\nMulti-country programmes (Portugal + Spain) are allowed: plan realistic cross-border transfers. For EVERY day add "country" ("PT" or "ES") and "region" (one of the region names above) to the day object. Never mention supplier/partner names or net prices.`;
}

/** Returns "Spain" or "Portugal" when the text mentions a known region/city. */
export function countryFor(text: string, regions: RegionRow[]): string | null {
  const t = text.toLowerCase();
  for (const r of regions) {
    if ([r.name, ...r.cities].some(n => n && t.includes(n.toLowerCase()))) return r.country === 'ES' ? 'Spain' : 'Portugal';
  }
  return null;
}
