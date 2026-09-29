// Core partilhado (calendar-sync + sync-worker). Sincroniza operações de leads (estado "Ganho") para o Google Calendar partilhado YT.
// Sentido único: Lovable -> Google Calendar. Fonte de verdade = Supabase.
// Um evento por (lead, dia). Multi-day trips = múltiplos eventos, um por dia.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';
const APP_ORIGIN = 'https://yourtoursportugal.lovable.app';

const MANUAL_EDIT_MSG = 'Evento editado manualmente no Google Calendar — o TCC não sobrescreve. Rever no calendário.';
const ORPHAN_MISSING_MSG = 'Evento não encontrado no Google Calendar';
const ORPHAN_INACTIVE_MSG = 'Lead/dia já não está ativo no TCC — rever evento no calendário';

export interface SyncRequest {
  lead_id: string;
  mode?: 'create' | 'update' | 'delete' | 'full_resync' | 'force_overwrite' | 'preview';
  day_dates?: string[];
}

function gatewayHeaders(extra: Record<string, string> = {}) {
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
  if (!GOOGLE_CALENDAR_API_KEY) throw new Error('GOOGLE_CALENDAR_API_KEY not configured (connector not linked)');
  return {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Only GET / PATCH / POST are ever used. This function never issues DELETE to Google Calendar.
async function gcal(path: string, init: { method: 'GET' | 'PATCH' | 'POST'; body?: string; headers?: Record<string, string> }) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: init.method,
    body: init.body,
    headers: gatewayHeaders(init.headers || {}),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: res.ok, status: res.status, text, data };
}

async function calendarFetch(path: string, init: { method: 'POST'; body: string }) {
  const r = await gcal(path, init);
  if (!r.ok) throw new Error(`Google Calendar API ${r.status}: ${r.text}`);
  return r.data;
}

// Simple stable stringify + hash (djb2) — order-insensitive not required, JSON.stringify keeps insertion order which is fine here.
function hash(obj: unknown): string {
  const str = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h.toString(16);
}

function parseTravelStart(travel_dates: string | null, travel_end_date: string | null): Date | null {
  if (!travel_dates) return null;
  // Accepts "YYYY-MM-DD", "YYYY-MM-DD to YYYY-MM-DD", or an ISO date.
  const m = travel_dates.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return new Date(m[1] + 'T00:00:00Z');
  return null;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DayItem {
  key: string;
  title: string;
  supplier: string;
  costDesc: string;
  schedule_time: string | null;
  schedule_end_time: string | null;
  booking_status: string | null;
  payment_status: string | null;
  invoice_status: string | null;
  opNotes: string;
  itemNotes: string[];
  emailSentAt?: string;
}

interface DayOps {
  guide_name?: string | null; vehicle?: string | null; vehicle_pickup?: string | null;
  pickup_time?: string | null; pickup_location?: string | null; pickup_maps_url?: string | null;
  dropoff_location?: string | null; dropoff_maps_url?: string | null;
  notes_backoffice?: string | null; notes_guide?: string | null; guide_payment_amount?: number | null;
}

interface DayPayload {
  day_number: number;
  day_date: string;
  tour: string;
  ops: DayOps;
  items: DayItem[];
}

type StatusKey = 'por_confirmar' | 'parcial' | 'confirmado' | 'ok' | 'cancelado';
const DEFAULT_COLORS: Record<StatusKey, string> = { por_confirmar: '5', parcial: '6', confirmado: '9', ok: '10', cancelado: '8' };

function summarizeDayStatus(items: DayItem[]): { prefix: string; label: string; key: StatusKey } {
  const total = items.length;
  if (total === 0) return { prefix: '', label: 'Por confirmar', key: 'por_confirmar' };
  const cancelled = items.filter(i => i.booking_status === 'cancelled').length;
  if (cancelled === total) return { prefix: 'CANCELADO', label: 'Cancelado', key: 'cancelado' };
  const active = items.filter(i => i.booking_status !== 'cancelled');
  const booked = active.filter(i => i.booking_status === 'booked' || i.booking_status === 'confirmed').length;
  const paid = active.filter(i => i.payment_status === 'paid').length;
  const invoiced = active.filter(i => i.invoice_status === 'received').length;
  const n = active.length;
  if (booked === n && paid === n && invoiced === n) return { prefix: 'ok -', label: 'Confirmado', key: 'ok' };
  if (booked === n) return { prefix: '*', label: 'Confirmado', key: 'confirmado' };
  if (booked > 0) return { prefix: '**', label: 'Parcial', key: 'parcial' };
  return { prefix: '', label: 'Por confirmar', key: 'por_confirmar' };
}

function bookingLabel(status: string | null): string {
  switch (status) {
    case 'booked': case 'confirmed': return 'Reservado';
    case 'sent': case 'requested': case 'pending': return 'Pedido enviado';
    case 'cancelled': return 'Cancelado';
    default: return 'Por reservar';
  }
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (url: string | null | undefined, label: string) => url ? `<a href="${esc(url)}">${esc(label || url)}</a>` : esc(label);
// Flattens strings / arrays / objects (notes, trip_briefing JSON) into readable lines — never "[object Object]".
const toLines = (v: unknown): string[] => {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.flatMap(toLines);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const txt = o.text ?? o.note ?? o.note_text ?? o.content ?? o.value ?? o.label;
    if (typeof txt === 'string' || typeof txt === 'number') return toLines(String(txt));
    return Object.entries(o).flatMap(([k, val]) => {
      if (val == null || val === '') return [];
      const sub = toLines(val);
      if (!sub.length) return [];
      return typeof val === 'object' ? [`${k}:`, ...sub] : [`${k}: ${sub.join(' ')}`];
    });
  }
  return String(v).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
};
const lines = (txt: unknown) => toLines(txt);
function hhmm(t: string | null | undefined): string {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2})[:h](\d{2})/);
  return m ? `${m[1].padStart(2, '0')}h${m[2]}` : String(t);
}
const eurFmt = (n: number) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + '€';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildTitle(day: DayPayload, origin: string): string {
  const s = summarizeDayStatus(day.items);
  const parts: string[] = [];
  if (s.prefix) parts.push(s.prefix);
  parts.push(`*${day.tour} (${origin})`);
  parts.push(`- ${s.label}`);
  if (day.ops.guide_name) parts.push(`- ${day.ops.guide_name}`);
  return parts.join(' ');
}

export function buildDescription(lead: any, day: DayPayload, dayIndex: number, totalDays: number, origin: string, proposalUrl?: string): string {
  const o = day.ops;
  const out: string[] = [];
  const tccUrl = `${APP_ORIGIN}/leads/${lead.id}`;
  out.push(`Programa (TCC): ${link(tccUrl, tccUrl)}${proposalUrl ? ` | Programa comercial cliente: ${link(proposalUrl, proposalUrl)}` : ''}`);
  const bo = lines(o.notes_backoffice);
  if (bo.length) out.push('', '<b>NOTAS PARA BACKOFFICE:</b>', ...bo.map(l => `• ${esc(l)}`));
  if (o.vehicle || o.vehicle_pickup) out.push('', `Carrinha: ${esc(o.vehicle || '')}${o.vehicle_pickup ? ` | Recolha: ${esc(o.vehicle_pickup)}` : ''}`);
  out.push('----------------------------------------------------');
  out.push(`<b>${esc(day.tour)}</b> · Dia ${dayIndex + 1} / ${totalDays} · ${day.day_date}`);
  const pick = o.pickup_time || o.pickup_location
    ? `Pick-up: ${hhmm(o.pickup_time)}${o.pickup_location ? ` - ${link(o.pickup_maps_url, o.pickup_location)}` : ''}` : '';
  const drop = o.dropoff_location ? `Drop-off: ${link(o.dropoff_maps_url, o.dropoff_location)}` : '';
  if (pick || drop) out.push([pick, drop].filter(Boolean).join(' · '));
  // Convenção TCC: leads.pax = adultos; crianças e bebés à parte.
  const adults = Number(lead.pax || 0), kids = Number(lead.pax_children || 0), babies = Number(lead.pax_infants || 0);
  const paxTxt = `${adults} adultos${kids ? ` + ${kids} crianças` : ''}${babies ? ` + ${babies} bebés` : ''}`;
  out.push(`${esc(lead.service_language || 'EN')} · ${esc(lead.client_name || '')} · Nº pax: ${paxTxt}`);
  out.push(`Contacto: ${esc(lead.phone || '')} | ${esc(lead.email || '')} · ${esc(origin)}`);
  const ref = lead.yt_id || lead.lead_code || '';
  out.push(`Ref. Interna: ${esc(ref)}${lead.external_booking_ref ? ` · Nº Reserva: #${esc(lead.external_booking_ref)}` : ''}`);
  const allCancelled = day.items.length > 0 && day.items.every(i => i.booking_status === 'cancelled');
  out.push(`Estado: ${allCancelled ? 'cancelado' : 'booked'}`);
  if (o.guide_payment_amount != null) out.push(`Valor a receber pelo guia: ${eurFmt(Number(o.guide_payment_amount))}`);
  const gn = lines(o.notes_guide);
  if (gn.length) out.push('', '<b>NOTAS PARA O GUIA:</b>', ...gn.map(l => `• ${esc(l)}`));
  out.push('------------------------------------------------');
  out.push('<b>DETALHES DO SERVIÇO:</b>');
  const sorted = [...day.items].sort((a, b) => (a.schedule_time || '99:99').localeCompare(b.schedule_time || '99:99'));
  if (!sorted.length) out.push('(sem serviços atribuídos ao dia)');
  for (const it of sorted) {
    const time = [hhmm(it.schedule_time), hhmm(it.schedule_end_time)].filter(Boolean).join(' | ') || '--h--';
    out.push(`• ${time} - ${esc(it.supplier || 'FSE')} | ${esc(it.title)} - ${bookingLabel(it.booking_status)}`);
    const sub: string[] = [];
    if (it.costDesc && it.costDesc !== it.title) sub.push(esc(it.costDesc));
    it.itemNotes.forEach(n => sub.push(esc(n)));
    if (it.booking_status === 'booked' || it.booking_status === 'confirmed') sub.push('Confirmação FSE');
    if (it.opNotes) sub.push(esc(it.opNotes));
    if (it.emailSentAt) sub.push(`email enviado ${fmtDate(it.emailSentAt)}`);
    if (it.payment_status === 'paid') sub.push('Pago pelo BackOffice');
    else if (it.payment_status === 'guide_to_pay') sub.push('Guia paga no local');
    else if (it.payment_status === 'monthly_account') sub.push('Conta mensal');
    if (it.invoice_status === 'received') sub.push('Fatura recebida');
    sub.forEach(s => out.push(`    ◦ ${s}`));
  }
  out.push('', `<i>Evento gerado automaticamente pelo TCC — alterações no TCC: ${link(tccUrl, tccUrl)}</i>`);
  return out.join('<br>');
}

async function getCalendarId(supabase: any): Promise<{ calendarId: string; enabled: boolean }> {
  const { data } = await supabase
    .from('integration_settings')
    .select('config, status')
    .eq('name', 'google_calendar')
    .maybeSingle();
  const cfg = (data?.config as any) || {};
  return {
    calendarId: cfg.calendar_id || 'primary',
    enabled: !!cfg.enabled && data?.status !== 'disabled',
  };
}

// NEVER deletes Google events nor mapping rows — only flags them as orphan.
export async function markAllOrphanForLead(supabase: any, leadId: string) {
  await supabase.from('calendar_events')
    .update({ protection_status: 'orphan', sync_error: ORPHAN_INACTIVE_MSG })
    .eq('lead_id', leadId)
    .neq('protection_status', 'manual_edit');
}


export { SUPABASE_URL, SERVICE_ROLE_KEY, createClient };

export const ADMIN_URL_BASE = `${APP_ORIGIN}/leads/`;

const DEFAULT_SYNC_ADMINS = ['yorick.viche@yourtours.pt'];

export async function getSyncAdmins(supabase: any): Promise<string[]> {
  const { data } = await supabase.from('integration_settings').select('config').eq('name', 'sync_admins').maybeSingle();
  const list = ((data?.config as any)?.emails || []) as string[];
  const clean = list.map(e => String(e).toLowerCase().trim()).filter(Boolean);
  return clean.length ? clean : DEFAULT_SYNC_ADMINS;
}

// Entry criterion: status 'won' OR NetHunt stage in OPERATIONS (except Archive / Deferred).
export function isCalendarEligible(lead: any): boolean {
  if (lead?.status === 'won') return true;
  const st = String(lead?.nethunt_stage || '');
  if (!st.startsWith('OPERATIONS - ')) return false;
  return st !== 'OPERATIONS - Archive' && st !== 'OPERATIONS - Deferred / Postponed Trip';
}

export function deterministicEventId(leadId: string, dayDate: string): string {
  return 'tcc' + leadId.replace(/-/g, '').toLowerCase() + dayDate.replace(/-/g, '');
}

async function saveSnapshot(supabase: any, leadId: string, dayDate: string, ev: any, reason: string) {
  const { error } = await supabase.from('calendar_event_snapshots').insert({
    lead_id: leadId,
    day_date: dayDate,
    google_event_id: ev?.id || null,
    summary: ev?.summary ?? null,
    description: ev?.description ?? null,
    color_id: ev?.colorId ?? null,
    attachments: ev?.attachments ?? null,
    raw: ev ?? null,
    reason,
  });
  if (error) throw new Error(`snapshot failed: ${error.message}`);
}

export interface CoreResult { status: number; body: any }

// Looks for non-TCC events on `dayDate` that belong to `lead` (YT digits, booking ref, surname).
async function findManualEvent(calPath: string, dayDate: string, lead: any): Promise<{ candidates: any[] }> {
  const tMin = new Date(dayDate + 'T00:00:00Z'); tMin.setUTCHours(-2);
  const tMax = new Date(dayDate + 'T00:00:00Z'); tMax.setUTCHours(26);
  const r = await gcal(`${calPath}?singleEvents=true&maxResults=250&timeMin=${encodeURIComponent(tMin.toISOString())}&timeMax=${encodeURIComponent(tMax.toISOString())}`, { method: 'GET' });
  if (!r.ok) throw new Error(`Google Calendar API ${r.status}: ${r.text}`);
  const ytDigits = String(lead.yt_id || lead.lead_code || '').match(/\d{3,}/g)?.pop() || '';
  const bookRef = String(lead.external_booking_ref || '').replace(/^#/, '').trim().toLowerCase();
  const surname = String(lead.client_name || '').trim().split(/\s+/).filter(w => w.length >= 3).pop()?.toLowerCase() || '';
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const out: any[] = [];
  for (const ev of (r.data?.items || [])) {
    if (ev.status === 'cancelled') continue;
    const priv = ev.extendedProperties?.private || {};
    if (priv.yt_lead_id || priv.source === 'tcc' || String(ev.id || '').startsWith('tcc')) continue;
    const evDay = (ev.start?.date || ev.start?.dateTime || '').slice(0, 10);
    if (evDay && evDay !== dayDate) continue;
    const text = norm(`${ev.summary || ''}\n${ev.description || ''}`);
    const refRe = ytDigits ? new RegExp(`(ref\\.?\\s*interna|file\\s*(nr|id)|yt)[^\\d]{0,12}${ytDigits}\\b`) : null;
    const hit = (ytDigits && (refRe!.test(text) || new RegExp(`\\b${ytDigits}\\b`).test(text)))
      || (bookRef.length >= 4 && text.includes(bookRef))
      || (surname && new RegExp(`\\b${norm(surname).replace(/[.*+?^${}()|[\]\\]/g, '')}\\b`).test(text));
    if (hit) out.push(ev);
  }
  return { candidates: out };
}

export async function runCalendarSync(
  supabase: any,
  opts: { lead_id: string; mode: NonNullable<SyncRequest['mode']>; forceDates?: Set<string> },
): Promise<CoreResult> {
  const leadId = opts.lead_id;
  const mode = opts.mode;
  const forceDates = opts.forceDates || new Set<string>();

  const isPreview = mode === 'preview';
  const { calendarId, enabled } = await getCalendarId(supabase);
  if (!enabled && !isPreview) return { status: 200, body: { ok: true, skipped: 'disabled' } };

  const { data: lead, error: leadErr } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (leadErr) throw leadErr;
  if (!lead) {
    if (isPreview) return { status: 404, body: { ok: false, error: 'lead not found' } };
    // Lead removed: keep Google events, flag mappings orphan.
    await markAllOrphanForLead(supabase, leadId);
    return { status: 200, body: { ok: true, orphaned: true, reason: 'lead not found' } };
  }

  if (!isPreview && (mode === 'delete' || !isCalendarEligible(lead))) {
    await markAllOrphanForLead(supabase, leadId);
    return { status: 200, body: { ok: true, orphaned: true } };
  }

  const activeVersion = Number(lead.active_version || 0);
  const [{ data: costingRows }, { data: ops }, { data: emails }, { data: proposals }, { data: dayOpsRows }, { data: plannerRows }, { data: colorCfg }, partnerRes] = await Promise.all([
    supabase.from('lead_costing_data').select('day_number, items, version').eq('lead_id', leadId).eq('version', activeVersion),
    supabase.from('lead_operations').select('*').eq('lead_id', leadId),
    supabase.from('booking_emails_log').select('lead_operation_id, sent_at').eq('lead_id', leadId).order('sent_at', { ascending: false }),
    supabase.from('proposals')
      .select('public_token, version, created_at')
      .eq('lead_id', leadId)
      .order('version', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('lead_day_ops').select('*').eq('lead_id', leadId),
    supabase.from('lead_planner_data').select('day_number, title, version').eq('lead_id', leadId).eq('version', activeVersion),
    supabase.from('integration_settings').select('config').eq('name', 'calendar_colors').maybeSingle(),
    lead.partner_id ? supabase.from('partners').select('name').eq('id', lead.partner_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const proposal = (proposals || []).find((p: any) => Number(p.version) === activeVersion) || proposals?.[0];
  const proposalUrl = proposal?.public_token
    ? `${APP_ORIGIN}/proposal/${encodeURIComponent(proposal.public_token)}`
    : undefined;
  const origin = (lead.booking_origin || '').trim() || (partnerRes as any)?.data?.name || 'YT';
  const colors: Record<string, string> = { ...DEFAULT_COLORS, ...((colorCfg as any)?.config || {}) };

  const emailByOpId = new Map<string, string>();
  for (const e of (emails || [])) {
    if (e.lead_operation_id && !emailByOpId.has(e.lead_operation_id)) emailByOpId.set(e.lead_operation_id, e.sent_at);
  }
  const dayOpsByNum = new Map<number, DayOps>((dayOpsRows || []).map((r: any) => [Number(r.day_number), r]));
  const tourByNum = new Map<number, string>((plannerRows || []).map((r: any) => [Number(r.day_number), r.title]));

  const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const costByDay = new Map<number, any[]>();
  for (const row of (costingRows || [])) costByDay.set(Number(row.day_number), Array.isArray(row.items) ? row.items : []);

  // Item notes (item_notes, entity_type 'lead_cost_item' / 'lead_operation')
  const opKeys = (ops || []).map((o: any) => o.item_key).concat((ops || []).map((o: any) => o.id));
  const notesByEntity = new Map<string, string[]>();
  if (opKeys.length) {
    const { data: notes } = await supabase.from('item_notes').select('entity_id, note_text, created_at').in('entity_id', opKeys).order('created_at');
    for (const n of (notes || [])) {
      if (!n.note_text) continue;
      const arr = notesByEntity.get(n.entity_id) || [];
      arr.push(n.note_text); notesByEntity.set(n.entity_id, arr);
    }
  }

  const startDate = parseTravelStart(lead.travel_dates, lead.travel_end_date);
  if (!startDate) return { status: 200, body: { ok: false, error: 'travel_dates not parseable' } };

  const dayNums = new Set<number>();
  (ops || []).forEach((o: any) => dayNums.add(Number(o.day_number)));
  costByDay.forEach((items, d) => { if (items.length) dayNums.add(d); });

  const days: DayPayload[] = [];
  for (const dayNum of Array.from(dayNums).sort((a, b) => a - b)) {
    const costItems = costByDay.get(dayNum) || [];
    const dayOps = (ops || []).filter((o: any) => Number(o.day_number) === dayNum)
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    const toItem = (o: any, ci: any): DayItem => ({
      key: o?.item_key || ci?.id || '',
      title: o?.activity_title || ci?.description || ci?.category || 'Serviço',
      supplier: o?.supplier || ci?.supplier || '',
      costDesc: ci?.description || '',
      schedule_time: o?.schedule_time || null,
      schedule_end_time: o?.schedule_end_time || null,
      booking_status: o?.booking_status || null,
      payment_status: o?.payment_status || null,
      invoice_status: o?.invoice_status || null,
      opNotes: o?.notes || '',
      itemNotes: [...(notesByEntity.get(o?.item_key) || []), ...(notesByEntity.get(o?.id) || [])],
      emailSentAt: o?.id ? emailByOpId.get(o.id) : undefined,
    });
    const items: DayItem[] = dayOps.length
      ? dayOps.map((o: any) => toItem(o, costItems.find((ci: any) => ci.id === o.item_key || norm(ci.description) === norm(o.activity_title))))
      : costItems.map((ci: any) => toItem(null, ci));
    days.push({
      day_number: dayNum,
      day_date: ymd(addDays(startDate, dayNum - 1)),
      tour: tourByNum.get(dayNum) || lead.destination || 'Tour',
      ops: dayOpsByNum.get(dayNum) || {},
      items,
    });
  }

  const totalDays = days.length || lead.number_of_days || 1;

  if (isPreview) {
    return {
      status: 200,
      body: {
        ok: true,
        events: days.map((d, i) => ({
          day_date: d.day_date,
          title: buildTitle(d, origin),
          description: buildDescription(lead, d, i, totalDays, origin, proposalUrl),
        })),
      },
    };
  }

  const { data: existingMappings } = await supabase.from('calendar_events').select('*').eq('lead_id', leadId);
  const existingByDate = new Map((existingMappings || []).map((m: any) => [m.day_date, m]));

  const results: any[] = [];
  const activeDates = new Set<string>();
  const today = ymd(new Date());
  const calPath = `/calendars/${encodeURIComponent(calendarId)}/events`;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    activeDates.add(day.day_date);
    const summary = summarizeDayStatus(day.items);
    const title = buildTitle(day, origin);
    const description = buildDescription(lead, day, i, totalDays, origin, proposalUrl);
    // colorId is NEVER sent on updates (existing colours preserved); only new events get a status colour.
    const newColorId = String(colors[summary.key] || DEFAULT_COLORS[summary.key]);
    const eventPayload: any = {
      summary: title,
      description,
      location: lead.destination || '',
      start: { date: day.day_date, timeZone: 'Europe/Lisbon' },
      end: { date: ymd(addDays(new Date(day.day_date + 'T00:00:00Z'), 1)), timeZone: 'Europe/Lisbon' },
      attendees: [],
      extendedProperties: {
        private: {
          yt_lead_id: leadId,
          yt_lead_code: lead.lead_code || '',
          yt_day_date: day.day_date,
        },
      },
    };

    const payloadHash = hash(eventPayload);
    const existing: any = existingByDate.get(day.day_date);
    const forced = mode === 'force_overwrite' && forceDates.has(day.day_date);

    if (existing?.protection_status === 'manual_edit' && !forced) {
      results.push({ day_date: day.day_date, action: 'protected_manual_edit' });
      continue;
    }
    if (mode === 'force_overwrite' && !forced) {
      results.push({ day_date: day.day_date, action: 'skipped_not_requested' });
      continue;
    }
    if (existing && existing.protection_status === 'ok' && existing.last_payload_hash === payloadHash && existing.google_event_id && mode !== 'full_resync' && !forced) {
      results.push({ day_date: day.day_date, action: 'unchanged' });
      continue;
    }

    const upsertMapping = async (patch: Record<string, unknown>) => {
      await supabase.from('calendar_events').upsert({ lead_id: leadId, day_date: day.day_date, ...patch }, { onConflict: 'lead_id,day_date' });
    };
    const markManual = async (ev: any) => {
      try { await saveSnapshot(supabase, leadId, day.day_date, ev, 'manual_edit_detected'); } catch (e) { console.error(e); }
      await upsertMapping({
        google_event_id: ev?.id || existing?.google_event_id || null,
        protection_status: 'manual_edit',
        manual_edit_detected_at: new Date().toISOString(),
        sync_error: MANUAL_EDIT_MSG,
      });
      results.push({ day_date: day.day_date, action: 'protected_manual_edit' });
    };

    // Update path with all protection rules. `mapping` may be null (adopted / 409 event).
    const updatePath = async (eventId: string, mapping: any): Promise<any | null> => {
      const evPath = `${calPath}/${eventId}`;
      const current = await gcal(evPath, { method: 'GET' });
      if (current.status === 404 || current.status === 410 || current.data?.status === 'cancelled') {
        await upsertMapping({ google_event_id: eventId, protection_status: 'orphan', sync_error: ORPHAN_MISSING_MSG });
        results.push({ day_date: day.day_date, action: 'orphan_missing' });
        return null;
      }
      if (!current.ok) throw new Error(`Google Calendar API ${current.status}: ${current.text}`);
      const gEtag: string | undefined = current.data?.etag;
      const gUpdated: string | undefined = current.data?.updated;

      if (forced) {
        // Snapshot is mandatory before any force_overwrite; failure aborts this day.
        await saveSnapshot(supabase, leadId, day.day_date, current.data, 'before_force_overwrite');
      } else if (mapping) {
        let manual = false;
        if (mapping.google_etag) manual = !!gEtag && gEtag !== mapping.google_etag;
        else if (gUpdated && mapping.last_synced_at) manual = new Date(gUpdated).getTime() - new Date(mapping.last_synced_at).getTime() > 60_000;
        if (manual) { await markManual(current.data); return null; }
      }

      const patched = await gcal(`${evPath}?sendUpdates=none`, {
        method: 'PATCH',
        body: JSON.stringify(eventPayload),
        headers: gEtag ? { 'If-Match': gEtag } : {},
      });
      if (patched.status === 412) {
        const again = await gcal(evPath, { method: 'GET' });
        await markManual(again.ok ? again.data : current.data);
        return null;
      }
      if (!patched.ok) throw new Error(`Google Calendar API ${patched.status}: ${patched.text}`);
      return patched.data;
    };

    try {
      let saved: any = null;
      let action = '';
      if (existing?.google_event_id) {
        saved = await updatePath(existing.google_event_id, existing);
        if (!saved) continue;
        action = forced ? 'force_overwritten' : 'updated';
      } else {
        // 1) Adopt an event already tagged for this lead/day.
        const q = `?privateExtendedProperty=${encodeURIComponent(`yt_lead_id=${leadId}`)}&privateExtendedProperty=${encodeURIComponent(`yt_day_date=${day.day_date}`)}&maxResults=5`;
        const found = await gcal(`${calPath}${q}`, { method: 'GET' });
        if (!found.ok) throw new Error(`Google Calendar API ${found.status}: ${found.text}`);
        const adopt = (found.data?.items || []).find((e: any) => e.status !== 'cancelled');
        if (adopt?.id) {
          saved = await updatePath(adopt.id, null);
          if (!saved) continue;
          action = 'adopted';
        } else {
          // 2) Never create events in the past.
          if (day.day_date < today) {
            results.push({ day_date: day.day_date, action: 'skipped_past' });
            continue;
          }
          // 2b) Never create when a manual (non-TCC) event of this lead already exists on this day.
          const manualHit = await findManualEvent(calPath, day.day_date, lead);
          if (manualHit.candidates.length === 1) {
            const ev = manualHit.candidates[0];
            try { await saveSnapshot(supabase, leadId, day.day_date, ev, 'manual_event_existing'); } catch (e) { console.error(e); }
            await upsertMapping({
              google_event_id: ev.id, google_etag: ev.etag || null, google_updated_at: ev.updated || null,
              protection_status: 'manual_edit', manual_edit_detected_at: new Date().toISOString(),
              status: summary.label, sync_error: 'Evento manual existente ligado — rever na página Sincronização (Migração).',
            });
            results.push({ day_date: day.day_date, action: 'linked_manual_existing', eventId: ev.id });
            continue;
          }
          if (manualHit.candidates.length > 1) {
            await upsertMapping({
              google_event_id: null, status: summary.label,
              sync_error: 'Possível evento manual existente — ligar na página Sincronização',
            });
            results.push({ day_date: day.day_date, action: 'skipped_possible_manual', candidates: manualHit.candidates.map((c: any) => c.id) });
            continue;
          }
          // 3) Create with deterministic id; 409 → existing event → update path.
          const fixedId = deterministicEventId(leadId, day.day_date);
          const created = await gcal(`${calPath}?sendUpdates=none`, {
            method: 'POST', body: JSON.stringify({ ...eventPayload, id: fixedId, colorId: newColorId }),
          });
          if (created.status === 409) {
            saved = await updatePath(fixedId, null);
            if (!saved) continue;
            action = 'adopted_conflict';
          } else if (!created.ok) {
            throw new Error(`Google Calendar API ${created.status}: ${created.text}`);
          } else {
            saved = created.data;
            action = 'created';
          }
        }
      }
      await upsertMapping({
        google_event_id: saved?.id,
        google_etag: saved?.etag || null,
        google_updated_at: saved?.updated || null,
        last_synced_at: new Date().toISOString(),
        last_payload_hash: payloadHash,
        status: summary.label,
        sync_error: null,
        protection_status: 'ok',
        manual_edit_detected_at: null,
      });
      results.push({ day_date: day.day_date, action, eventId: saved?.id });
    } catch (err: any) {
      console.error('Failed to sync day', day.day_date, err);
      await upsertMapping({
        google_event_id: existing?.google_event_id || null,
        last_synced_at: existing?.last_synced_at || new Date().toISOString(),
        last_payload_hash: existing?.last_payload_hash || null,
        status: summary.label,
        sync_error: String(err.message || err),
      });
      results.push({ day_date: day.day_date, action: 'error', error: String(err.message || err) });
    }
  }

  for (const m of existingMappings || []) {
    if (!activeDates.has((m as any).day_date) && (m as any).protection_status !== 'manual_edit') {
      await supabase.from('calendar_events').update({ protection_status: 'orphan', sync_error: ORPHAN_INACTIVE_MSG }).eq('id', (m as any).id);
      results.push({ day_date: (m as any).day_date, action: 'orphaned' });
    }
  }

  return { status: 200, body: { ok: true, results } };
}

// Exposed for calendar-migrate / calendar-reconcile (read + mapping helpers only).
export { gcal, getCalendarId, saveSnapshot, parseTravelStart, ymd, addDays };
