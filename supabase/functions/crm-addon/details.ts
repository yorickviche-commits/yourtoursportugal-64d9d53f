import { isInternalEmail } from '../_shared/lead-matcher.ts';
import { gateway } from '../_shared/workbench.ts';

export const excerpt = (s: string | null | undefined) => (s || '').slice(0, 1500);
export function plainText(s: string | null | undefined) {
  return excerpt((s || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?\s*>|<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'"));
}
export function supplierEmails(value: string | null) {
  return [...new Set((value || '').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [])];
}
const suppliers = new WeakMap<object, Promise<Map<string, any>>>();
export function supplierMap(sb: any) {
  let pending = suppliers.get(sb);
  if (!pending) {
    pending = (async () => {
      const map = new Map<string, any>();
      for (let from = 0; ; from += 1000) {
        const r = await sb.from('suppliers').select('id,name,contact_email').order('id').range(from, from + 999);
        if (r.error) throw r.error;
        for (const s of r.data || []) for (const email of supplierEmails(s.contact_email)) map.set(email, { id: s.id, name: s.name });
        if ((r.data || []).length < 1000) break;
      }
      return map;
    })();
    suppliers.set(sb, pending);
  }
  return pending;
}
export function emailParty(e: any, lead: any, map: Map<string, any>) {
  const from = (e.from_email || '').trim().toLowerCase();
  const to = (e.to_emails || []).map((s: string) => s.trim().toLowerCase());
  const all = [from, ...to].filter(Boolean);
  const external = all.filter(s => !isInternalEmail(s));
  if (all.length && !external.length) return { party: 'internal', party_name: null };
  const primary = e.direction === 'out' ? to[0] : from;
  const fse = map.get(primary);
  if (fse && !isInternalEmail(primary)) return { party: 'fse', party_name: fse.name };
  if (external.includes((lead.email || '').trim().toLowerCase())) return { party: 'client', party_name: (lead.client_name || '').replace(/^YT\s*-?\s*\d+\s*-\s*/i, '').split(/\s+[-|]\s+/)[0] };
  const otherFse = external.map(s => map.get(s)).find(Boolean);
  return otherFse ? { party: 'fse', party_name: otherFse.name } : { party: 'other', party_name: null };
}
export function eventDetails(e: any) {
  const at = (v: any) => v?.dateTime || (v?.date ? `${v.date}T00:00:00Z` : null);
  return { title: e.summary || '', start_at: at(e.start), end_at: at(e.end), location: e.location || '', description: plainText(e.description), html_link: e.htmlLink || null };
}
const eventMemory = new Map<string, { details: any; synced: number }>();
export async function hydrateEvents(sb: any, items: any[], writeCache = true) {
  let calendar = 'primary';
  try {
    const cfg = await sb.from('integration_settings').select('config').eq('name', 'google_calendar').maybeSingle();
    calendar = cfg.data?.config?.calendar_id || calendar;
  } catch (e) { console.error('crm-addon calendar configuration', String(e)); }
  const pending = new Map<string, Promise<any>>();
  await Promise.all(items.filter(i => i.type === 'event').slice(0, 25).map(async item => {
    const row = item._row, table = item._table;
    const cal = row.calendar_id || calendar, id = row.google_event_id || row.event_id;
    const key = `${cal}:${id}`;
    const remembered = eventMemory.get(key);
    const persisted = table === 'calendar_events' ? Date.parse(row.details_synced_at || '') : 0;
    const synced = Math.max(persisted || 0, remembered?.synced || 0);
    let details = row;
    if (remembered && remembered.synced > (persisted || 0)) details = { ...row, ...remembered.details };
    if (!synced || Date.now() - synced > 6 * 3600000) {
      try {
        let fetchDetails = pending.get(key);
        if (!fetchDetails) {
          fetchDetails = gateway('google_calendar', 'GOOGLE_CALENDAR_API_KEY', `/calendar/v3/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(id)}`).then(r => r.json()).then(eventDetails);
          pending.set(key, fetchDetails);
        }
        const fetched = await fetchDetails;
        details = { ...row, ...fetched };
        if (eventMemory.size >= 500) eventMemory.clear();
        eventMemory.set(key, { details: fetched, synced: Date.now() });
        if (writeCache) {
          const { title, start_at, end_at, location, description, html_link } = details;
          const patch = { title, start_at, end_at, location, description, html_link, ...(table === 'calendar_events' ? { details_synced_at: new Date().toISOString() } : {}) };
          const saved = await sb.from(table).update(patch).eq('id', row.id);
          if (saved.error) console.error('crm-addon event cache', saved.error.message);
        }
      } catch (e) { console.error('crm-addon event details', String(e)); }
    }
    Object.assign(item, { title: details.title || item.title, start: details.start_at || item.at, end: details.end_at || null, location: details.location || '', description: plainText(details.description), url: details.html_link || item.url });
    delete item._row; delete item._table;
  }));
  return items;
}
export function background(task: Promise<unknown>) {
  const safe = task.catch(e => console.error('crm-addon background', String(e)));
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(safe);
}