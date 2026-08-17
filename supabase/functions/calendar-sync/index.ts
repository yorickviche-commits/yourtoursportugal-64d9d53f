// Sincroniza operações de leads (estado "Ganho") para o Google Calendar partilhado YT.
// Sentido único: Lovable -> Google Calendar. Fonte de verdade = Supabase.
// Um evento por (lead, dia). Multi-day trips = múltiplos eventos, um por dia.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';

interface SyncRequest {
  lead_id: string;
  mode?: 'create' | 'update' | 'delete' | 'full_resync';
}

async function calendarFetch(path: string, init: RequestInit = {}) {
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
  if (!GOOGLE_CALENDAR_API_KEY) throw new Error('GOOGLE_CALENDAR_API_KEY not configured (connector not linked)');
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    // 410 = event already deleted; treat as ok on DELETE
    if (res.status === 410 && init.method === 'DELETE') return null;
    throw new Error(`Google Calendar API ${res.status}: ${body}`);
  }
  return body ? JSON.parse(body) : null;
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

interface CostingItem {
  id: string;
  description?: string;
  supplier?: string;
  status?: string;
  netTotal?: number;
  pvpTotal?: number;
  numAdults?: number;
  numChildren?: number;
  notes?: any[];
  category?: string;
}

interface OperationRow {
  item_key: string;
  day_number: number;
  schedule_time: string | null;
  booking_status: string | null;
  payment_status: string | null;
  invoice_status: string | null;
}

interface EmailLog {
  operation_id: string | null;
  lead_operation_id: string | null;
  sent_at: string;
}

interface DayPayload {
  day_number: number;
  day_date: string;
  items: Array<CostingItem & OperationRow & { emailSentAt?: string }>;
}

function summarizeDayStatus(items: DayPayload['items']): { prefix: string; label: string; colorId: string } {
  const total = items.length;
  if (total === 0) return { prefix: '', label: 'Rascunho', colorId: '5' };
  const cancelled = items.filter(i => i.booking_status === 'cancelled').length;
  if (cancelled === total) return { prefix: 'CANCELADO', label: 'Cancelado', colorId: '11' };
  const booked = items.filter(i => i.booking_status === 'booked').length;
  const paid = items.filter(i => i.payment_status === 'paid').length;
  const invoiced = items.filter(i => i.invoice_status === 'received').length;
  if (booked === total && paid === total && invoiced === total) return { prefix: 'OK -', label: 'Confirmado + Pago + Faturado', colorId: '10' };
  if (booked === total) return { prefix: '*', label: 'Confirmado', colorId: '9' };
  if (booked > 0) return { prefix: '**', label: 'Parcial', colorId: '8' };
  return { prefix: '', label: 'Por confirmar', colorId: '5' };
}

function bookingLabel(status: string | null): string {
  switch (status) {
    case 'booked': return 'Reservado';
    case 'confirmed': return 'Reservado';
    case 'sent': return 'Pedido enviado';
    case 'requested': return 'Pedido enviado';
    case 'neutral': return 'Neutro';
    case 'cancelled': return 'Cancelado';
    case 'pending': return 'Aguarda resposta';
    default: return 'Por reservar';
  }
}

function buildTitle(lead: any, day: DayPayload, agentName: string): string {
  const summary = summarizeDayStatus(day.items);
  const family = (lead.client_name || '').split(' ').slice(-1)[0] || lead.client_name || 'Cliente';
  const tour = lead.destination || 'Tour';
  const parts = [];
  if (summary.prefix) parts.push(summary.prefix);
  parts.push(`*${tour} (${family} Family)`);
  parts.push(`- ${summary.label}`);
  if (agentName) parts.push(`- ${agentName}`);
  return parts.join(' ');
}

function fmtTime(t: string | null): string {
  if (!t) return '--:--';
  return t.slice(0, 5);
}

function fmtDate(iso: string | null | undefined, short = true): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return short ? `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}` : d.toISOString().slice(0,10);
}

function buildDescription(lead: any, day: DayPayload, dayIndex: number, totalDays: number): string {
  const bookingId = lead.yt_id || lead.lead_code || '';
  const notes = (lead.notes || '').trim();
  const pax = `${lead.pax || 0} pessoas (${lead.pax || 0} adultos${lead.pax_children ? ` + ${lead.pax_children} jovens` : ''}${lead.pax_infants ? ` + ${lead.pax_infants} bebés` : ''})`;
  const firstItem = day.items[0];
  const pickup = firstItem?.schedule_time ? `${fmtTime(firstItem.schedule_time)}` : 'a definir';

  const header = [
    notes ? `NOTAS PARA BACKOFFICE:\n${notes}\n` : '',
    `────────────────────────`,
    `Tour: ${lead.destination || ''}`,
    `Dia: ${dayIndex + 1} / ${totalDays}`,
    `Data: ${day.day_date}`,
    `Pick-up: ${pickup}`,
    `Idioma: EN`,
    `Nome: ${lead.client_name || ''}`,
    `Nº pax: ${pax}`,
    `Contacto: ${lead.phone || ''} | ${lead.email || ''}`,
    `Origem da reserva: ${lead.source || 'Your Tours'}`,
    bookingId ? `Nº Reserva: #${bookingId}` : '',
    `Ref. Interna: ${lead.lead_code || ''}`,
    `Estado: ${lead.status || ''}`,
  ].filter(Boolean).join('\n');

  const detailsHeader = `\n\nDETALHES DO SERVIÇO:\n`;
  const details = day.items
    .sort((a, b) => (a.schedule_time || '99:99').localeCompare(b.schedule_time || '99:99'))
    .map(item => {
      const time = fmtTime(item.schedule_time);
      const supplier = item.supplier || 'Fornecedor';
      const desc = item.description || '';
      const status = bookingLabel(item.booking_status);
      const lines = [`• ${time} - ${supplier} | ${desc} - ${status}`];
      if (item.emailSentAt) lines.push(`    ◦ email enviado ${fmtDate(item.emailSentAt)}`);
      if (item.payment_status === 'paid') lines.push(`    ◦ Pago pelo BackOffice`);
      if (['invoice_received','invoice_approved','invoice_paid'].includes(item.invoice_status || '')) {
        lines.push(`    ◦ Fatura recebida`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  return header + detailsHeader + (details || '(sem serviços atribuídos ao dia)');
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

async function deleteAllForLead(supabase: any, calendarId: string, leadId: string) {
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id, google_event_id')
    .eq('lead_id', leadId);
  for (const row of existing || []) {
    if (row.google_event_id) {
      try {
        await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${row.google_event_id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete event', row.google_event_id, e);
      }
    }
  }
  await supabase.from('calendar_events').delete().eq('lead_id', leadId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json() as SyncRequest;
    if (!body.lead_id) throw new Error('lead_id required');
    const mode = body.mode || 'update';

    const { calendarId, enabled } = await getCalendarId(supabase);
    if (!enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads').select('*').eq('id', body.lead_id).maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) throw new Error('lead not found');

    // If not won (or explicit delete), wipe everything
    if (mode === 'delete' || lead.status !== 'won') {
      await deleteAllForLead(supabase, calendarId, body.lead_id);
      return new Response(JSON.stringify({ ok: true, deleted: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load costing + operations + emails
    const [{ data: costingRows }, { data: ops }, { data: emails }, { data: agents }] = await Promise.all([
      supabase.from('lead_costing_data').select('day_number, items, version').eq('lead_id', body.lead_id).eq('version', lead.active_version || 0),
      supabase.from('lead_operations').select('*').eq('lead_id', body.lead_id),
      supabase.from('booking_emails_log').select('lead_operation_id, sent_at').eq('lead_id', body.lead_id).order('sent_at', { ascending: false }),
      lead.assigned_agents && lead.assigned_agents.length
        ? supabase.from('profiles').select('id, full_name, email').in('id', lead.assigned_agents)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const opByKey = new Map<string, OperationRow>((ops || []).map((o: any) => [`${o.day_number}:${o.item_key}`, o]));
    const emailByOpId = new Map<string, string>();
    for (const e of (emails || [])) {
      if (e.lead_operation_id && !emailByOpId.has(e.lead_operation_id)) emailByOpId.set(e.lead_operation_id, e.sent_at);
    }

    const startDate = parseTravelStart(lead.travel_dates, lead.travel_end_date);
    if (!startDate) {
      return new Response(JSON.stringify({ ok: false, error: 'travel_dates not parseable' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group items by day_number
    const daysMap = new Map<number, DayPayload>();
    for (const row of (costingRows || [])) {
      const dayNum = row.day_number;
      const dayDate = ymd(addDays(startDate, dayNum - 1));
      const items = Array.isArray(row.items) ? row.items : [];
      const dayItems = items.map((ci: CostingItem) => {
        const op = opByKey.get(`${dayNum}:${ci.id}`);
        // Try to find email for this operation via the id from lead_operations row
        // op has its own id (from lead_operations table row)
        const opId = (op as any)?.id;
        return {
          ...ci,
          item_key: ci.id,
          day_number: dayNum,
          schedule_time: op?.schedule_time || null,
          booking_status: op?.booking_status || null,
          payment_status: op?.payment_status || null,
          invoice_status: op?.invoice_status || null,
          emailSentAt: opId ? emailByOpId.get(opId) : undefined,
        };
      });
      if (dayItems.length > 0) {
        daysMap.set(dayNum, { day_number: dayNum, day_date: dayDate, items: dayItems });
      }
    }

    const days = Array.from(daysMap.values()).sort((a, b) => a.day_number - b.day_number);
    const totalDays = days.length || lead.number_of_days || 1;
    const agentName = (agents && agents[0]?.full_name) || lead.sales_owner || '';

    // Load existing mappings
    const { data: existingMappings } = await supabase
      .from('calendar_events').select('*').eq('lead_id', body.lead_id);
    const existingByDate = new Map((existingMappings || []).map((m: any) => [m.day_date, m]));

    const results: any[] = [];
    const activeDates = new Set<string>();

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      activeDates.add(day.day_date);
      const summary = summarizeDayStatus(day.items);
      const title = buildTitle(lead, day, agentName);
      const description = buildDescription(lead, day, i, totalDays);
      const eventPayload: any = {
        summary: title,
        description,
        location: lead.destination || '',
        colorId: '3', // Violeta (Grape) — default automático; humano pode alterar manualmente
        start: { date: day.day_date, timeZone: 'Europe/Lisbon' },
        end: { date: ymd(addDays(new Date(day.day_date + 'T00:00:00Z'), 1)), timeZone: 'Europe/Lisbon' },
        extendedProperties: {
          private: {
            yt_lead_id: body.lead_id,
            yt_lead_code: lead.lead_code || '',
            yt_day_date: day.day_date,
          },
        },
      };
      const attendees = (agents || []).map((a: any) => ({ email: a.email })).filter((a: any) => a.email);
      if (attendees.length > 0) eventPayload.attendees = attendees;

      const payloadHash = hash(eventPayload);
      const existing: any = existingByDate.get(day.day_date);

      if (existing && existing.last_payload_hash === payloadHash && existing.google_event_id && mode !== 'full_resync') {
        results.push({ day_date: day.day_date, action: 'unchanged' });
        continue;
      }

      try {
        let eventId = existing?.google_event_id;
        if (eventId) {
          await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=none`, {
            method: 'PATCH', body: JSON.stringify(eventPayload),
          });
        } else {
          const created = await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`, {
            method: 'POST', body: JSON.stringify(eventPayload),
          });
          eventId = created?.id;
        }
        await supabase.from('calendar_events').upsert({
          lead_id: body.lead_id,
          day_date: day.day_date,
          google_event_id: eventId,
          last_synced_at: new Date().toISOString(),
          last_payload_hash: payloadHash,
          status: summary.label,
          sync_error: null,
        }, { onConflict: 'lead_id,day_date' });
        results.push({ day_date: day.day_date, action: existing ? 'updated' : 'created', eventId });
      } catch (err: any) {
        console.error('Failed to sync day', day.day_date, err);
        await supabase.from('calendar_events').upsert({
          lead_id: body.lead_id,
          day_date: day.day_date,
          google_event_id: existing?.google_event_id || null,
          last_synced_at: new Date().toISOString(),
          last_payload_hash: existing?.last_payload_hash || null,
          status: summary.label,
          sync_error: String(err.message || err),
        }, { onConflict: 'lead_id,day_date' });
        results.push({ day_date: day.day_date, action: 'error', error: String(err.message || err) });
      }
    }

    // Delete stale mappings (days that no longer exist)
    for (const m of existingMappings || []) {
      if (!activeDates.has((m as any).day_date)) {
        if ((m as any).google_event_id) {
          try {
            await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${(m as any).google_event_id}?sendUpdates=none`, { method: 'DELETE' });
          } catch (e) { console.error('cleanup delete failed', e); }
        }
        await supabase.from('calendar_events').delete().eq('id', (m as any).id);
        results.push({ day_date: (m as any).day_date, action: 'removed' });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('calendar-sync error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
