// Migração dos eventos existentes do calendário "Reservas YT" para o TCC.
// Nunca apaga eventos no Google; nunca cria eventos. Só lê, liga mapeamentos, move (events.move) e,
// após aprovação humana, faz force_overwrite de um dia (com snapshot, via calendar-sync-core).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  createClient, SUPABASE_URL, SERVICE_ROLE_KEY, getSyncAdmins, runCalendarSync,
  gcal, getCalendarId, saveSnapshot, parseTravelStart, ymd, addDays,
} from '../_shared/calendar-sync-core.ts';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MANUAL_CAL_RE = /reservas\s*yt.*manual/i;
const NOT_BOOKING_RE = /(viatura\s+livre|carrinha\s+livre|encerrad|fechad|guia[s]?\s+contratad|hotel|alerta|feriado|folga|férias|ferias|manuten)/i;
const BOOKING_HINT_RE = /(pax|pick[\s-]?up|tour|adult|reserva|booking)/i;

const strip = (html: string | null | undefined) => String(html || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

export function extractRef(summary: string, description: string): string | null {
  const text = strip(description);
  const m = text.match(/(?:Ref\.?\s*Interna|File\s*(?:Nr|ID)|N[ºo°]\s*Reserva)\s*:?\s*#?\s*(YT[-\s]?\d{3,6})/i)
    || String(summary || '').match(/\b(YT[-\s]?\d{3,6})\b/i)
    || text.match(/\b(YT[-\s]?\d{3,6})\b/i);
  if (!m) return null;
  return 'YT' + m[1].replace(/\D+/g, '');
}

const evDate = (ev: any): string | null => (ev?.start?.date || ev?.start?.dateTime || '').slice(0, 10) || null;

async function callerEmail(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const anon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data } = await anon.auth.getUser(auth.slice(7));
  return data?.user?.email?.toLowerCase() || null;
}

function tripRange(lead: any): [string, string] | null {
  const start = parseTravelStart(lead.travel_dates, lead.travel_end_date);
  if (!start) return null;
  const endM = String(lead.travel_end_date || '').match(/\d{4}-\d{2}-\d{2}/);
  const end = endM ? endM[0] : ymd(addDays(start, Math.max(1, Number(lead.number_of_days || 1)) - 1));
  return [ymd(start), end];
}

async function findLead(sb: any, ref: string | null, day: string | null) {
  if (!ref) return null;
  const digits = ref.replace(/\D+/g, '');
  const { data } = await sb.from('leads').select('id, yt_id, travel_dates, travel_end_date, number_of_days').ilike('yt_id', `%${digits}`);
  const rows = (data || []).filter((l: any) => String(l.yt_id || '').replace(/\D+/g, '') === digits);
  for (const l of rows) {
    const r = tripRange(l);
    if (r && day && day >= r[0] && day <= r[1]) return l;
  }
  return null;
}

async function manualCalendar(): Promise<{ id: string; summary: string } | null> {
  const r = await gcal('/users/me/calendarList?maxResults=250', { method: 'GET' });
  if (!r.ok) return null;
  const c = (r.data?.items || []).find((i: any) => MANUAL_CAL_RE.test(String(i.summary || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  return c ? { id: c.id, summary: c.summary } : null;
}

async function scan(sb: any, calendarId: string) {
  const timeMin = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();
  const { data: mapped } = await sb.from('calendar_events').select('google_event_id').not('google_event_id', 'is', null);
  const mappedIds = new Set((mapped || []).map((m: any) => m.google_event_id));
  const { data: existing } = await sb.from('calendar_migration_items').select('google_event_id, status');
  const statusById = new Map((existing || []).map((e: any) => [e.google_event_id, e.status]));

  let pageToken = '';
  let total = 0, skippedMapped = 0;
  const counts: Record<string, number> = { linked: 0, no_lead: 0, not_booking: 0 };
  for (let page = 0; page < 20; page++) {
    const q = `?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(timeMin)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const r = await gcal(`/calendars/${encodeURIComponent(calendarId)}/events${q}`, { method: 'GET' });
    if (!r.ok) throw new Error(`Google Calendar API ${r.status}: ${r.text}`);
    const rows: any[] = [];
    for (const ev of (r.data?.items || [])) {
      if (ev.status === 'cancelled') continue;
      total++;
      if (mappedIds.has(ev.id) || ev.extendedProperties?.private?.yt_lead_id) { skippedMapped++; continue; }
      const day = evDate(ev);
      const ref = extractRef(ev.summary, ev.description);
      const lead = await findLead(sb, ref, day);
      const text = `${ev.summary || ''}\n${strip(ev.description)}`;
      const classification = lead ? 'linked'
        : ref ? 'no_lead'
        : NOT_BOOKING_RE.test(text) || !BOOKING_HINT_RE.test(text) ? 'not_booking' : 'no_lead';
      counts[classification]++;
      const prev = statusById.get(ev.id);
      rows.push({
        google_event_id: ev.id, calendar_id: calendarId, day_date: day, summary: ev.summary || '',
        description: ev.description || '', html_link: ev.htmlLink || null, yt_ref: ref,
        lead_id: lead?.id || null, classification, raw: ev,
        status: prev || 'pending', scanned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await sb.from('calendar_migration_items').upsert(rows, { onConflict: 'google_event_id' });
      if (error) throw error;
    }
    pageToken = r.data?.nextPageToken || '';
    if (!pageToken) break;
  }
  return { total, skipped_already_mapped: skippedMapped, counts };
}

async function getItem(sb: any, id: string) {
  const { data } = await sb.from('calendar_migration_items').select('*').eq('google_event_id', id).maybeSingle();
  if (!data) throw new Error('evento não encontrado na migração — volte a analisar');
  return data;
}

async function linkItem(sb: any, item: any, leadId: string) {
  const day = item.day_date;
  const { data: dup } = await sb.from('calendar_events').select('google_event_id').eq('lead_id', leadId).eq('day_date', day).maybeSingle();
  if (dup && dup.google_event_id && dup.google_event_id !== item.google_event_id) {
    throw new Error('Esta lead já tem um evento ligado neste dia — não se cria duplicado');
  }
  const ev = await gcal(`/calendars/${encodeURIComponent(item.calendar_id)}/events/${encodeURIComponent(item.google_event_id)}`, { method: 'GET' });
  if (!ev.ok) throw new Error(`Google Calendar API ${ev.status}: ${ev.text}`);
  await saveSnapshot(sb, leadId, day, ev.data, 'migration_link');
  const { error } = await sb.from('calendar_events').upsert({
    lead_id: leadId, day_date: day, google_event_id: item.google_event_id,
    google_etag: ev.data?.etag || null, google_updated_at: ev.data?.updated || null,
    last_synced_at: new Date().toISOString(), protection_status: 'manual_edit',
    manual_edit_detected_at: new Date().toISOString(),
    sync_error: 'Evento migrado — rever e aprovar na página Sincronização',
  }, { onConflict: 'lead_id,day_date' });
  if (error) throw error;
  await sb.from('calendar_migration_items').update({ lead_id: leadId, classification: 'linked', status: 'linked', updated_at: new Date().toISOString() }).eq('google_event_id', item.google_event_id);
}

async function extract(sb: any, item: any) {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY not configured');
  let ops: any[] = [];
  let dayNumber: number | null = null;
  if (item.lead_id) {
    const { data: lead } = await sb.from('leads').select('travel_dates, travel_end_date').eq('id', item.lead_id).maybeSingle();
    const start = lead ? parseTravelStart(lead.travel_dates, lead.travel_end_date) : null;
    if (start) dayNumber = Math.round((new Date(item.day_date + 'T00:00:00Z').getTime() - start.getTime()) / 86400000) + 1;
    const { data } = await sb.from('lead_operations').select('item_key, activity_title, supplier, schedule_time').eq('lead_id', item.lead_id).eq('day_number', dayNumber ?? -1);
    ops = data || [];
  }
  const prompt = `Extrai dados operacionais de um evento de calendário de uma agência de viagens portuguesa.
Título: ${item.summary}
Descrição:
${strip(item.description).slice(0, 8000)}

Serviços já existentes no TCC para este dia (usa item_key quando corresponder): ${JSON.stringify(ops)}

O sufixo do título depois do último " - " é normalmente o nome do guia.
Responde APENAS com JSON com esta forma (null quando não souberes; horas "HH:MM"):
{"general":{"client_name":null,"email":null,"phone":null,"pax":null,"pax_children":null,"pax_infants":null,"service_language":null,"booking_origin":null,"external_booking_ref":null},
"day_ops":{"guide_name":null,"vehicle":null,"vehicle_pickup":null,"pickup_time":null,"pickup_location":null,"pickup_maps_url":null,"dropoff_location":null,"dropoff_maps_url":null,"notes_backoffice":null,"notes_guide":null,"guide_payment_amount":null},
"services":[{"item_key":null,"title":"","supplier":null,"schedule_time":null,"schedule_end_time":null,"booking_status":"neutral|sent|booked","payment_status":"neutral|paid|monthly_account|guide_to_pay|not_paid","invoice_status":"not_received|guide_pickup|received","confirmation_number":null,"notes":null}]}`;
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    const msg = res.status === 402 ? 'Sem créditos de IA — carregar créditos para continuar'
      : res.status === 429 ? 'Limite de pedidos de IA — tentar novamente dentro de instantes'
      : `IA falhou (${res.status})`;
    throw Object.assign(new Error(msg), { status: res.status, details: text.slice(0, 500) });
  }
  const content = JSON.parse(text)?.choices?.[0]?.message?.content || '{}';
  let parsed: any;
  try { parsed = JSON.parse(content.replace(/^```json\s*|```$/g, '')); } catch { throw new Error('Resposta da IA inválida'); }
  parsed.day_number = dayNumber;
  await sb.from('calendar_migration_items').update({ extracted: parsed, updated_at: new Date().toISOString() }).eq('google_event_id', item.google_event_id);
  return parsed;
}

const clean = (o: Record<string, unknown> | undefined, keys: string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
};
const HHMM = (v: unknown) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim() : null);
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);

async function applyFields(sb: any, leadId: string, day: string, f: any) {
  const { data: lead } = await sb.from('leads').select('travel_dates, travel_end_date').eq('id', leadId).maybeSingle();
  const start = parseTravelStart(lead?.travel_dates, lead?.travel_end_date);
  if (!start) throw new Error('Lead sem data de início');
  const dayNumber = Math.round((new Date(day + 'T00:00:00Z').getTime() - start.getTime()) / 86400000) + 1;

  const general = clean(f.general, ['service_language', 'booking_origin', 'external_booking_ref']);
  if (Object.keys(general).length) {
    const { error } = await sb.from('leads').update(general).eq('id', leadId);
    if (error) throw error;
  }
  const dayOps = clean(f.day_ops, ['guide_name', 'vehicle', 'vehicle_pickup', 'pickup_location', 'pickup_maps_url', 'dropoff_location', 'dropoff_maps_url', 'notes_backoffice', 'notes_guide']);
  const pt = HHMM(f.day_ops?.pickup_time); if (pt) dayOps.pickup_time = pt;
  const gp = Number(String(f.day_ops?.guide_payment_amount ?? '').replace(',', '.'));
  if (f.day_ops?.guide_payment_amount != null && !isNaN(gp)) dayOps.guide_payment_amount = gp;
  if (Object.keys(dayOps).length) {
    const { error } = await sb.from('lead_day_ops').upsert({ lead_id: leadId, day_number: dayNumber, ...dayOps, updated_at: new Date().toISOString() }, { onConflict: 'lead_id,day_number' });
    if (error) throw error;
  }
  const { data: existingOps } = await sb.from('lead_operations').select('item_key').eq('lead_id', leadId);
  const keys = new Set((existingOps || []).map((o: any) => o.item_key));
  let idx = 0;
  for (const s of (Array.isArray(f.services) ? f.services : [])) {
    if (!s?.title && !s?.item_key) continue;
    const row: Record<string, unknown> = {
      ...clean(s, ['supplier', 'confirmation_number', 'notes']),
      schedule_time: HHMM(s.schedule_time), schedule_end_time: HHMM(s.schedule_end_time),
    };
    if (['neutral', 'sent', 'booked'].includes(s.booking_status)) row.booking_status = s.booking_status;
    if (['neutral', 'paid', 'partially_paid', 'monthly_account', 'guide_to_pay', 'not_paid'].includes(s.payment_status)) row.payment_status = s.payment_status;
    if (['not_received', 'guide_pickup', 'received'].includes(s.invoice_status)) row.invoice_status = s.invoice_status;
    if (s.item_key && keys.has(s.item_key)) {
      const { error } = await sb.from('lead_operations').update({ ...row, updated_at: new Date().toISOString() }).eq('lead_id', leadId).eq('item_key', s.item_key);
      if (error) throw error;
    } else {
      let key = `d${dayNumber}-mig-${slug(s.title || 'servico')}`;
      while (keys.has(key)) key += '-x';
      keys.add(key);
      const { error } = await sb.from('lead_operations').insert({
        lead_id: leadId, item_key: key, day_number: dayNumber, activity_title: s.title, source: 'manual', sort_order: 100 + idx++, ...row,
      });
      if (error) throw error;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    const email = await callerEmail(req);
    const admins = await getSyncAdmins(sb);
    if (!email || !admins.includes(email)) return reply({ ok: false, error: 'reservado aos administradores de sincronização' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const { calendarId } = await getCalendarId(sb);

    if (action === 'info') {
      return reply({ ok: true, manual_calendar: await manualCalendar(), calendar_id: calendarId });
    }
    if (action === 'scan') return reply({ ok: true, ...(await scan(sb, calendarId)) });

    const id = String(body.event_id || '');
    if (!id) return reply({ ok: false, error: 'event_id obrigatório' }, 400);
    const item = await getItem(sb, id);

    if (action === 'link') {
      const leadId = body.lead_id || item.lead_id;
      if (!leadId) return reply({ ok: false, error: 'lead em falta' }, 400);
      await linkItem(sb, item, leadId);
      return reply({ ok: true });
    }
    if (action === 'extract') return reply({ ok: true, extracted: await extract(sb, item) });
    if (action === 'skip') {
      await sb.from('calendar_migration_items').update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('google_event_id', id);
      return reply({ ok: true });
    }
    if (action === 'preview' || action === 'approve') {
      if (!item.lead_id) return reply({ ok: false, error: 'ligar primeiro a uma lead' }, 400);
      if (action === 'preview') {
        const res = await runCalendarSync(sb, { lead_id: item.lead_id, mode: 'preview' });
        return reply({ ok: true, event: (res.body?.events || []).find((e: any) => e.day_date === item.day_date) || null });
      }
      await applyFields(sb, item.lead_id, item.day_date, body.fields || {});
      await sb.from('calendar_migration_items').update({ extracted: body.fields || null }).eq('google_event_id', id);
      const res = await runCalendarSync(sb, { lead_id: item.lead_id, mode: 'force_overwrite', forceDates: new Set([item.day_date]) });
      const dayRes = (res.body?.results || []).find((r: any) => r.day_date === item.day_date);
      const ok = dayRes && ['force_overwritten', 'updated', 'adopted', 'adopted_conflict'].includes(dayRes.action);
      if (ok) await sb.from('calendar_migration_items').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('google_event_id', id);
      return reply({ ok: !!ok, result: dayRes || null, error: ok ? undefined : 'Dados gravados, mas o evento não foi reescrito (dia sem serviços no TCC ou erro do Google)' });
    }
    if (action === 'create_lead') {
      const g = body.fields?.general || item.extracted?.general || {};
      const insert: Record<string, unknown> = {
        client_name: g.client_name || item.summary || 'Reserva migrada',
        email: g.email || '', phone: g.phone || null,
        destination: 'A definir',
        travel_dates: item.day_date, travel_end_date: item.day_date,
        pax: Number(g.pax) || 1, pax_children: Number(g.pax_children) || 0, pax_infants: Number(g.pax_infants) || 0,
        status: 'won', nethunt_stage: 'OPERATIONS - Deposit/Payment Received',
        service_language: g.service_language || null, booking_origin: g.booking_origin || null,
        external_booking_ref: g.external_booking_ref || null,
        notes: 'Criada a partir de evento do calendário (migração)',
      };
      if (item.yt_ref) insert.yt_id = item.yt_ref;
      const { data: lead, error } = await sb.from('leads').insert(insert).select('id').single();
      if (error) throw error;
      await sb.from('calendar_migration_items').update({ lead_id: lead.id }).eq('google_event_id', id);
      await linkItem(sb, { ...item, lead_id: lead.id }, lead.id);
      return reply({ ok: true, lead_id: lead.id });
    }
    if (action === 'move') {
      const dest = await manualCalendar();
      if (!dest) return reply({ ok: false, error: "Calendário 'Reservas YT – Manual' ainda não existe" }, 409);
      const r = await gcal(`/calendars/${encodeURIComponent(item.calendar_id)}/events/${encodeURIComponent(id)}/move?destination=${encodeURIComponent(dest.id)}&sendUpdates=none`, { method: 'POST' });
      if (!r.ok) return reply({ ok: false, error: `Google Calendar API ${r.status}`, details: r.text.slice(0, 500) }, r.status);
      await sb.from('calendar_migration_items').update({ status: 'moved', calendar_id: dest.id, updated_at: new Date().toISOString() }).eq('google_event_id', id);
      return reply({ ok: true });
    }
    return reply({ ok: false, error: 'ação desconhecida' }, 400);
  } catch (err: any) {
    console.error('calendar-migrate error:', err);
    return reply({ ok: false, error: String(err.message || err), details: err.details }, err.status && err.status < 600 ? err.status : 500);
  }
});
