// Public Bókun → TCC webhook (one-way). Validates the Bókun HMAC, stores the raw event in
// bokun_events (idempotent by event_id), answers 200 fast and processes in the background.
// Writes ONLY to the TCC database: NetHunt deal creation (official YT ID) and Calendar run
// through the existing sync_queue / sync-worker flows.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_URL = 'https://yourtoursportugal.lovable.app/leads/';
const BLOCK_START = '--- Bókun (automático) ---';
const BLOCK_END = '--- fim Bókun ---';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(msg));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Bókun signs the sorted x-bokun-* headers (name=value joined by &); also accepts a body signature. */
async function verify(req: Request, raw: string, secret: string): Promise<boolean> {
  const given = (req.headers.get('x-bokun-hmac') || req.headers.get('x-bokun-signature') || '').trim();
  if (!given) return false;
  const parts: string[] = [];
  req.headers.forEach((v, k) => {
    const n = k.toLowerCase();
    if (n.startsWith('x-bokun-') && n !== 'x-bokun-hmac' && n !== 'x-bokun-signature') parts.push(`${n}=${v}`);
  });
  parts.sort();
  const candidates = [await hmac(secret, parts.join('&')), await hmac(secret, raw)];
  return candidates.some((c) => safeEq(given.toLowerCase(), hex(c)) || safeEq(given, b64(c)));
}

type Kind = 'booking_confirmed' | 'booking_changed' | 'booking_cancelled';
function eventKind(topic: string, p: any): Kind | null {
  const t = `${topic} ${p?.event ?? p?.type ?? p?.topic ?? ''}`.toLowerCase();
  const st = String(p?.status ?? p?.booking?.status ?? '').toUpperCase();
  if (t.includes('cancel') || st === 'CANCELLED') return 'booking_cancelled';
  if (t.includes('update') || t.includes('change') || t.includes('amend')) return 'booking_changed';
  if (t.includes('create') || t.includes('confirm') || t.includes('new')) return 'booking_confirmed';
  return null;
}

const s = (v: unknown) => (v == null ? '' : String(v).trim());
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
function dateOnly(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
  const m = String(v).match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date(String(v));
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

/** Maps a Bókun booking payload (defensively, several API shapes) to TCC lead fields. */
export function parseBooking(p: any) {
  const b = p?.booking ?? p;
  const code = s(b?.confirmationCode ?? b?.externalBookingReference ?? p?.confirmationCode);
  const c = b?.customer ?? b?.leadCustomer ?? {};
  const acts: any[] = b?.activityBookings ?? b?.productBookings ?? [];
  const a = acts[0] ?? {};
  const product = s(a?.product?.title ?? a?.activity?.title ?? a?.title ?? b?.productTitle) || 'Produto Bókun';
  const starts = acts.map((x) => dateOnly(x?.startDate ?? x?.date ?? x?.startDateTime)).filter(Boolean) as string[];
  const ends = acts.map((x) => dateOnly(x?.endDate ?? x?.startDate ?? x?.date ?? x?.startDateTime)).filter(Boolean) as string[];
  const start = starts.sort()[0] ?? dateOnly(b?.startDate);
  const end = ends.sort().at(-1) ?? start;
  const time = s(a?.startTime ?? a?.startTimeStr ?? (a?.startDateTime ? String(a.startDateTime).slice(11, 16) : ''));
  let adults = 0, children = 0, infants = 0;
  for (const x of acts) {
    const cats: any[] = x?.pricingCategoryBookings ?? x?.passengers ?? [];
    for (const pc of cats) {
      const label = s(pc?.pricingCategory?.title ?? pc?.title ?? pc?.category).toLowerCase();
      const q = n(pc?.quantity) ?? 1;
      if (/infant|bebé|bebe|baby/.test(label)) infants += q;
      else if (/child|criança|crianca|kid|youth|júnior/.test(label)) children += q;
      else adults += q;
    }
    if (!cats.length) adults += n(x?.totalParticipants ?? x?.participants) ?? 0;
  }
  const lang = s(a?.language ?? a?.guidedLanguage ?? b?.language);
  const total = n(b?.totalPrice ?? b?.totalPriceAmount?.amount ?? b?.totalAmount);
  const paid = n(b?.totalPaid ?? b?.paidAmount ?? b?.totalPaidAmount?.amount);
  const currency = s(b?.currency ?? b?.totalPriceAmount?.currency) || 'EUR';
  const name = [s(c?.firstName), s(c?.lastName)].filter(Boolean).join(' ') || s(c?.name) || 'Cliente Bókun';
  const extra = [s(b?.specialRequests), s(a?.notes), s(b?.notes), s(a?.pickupPlace?.title ?? a?.pickupPlaceDescription)].filter(Boolean);
  const days = start && end ? Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86400000) + 1) : 1;
  return { code, name, email: s(c?.email), phone: s(c?.phoneNumber ?? c?.phone), product, start, end, time, adults, children, infants, lang, total, paid, currency, extra, days, channel: s(b?.channel?.title ?? b?.seller?.title) };
}

function bokunBlock(x: ReturnType<typeof parseBooking>) {
  const money = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)} ${x.currency}`);
  return [
    BLOCK_START,
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
function mergeNotes(current: string, block: string) {
  const i = current.indexOf(BLOCK_START), j = current.indexOf(BLOCK_END);
  if (i >= 0 && j > i) return current.slice(0, i) + block + current.slice(j + BLOCK_END.length);
  return current ? `${current}\n\n${block}` : block;
}

const commonFields = (x: ReturnType<typeof parseBooking>) => ({
  travel_dates: x.start ?? 'A definir',
  travel_end_date: x.end ?? '',
  trip_start: x.start,
  trip_finish: x.end,
  number_of_days: x.days,
  dates_type: 'concrete',
  pax: x.adults || (x.children ? 0 : 1),
  pax_children: x.children,
  pax_infants: x.infants,
  estimated_value: x.total ?? x.paid,
});

async function alertAdmins(sb: any, ev: { id: string; code: string | null; kind: string }, msg: string, leadId: string | null) {
  try {
    await sb.from('agent_notifications').insert({
      type: 'alert', priority: 'urgent', agent_name: 'bokun',
      title: `Bókun: falha ao processar ${ev.code || 'reserva'}`,
      body: `${ev.kind} — ${msg}`.slice(0, 1000),
      entity_type: leadId ? 'lead' : 'bokun_event', entity_id: leadId ?? ev.id, entity_ref: ev.code,
      metadata: { bokun_event_id: ev.id },
    });
    const { data } = await sb.from('integration_settings').select('config').eq('name', 'sync_admins').maybeSingle();
    const admins: string[] = ((data?.config as any)?.emails || ['yorick.viche@yourtours.pt']).map((e: string) => String(e).trim()).filter(Boolean);
    const link = leadId ? `${ADMIN_URL}${leadId}` : '';
    for (const to of admins) {
      await sb.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          message_id: crypto.randomUUID(), idempotency_key: `bokun-fail-${ev.id}-${to}`, to,
          from: 'Your Tours TCC <noreply@yourtours.pt>', sender_domain: 'notify.yourtours.pt',
          subject: `Falha Bókun — ${ev.code || ev.kind}`,
          text: `Evento Bókun ${ev.kind} (${ev.code || 'sem código'}) falhou.\nErro: ${msg}\n${link}`,
          html: `<p>Evento Bókun <b>${ev.kind}</b> (${ev.code || 'sem código'}) falhou.</p><p>Erro: ${msg.replace(/</g, '&lt;')}</p>${link ? `<p><a href="${link}">${link}</a></p>` : ''}`,
          purpose: 'transactional', label: 'bokun_failure', queued_at: new Date().toISOString(),
        },
      });
    }
  } catch (e) { console.error('alertAdmins failed', e); }
}

async function processEvent(sb: any, ev: { id: string; kind: Kind; payload: any }) {
  const x = parseBooking(ev.payload);
  let leadId: string | null = null;
  try {
    if (!x.code) throw new Error('Payload sem confirmationCode');
    const { data: existing, error: fe } = await sb.from('leads').select('id, notes, tags, status').eq('bokun_confirmation_code', x.code).maybeSingle();
    if (fe) throw new Error(`Leitura da lead: ${fe.message}`);
    leadId = existing?.id ?? null;

    if (ev.kind === 'booking_cancelled') {
      if (!existing) throw new Error(`Cancelamento de ${x.code} sem lead correspondente no TCC`);
      const tags = Array.from(new Set([...(existing.tags ?? []), 'Cancelado']));
      const { error } = await sb.from('leads').update({
        status: 'lost', nethunt_stage: 'OPERATIONS - Archive', tags,
        notes: mergeNotes(existing.notes ?? '', bokunBlock(x).replace(BLOCK_START, `${BLOCK_START}\nESTADO: CANCELADO NA BÓKUN`)),
      }).eq('id', existing.id);
      if (error) throw new Error(`Cancelar lead: ${error.message}`);
    } else if (existing) {
      // Confirmed again or changed: update Bókun data only, keep manual notes.
      const { error } = await sb.from('leads').update({ ...commonFields(x), notes: mergeNotes(existing.notes ?? '', bokunBlock(x)) }).eq('id', existing.id);
      if (error) throw new Error(`Atualizar lead: ${error.message}`);
    } else {
      if (ev.kind === 'booking_changed') console.warn(`Alteração de ${x.code} sem lead — a criar`);
      const { data: created, error } = await sb.from('leads').insert({
        ...commonFields(x),
        client_name: x.name, email: x.email, phone: x.phone,
        destination: x.product, client_type: 'B2C',
        source: 'ota', booking_origin: 'Bókun', external_booking_ref: x.code, bokun_confirmation_code: x.code,
        service_language: x.lang || null, language: x.lang || null,
        status: 'won', nethunt_stage: 'OPERATIONS - Deposit/Payment Received',
        close_date: new Date().toISOString().slice(0, 10), created_via: 'bokun',
        notes: `Programa: ${x.code} · ${x.product}\n\n${bokunBlock(x)}`,
      }).select('id').single();
      if (error) throw new Error(`Criar lead: ${error.message}`);
      leadId = created.id;
      // Existing flow: sync-worker creates the NetHunt deal, which assigns the official YT ID.
      const { error: qe } = await sb.rpc('enqueue_sync', { p_target: 'nethunt', p_entity: 'lead_create_deal', p_entity_id: leadId, p_fields: [], p_reason: 'bokun' });
      if (qe) throw new Error(`Fila NetHunt: ${qe.message}`);
    }
    await sb.from('bokun_events').update({ status: 'processado', lead_id: leadId, confirmation_code: x.code, processed_at: new Date().toISOString(), error_message: null }).eq('id', ev.id);
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 2000);
    console.error('bokun process error', ev.id, msg);
    await sb.from('bokun_events').update({ status: 'erro', error_message: msg, lead_id: leadId, processed_at: new Date().toISOString() }).eq('id', ev.id);
    await alertAdmins(sb, { id: ev.id, code: x.code || null, kind: ev.kind }, msg, leadId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ ok: true });
  const secret = Deno.env.get('BOKUN_WEBHOOK_SECRET');
  if (!secret) return reply({ error: 'not configured' }, 503);
  const raw = await req.text();
  if (!(await verify(req, raw, secret))) return reply({ error: 'invalid signature' }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let payload: any = {};
  try { payload = JSON.parse(raw || '{}'); } catch { payload = { _unparsed: raw.slice(0, 50000) }; }
  const topic = req.headers.get('x-bokun-topic') || '';
  const kind = eventKind(topic, payload);
  const headerObj: Record<string, string> = {};
  req.headers.forEach((v, k) => { if (k.startsWith('x-bokun-') && k !== 'x-bokun-hmac') headerObj[k] = v; });
  const eventId = req.headers.get('x-bokun-event-id') || req.headers.get('x-bokun-webhook-id') ||
    hex(await crypto.subtle.digest('SHA-256', enc.encode(`${topic}|${raw}`)));
  const code = parseBooking(payload).code || null;

  const { data: row, error } = await sb.from('bokun_events').insert({
    event_id: eventId, confirmation_code: code, event_type: kind ?? (topic || 'desconhecido'),
    raw_payload: payload, headers: headerObj, status: kind ? 'recebido' : 'erro',
    error_message: kind ? null : `Tipo de evento desconhecido (${topic || 'sem topic'})`,
  }).select('id').single();
  if (error) {
    if ((error as any).code === '23505') return reply({ ok: true, duplicate: true });
    console.error('bokun_events insert failed', error);
    return reply({ error: 'storage failed' }, 500); // Bókun retries
  }
  if (!kind) {
    await alertAdmins(sb, { id: row.id, code, kind: topic || 'desconhecido' }, 'Tipo de evento desconhecido', null);
    return reply({ ok: true, stored: true });
  }
  const work = processEvent(sb, { id: row.id, kind, payload });
  // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work); else await work;
  return reply({ ok: true });
});
