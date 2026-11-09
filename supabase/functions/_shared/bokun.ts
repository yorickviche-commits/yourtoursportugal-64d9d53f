// Shared Bókun → TCC logic: signed REST calls, booking normalisation and lead upsert.
// Writes only to the TCC database; NetHunt/Calendar follow the existing sync_queue flows.

const enc = new TextEncoder();
const ADMIN_URL = 'https://yourtoursportugal.lovable.app/leads/';
export const BLOCK_START = '--- Bókun (automático) ---';
export const BLOCK_END = '--- fim Bókun ---';

// ---------- REST API (HMAC-SHA1, Base64) ----------
const pad = (n: number) => String(n).padStart(2, '0');
function bokunDate(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
export class BokunApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function bokunCall(method: string, path: string, body?: unknown): Promise<any> {
  const ak = Deno.env.get('BOKUN_ACCESS_KEY'), sk = Deno.env.get('BOKUN_SECRET_KEY');
  if (!ak || !sk) throw new BokunApiError('Chaves Bókun não configuradas', 0);
  const date = bokunDate();
  const key = await crypto.subtle.importKey('raw', enc.encode(sk), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(date + ak + method + path)))));
  const res = await fetch(`https://api.bokun.io${path}`, {
    method,
    headers: { 'X-Bokun-Date': date, 'X-Bokun-AccessKey': ak, 'X-Bokun-Signature': sig, 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new BokunApiError(`Bókun ${res.status}${res.status === 401 || res.status === 403 ? ' (autenticação)' : ''}: ${text.slice(0, 300)}`, res.status);
  return text ? JSON.parse(text) : {};
}

/** booking-search, paginated. Range values are epoch ms (format Bókun accepts). */
export async function searchBookings(filter: Record<string, unknown>, maxPages = 20): Promise<any[]> {
  const out: any[] = [];
  const pageSize = 50;
  for (let page = 1; page <= maxPages; page++) {
    const r = await bokunCall('POST', '/booking.json/booking-search', { bookingRole: 'SELLER', bookingStatuses: ['RESERVED', 'CONFIRMED', 'CANCELLED'], page, pageSize, ...filter });
    const items = (r?.items ?? []) as any[];
    out.push(...items);
    if (items.length < pageSize || out.length >= (r?.totalHits ?? 0)) break;
  }
  return out;
}

// ---------- Normalisation ----------
const s = (v: unknown) => (v == null ? '' : String(v).trim());
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const msDate = (v: unknown) => (typeof v === 'number' && v > 0 ? new Date(v).toISOString().slice(0, 10) : null);

export interface BokunBooking {
  code: string; status: 'confirmed' | 'cancelled'; name: string; email: string; phone: string; product: string;
  start: string | null; end: string | null; time: string; adults: number; children: number; infants: number;
  lang: string; total: number | null; paid: number | null; currency: string; channel: string; extra: string[]; days: number;
}

export function normalizeBooking(it: any): BokunBooking {
  const pbs: any[] = it?.productBookings ?? [];
  const live = pbs.filter((p) => String(p?.status).toUpperCase() !== 'CANCELLED');
  const use = live.length ? live : pbs;
  const first = use[0] ?? {};
  const starts = use.map((p) => msDate(p?.startDate)).filter(Boolean).sort() as string[];
  const ends = use.map((p) => msDate(p?.endDate ?? p?.startDate)).filter(Boolean).sort() as string[];
  const f = first?.fields ?? {};
  const time = s(f.startTimeStr) || (f.startHour != null ? `${pad(f.startHour)}:${pad(f.startMinute ?? 0)}` : '');
  let adults = 0, children = 0, infants = 0;
  for (const p of use) {
    const cats: any[] = p?.fields?.priceCategoryBookings ?? [];
    for (const c of cats) {
      const t = `${s(c?.pricingCategory?.ticketCategory)} ${s(c?.pricingCategory?.title ?? c?.bookedTitle)}`.toUpperCase();
      const q = num(c?.quantity) ?? 1;
      if (/INFANT|BABY|BEB/.test(t)) infants += q; else if (/CHILD|KID|CRIAN/.test(t)) children += q; else adults += q;
    }
    if (!cats.length) adults += num(p?.totalParticipants ?? p?.fields?.totalParticipants) ?? 0;
  }
  const c = it?.customer ?? {};
  const name = [s(c.firstName), s(c.lastName)].filter(Boolean).join(' ') || 'Cliente Bókun';
  const ota = [s(it?.channel?.title), s(first?.externalBookingEntityName), s(first?.agent?.title), s(first?.affiliate?.title), s(first?.saleSource)]
    .filter((x) => x && x.toLowerCase() !== 'backend');
  const extra = [
    ...use.flatMap((p) => (p?.notes ?? []).map((n: any) => s(n?.body ?? n?.text ?? n))),
    ...use.map((p) => s(p?.specialRequests)),
    s(f.pickupPlaceDescription) ? `Pickup: ${s(f.pickupPlaceDescription)}` : '',
    s(it?.externalBookingReference) ? `Ref. externa: ${s(it.externalBookingReference)}` : '',
  ].filter(Boolean);
  const start = starts[0] ?? null, end = ends.at(-1) ?? start;
  return {
    code: s(it?.confirmationCode),
    status: pbs.length && !live.length ? 'cancelled' : 'confirmed',
    name, email: s(c.email), phone: s(c.phoneNumber),
    product: use.map((p) => s(p?.product?.title)).filter(Boolean).join(' + ') || 'Produto Bókun',
    start, end, time, adults, children, infants,
    lang: s(first?.guidedLanguage ?? f.guidedLanguage ?? f.language ?? c.language),
    total: num(it?.customerInvoice?.totalAsMoney?.amount ?? it?.customerInvoice?.totalDueAsMoney?.amount ?? it?.totalPrice),
    paid: num(it?.paidAmountAsMoney?.amount),
    currency: s(it?.currency) || 'EUR',
    channel: Array.from(new Set(ota)).join(' · '),
    extra,
    days: start && end ? Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86400000) + 1) : 1,
  };
}

export async function bookingHash(x: BokunBooking) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(x)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Lead upsert ----------
function block(x: BokunBooking) {
  const money = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)} ${x.currency}`);
  return [
    BLOCK_START,
    x.status === 'cancelled' ? 'ESTADO: CANCELADO NA BÓKUN' : '',
    `Confirmação Bókun: ${x.code}`,
    `Produto: ${x.product}`,
    `Data: ${x.start ?? '—'}${x.end && x.end !== x.start ? ` → ${x.end}` : ''}${x.time ? ` · Hora: ${x.time}` : ''}`,
    `Pax: ${x.adults} adultos · ${x.children} crianças · ${x.infants} bebés`,
    `Idioma: ${x.lang || '—'}`,
    `Valor total: ${money(x.total)} · Pago: ${money(x.paid)}`,
    x.channel ? `Canal: ${x.channel}` : '',
    `Contacto: ${[x.email, x.phone].filter(Boolean).join(' · ') || '—'}`,
    ...(x.extra.length ? ['Notas do cliente:', ...x.extra] : []),
    BLOCK_END,
  ].filter(Boolean).join('\n');
}
/** Replaces only the automatic Bókun block; anything written by hand is preserved. */
export function mergeNotes(current: string, b: string) {
  const i = current.indexOf(BLOCK_START), j = current.indexOf(BLOCK_END);
  if (i >= 0 && j > i) return current.slice(0, i) + b + current.slice(j + BLOCK_END.length);
  return current ? `${current}\n\n${b}` : b;
}
const generalFields = (x: BokunBooking) => ({
  travel_dates: x.start ?? 'A definir', travel_end_date: x.end ?? '',
  trip_start: x.start, trip_finish: x.end, number_of_days: x.days, dates_type: 'concrete',
  pax: x.adults || (x.children ? 0 : 1), pax_children: x.children, pax_infants: x.infants,
  estimated_value: x.total ?? x.paid,
  booking_origin: x.channel ? `Bókun · ${x.channel}` : 'Bókun',
  service_language: x.lang || null,
});

export type ApplyResult = 'created' | 'updated' | 'cancelled' | 'unchanged';

export async function applyBooking(sb: any, x: BokunBooking): Promise<{ result: ApplyResult; leadId: string | null }> {
  if (!x.code) throw new Error('Reserva sem confirmationCode');
  const hash = await bookingHash(x);
  const { data: existing, error: fe } = await sb.from('leads').select('id, notes, tags, status, bokun_hash').eq('bokun_confirmation_code', x.code).maybeSingle();
  if (fe) throw new Error(`Leitura da lead: ${fe.message}`);
  if (existing && existing.bokun_hash === hash) return { result: 'unchanged', leadId: existing.id };

  if (x.status === 'cancelled') {
    if (!existing) return { result: 'unchanged', leadId: null }; // never seen as confirmed: nothing to cancel
    const tags = Array.from(new Set([...(existing.tags ?? []), 'Cancelado']));
    const { error } = await sb.from('leads').update({
      status: 'lost', nethunt_stage: 'OPERATIONS - Archive', tags, bokun_hash: hash,
      notes: mergeNotes(existing.notes ?? '', block(x)),
    }).eq('id', existing.id);
    if (error) throw new Error(`Cancelar lead: ${error.message}`);
    return { result: 'cancelled', leadId: existing.id };
  }
  if (existing) {
    const { error } = await sb.from('leads').update({ ...generalFields(x), notes: mergeNotes(existing.notes ?? '', block(x)), bokun_hash: hash }).eq('id', existing.id);
    if (error) throw new Error(`Atualizar lead: ${error.message}`);
    return { result: 'updated', leadId: existing.id };
  }
  const { data: created, error } = await sb.from('leads').insert({
    ...generalFields(x),
    client_name: x.name, email: x.email, phone: x.phone, destination: x.product, client_type: 'B2C',
    source: 'ota', external_booking_ref: x.code, bokun_confirmation_code: x.code, bokun_hash: hash,
    language: x.lang || null, status: 'won', nethunt_stage: 'OPERATIONS - Deposit/Payment Received',
    close_date: new Date().toISOString().slice(0, 10), created_via: 'bokun',
    notes: `Programa: ${x.code} · ${x.product}\n\n${block(x)}`,
  }).select('id').single();
  if (error) throw new Error(`Criar lead: ${error.message}`);
  // Existing flow: sync-worker creates the NetHunt deal, which assigns the official YT ID.
  const { error: qe } = await sb.rpc('enqueue_sync', { p_target: 'nethunt', p_entity: 'lead_create_deal', p_entity_id: created.id, p_fields: [], p_reason: 'bokun' });
  if (qe) throw new Error(`Fila NetHunt: ${qe.message}`);
  return { result: 'created', leadId: created.id };
}

// ---------- Alerts ----------
export async function alertAdmins(sb: any, a: { key: string; title: string; body: string; leadId?: string | null; ref?: string | null }) {
  try {
    await sb.from('agent_notifications').insert({
      type: 'alert', priority: 'urgent', agent_name: 'bokun', title: a.title.slice(0, 200), body: a.body.slice(0, 1000),
      entity_type: a.leadId ? 'lead' : 'bokun', entity_id: a.leadId ?? null, entity_ref: a.ref ?? null, metadata: { key: a.key },
    });
    const { data } = await sb.from('integration_settings').select('config').eq('name', 'sync_admins').maybeSingle();
    const admins: string[] = ((data?.config as any)?.emails || ['yorick.viche@yourtours.pt']).map((e: string) => String(e).trim()).filter(Boolean);
    const link = a.leadId ? `${ADMIN_URL}${a.leadId}` : '';
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    for (const to of admins) {
      await sb.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          message_id: crypto.randomUUID(), idempotency_key: `bokun-${a.key}-${to}`, to,
          from: 'Your Tours TCC <noreply@yourtours.pt>', sender_domain: 'notify.yourtours.pt',
          subject: a.title, text: `${a.body}\n${link}`,
          html: `<p>${esc(a.body)}</p>${link ? `<p><a href="${link}">${link}</a></p>` : ''}`,
          purpose: 'transactional', label: 'bokun_alert', queued_at: new Date().toISOString(),
        },
      });
    }
  } catch (e) { console.error('alertAdmins failed', e); }
}

export function lisbonHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: 'numeric', hourCycle: 'h23' }).format(d));
}
export const isBusinessHour = (h: number) => h >= 7 && h < 22;
