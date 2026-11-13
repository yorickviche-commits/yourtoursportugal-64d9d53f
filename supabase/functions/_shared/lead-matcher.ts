// Shared YT / Bókun / email matching used by workbench-sync-inbox, crm-email-sync and crm-addon.
export type MatchLead = { id: string; yt_id: string | null; email: string | null; bokun_confirmation_code: string | null; nethunt_stage?: string | null; status?: string | null };
export const normRef = (x: string) => x.toUpperCase().replace(/[\s-]/g, '');
export function extractRefs(text: string): string[] {
  const t = text || '';
  return [...new Set([...(t.match(/\bYT[\s-]*\d{4}(?:[\s-]*\d{3,})?\b/gi) || []), ...(t.match(/\b[A-Z]{2,5}-\d{5,}\b/g) || [])].map(normRef))];
}
export const isArchivedLead = (l: MatchLead) => /archive/i.test(l.nethunt_stage || '') || l.status === 'lost';
export async function loadLeadIndex(db: any): Promise<MatchLead[]> {
  const out: MatchLead[] = [];
  for (let f = 0; ; f += 1000) {
    const r = await db.from('leads').select('id,yt_id,email,bokun_confirmation_code,nethunt_stage,status').range(f, f + 999);
    if (r.error) throw r.error;
    out.push(...(r.data || []));
    if ((r.data || []).length < 1000) break;
  }
  return out;
}
export function matchByRefs(leads: MatchLead[], refs: string[]): MatchLead[] {
  if (!refs.length) return [];
  return leads.filter((l) => (l.yt_id && refs.includes(normRef(l.yt_id))) || (l.bokun_confirmation_code && refs.includes(normRef(l.bokun_confirmation_code))));
}
export function matchByEmail(leads: MatchLead[], email: string, activeOnly = false): MatchLead[] {
  const e = (email || '').trim().toLowerCase();
  if (!e) return [];
  return leads.filter((l) => l.email?.trim().toLowerCase() === e && (!activeOnly || !isArchivedLead(l)));
}
export const parseAddress = (raw: string) => ({ email: ((raw || '').match(/<([^>]+)>/)?.[1] || raw || '').trim().toLowerCase(), name: (raw || '').replace(/<[^>]+>/, '').replace(/"/g, '').trim() });
export const parseAddressList = (raw: string) => (raw || '').split(',').map((x) => parseAddress(x).email).filter((x) => x.includes('@'));
export const INTERNAL_DOMAIN = 'yourtours.pt';
export const isInternalEmail = (e: string) => e.toLowerCase().endsWith('@' + INTERNAL_DOMAIN);
