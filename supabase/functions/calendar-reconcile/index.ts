// Verificação diária: só LÊ o Google Calendar, marca mapeamentos, enfileira e reporta.
// Nunca escreve nem apaga eventos no Google.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  createClient, SUPABASE_URL, SERVICE_ROLE_KEY, getSyncAdmins, isCalendarEligible,
  gcal, getCalendarId, saveSnapshot, ymd, addDays, ADMIN_URL_BASE,
} from '../_shared/calendar-sync-core.ts';
import { fetchRecord, DEALS_FOLDER, recordLink } from '../_shared/nethunt.ts';
import { createLeadFromDeal, runPull } from '../_shared/nethunt-pull-core.ts';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function callerEmail(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const anon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data } = await anon.auth.getUser(auth.slice(7));
  return data?.user?.email?.toLowerCase() || null;
}

async function reconcile(sb: any, trigger: string) {
  const { data: run } = await sb.from('sync_reconcile_runs').insert({ trigger }).select('id').single();
  const today = ymd(new Date());
  const from = ymd(addDays(new Date(today + 'T00:00:00Z'), -7));
  const { calendarId, enabled } = await getCalendarId(sb);
  const report: Record<string, any[]> = {
    manual_edit: [], orphan: [], enqueued: [], unmapped_tagged: [],
    queue_failed: [], nethunt_conflicts: [], deals_unlinked: [], leads_without_nethunt: [],
  };
  const stats: Record<string, number> = { checked: 0 };
  const calLink = (id: string) => `https://calendar.google.com/calendar/u/0/r/eventedit/${btoa(`${id} ${calendarId}`).replace(/=+$/, '')}`;

  try {
    if (enabled) {
      // 1) Estado dos eventos mapeados
      const { data: maps } = await sb.from('calendar_events').select('*').gte('day_date', from).not('google_event_id', 'is', null);
      for (const m of (maps || [])) {
        stats.checked++;
        const r = await gcal(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(m.google_event_id)}`, { method: 'GET' });
        if (r.status === 404 || r.status === 410 || r.data?.status === 'cancelled') {
          if (m.protection_status !== 'orphan') {
            await sb.from('calendar_events').update({ protection_status: 'orphan', sync_error: 'Evento não encontrado no Google Calendar' }).eq('id', m.id);
          }
          report.orphan.push({ lead_id: m.lead_id, day_date: m.day_date, event_id: m.google_event_id, link: ADMIN_URL_BASE + m.lead_id });
          continue;
        }
        if (!r.ok) continue;
        if (m.protection_status === 'ok' && m.google_etag && r.data?.etag && r.data.etag !== m.google_etag) {
          try { await saveSnapshot(sb, m.lead_id, m.day_date, r.data, 'reconcile_manual_edit'); } catch (e) { console.error(e); }
          await sb.from('calendar_events').update({
            protection_status: 'manual_edit', manual_edit_detected_at: new Date().toISOString(),
            sync_error: 'Evento editado manualmente no Google Calendar — o TCC não sobrescreve. Rever no calendário.',
          }).eq('id', m.id);
          report.manual_edit.push({ lead_id: m.lead_id, day_date: m.day_date, event_id: m.google_event_id, link: ADMIN_URL_BASE + m.lead_id, gcal: r.data?.htmlLink || calLink(m.google_event_id) });
        } else if (m.protection_status === 'manual_edit' && m.day_date >= today) {
          report.manual_edit.push({ lead_id: m.lead_id, day_date: m.day_date, event_id: m.google_event_id, link: ADMIN_URL_BASE + m.lead_id, gcal: r.data?.htmlLink || calLink(m.google_event_id), existing: true });
        }
      }

      // 2) Leads elegíveis com dias futuros sem evento -> enqueue
      const { data: leads } = await sb.from('leads').select('id, status, nethunt_stage, travel_dates, travel_end_date, yt_id, client_name')
        .or('status.eq.won,nethunt_stage.like.OPERATIONS - %');
      const { data: futureMaps } = await sb.from('calendar_events').select('lead_id').gte('day_date', today);
      const withFuture = new Set((futureMaps || []).map((m: any) => m.lead_id));
      for (const l of (leads || [])) {
        if (!isCalendarEligible(l) || withFuture.has(l.id)) continue;
        const end = String(l.travel_end_date || l.travel_dates || '').match(/\d{4}-\d{2}-\d{2}/g)?.pop();
        if (!end || end < today) continue;
        const { count } = await sb.from('lead_operations').select('id', { count: 'exact', head: true }).eq('lead_id', l.id);
        if (!count) continue;
        await sb.rpc('enqueue_sync', { p_target: 'calendar', p_entity: 'lead', p_entity_id: l.id, p_fields: [], p_reason: 'reconcile:missing_events' });
        report.enqueued.push({ lead_id: l.id, ref: l.yt_id, name: l.client_name, link: ADMIN_URL_BASE + l.id });
      }

      // 3) Eventos marcados pelo TCC sem mapeamento
      const { data: allMaps } = await sb.from('calendar_events').select('google_event_id');
      const mapped = new Set((allMaps || []).map((m: any) => m.google_event_id));
      let pageToken = '';
      const timeMin = new Date(today + 'T00:00:00Z').toISOString();
      for (let p = 0; p < 10; p++) {
        const q = `?singleEvents=true&maxResults=250&timeMin=${encodeURIComponent(timeMin)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const r = await gcal(`/calendars/${encodeURIComponent(calendarId)}/events${q}`, { method: 'GET' });
        if (!r.ok) break;
        for (const ev of (r.data?.items || [])) {
          const priv = ev.extendedProperties?.private || {};
          if ((priv.yt_lead_id || priv.source === 'tcc') && !mapped.has(ev.id) && ev.status !== 'cancelled') {
            report.unmapped_tagged.push({ event_id: ev.id, summary: ev.summary, day_date: (ev.start?.date || ev.start?.dateTime || '').slice(0, 10), lead_id: priv.yt_lead_id || null, gcal: ev.htmlLink });
          }
        }
        pageToken = r.data?.nextPageToken || '';
        if (!pageToken) break;
      }
    }

    // 4) Fila, NetHunt
    const { data: failed } = await sb.from('sync_queue').select('id, target, entity, entity_id, attempts, last_error, updated_at').eq('status', 'failed').order('updated_at', { ascending: false }).limit(100);
    report.queue_failed = (failed || []).map((f: any) => ({ ...f, link: f.entity === 'lead' ? ADMIN_URL_BASE + f.entity_id : null }));
    const since24 = new Date(Date.now() - 86400000).toISOString();
    const { data: conf } = await sb.from('nethunt_conflicts').select('*').gte('created_at', since24).order('created_at', { ascending: false }).limit(100);
    report.nethunt_conflicts = conf || [];
    const { data: unmatched } = await sb.from('nethunt_sync_log').select('nethunt_record_id, detail, created_at').eq('action', 'unmatched').not('nethunt_record_id', 'is', null).order('created_at', { ascending: false }).limit(1000);
    const rids = [...new Set((unmatched || []).map((u: any) => u.nethunt_record_id))];
    if (rids.length) {
      const { data: linked } = await sb.from('leads').select('nethunt_record_id').in('nethunt_record_id', rids);
      const linkedSet = new Set((linked || []).map((l: any) => l.nethunt_record_id));
      for (const rid of rids) {
        if (linkedSet.has(rid)) continue;
        const u = (unmatched || []).find((x: any) => x.nethunt_record_id === rid);
        report.deals_unlinked.push({ record_id: rid, yt_id: u?.detail?.yt_id ?? null, link: recordLink(rid) });
      }
    }
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: noNh } = await sb.from('leads').select('id, yt_id, lead_code, client_name, created_at').is('nethunt_record_id', null).gte('created_at', since30).order('created_at', { ascending: false });
    report.leads_without_nethunt = (noNh || []).map((l: any) => ({ ...l, link: ADMIN_URL_BASE + l.id }));

    for (const k of Object.keys(report)) stats[k] = report[k].length;
    const needsReview = stats.manual_edit + stats.orphan + stats.unmapped_tagged + stats.queue_failed + stats.nethunt_conflicts + stats.deals_unlinked + stats.leads_without_nethunt > 0;

    let emailed = false;
    if (needsReview && trigger === 'cron') {
      const section = (title: string, rows: any[], fmt: (r: any) => string) => rows.length
        ? `<h3>${esc(title)} (${rows.length})</h3><ul>${rows.slice(0, 30).map(r => `<li>${fmt(r)}</li>`).join('')}</ul>` : '';
      const a = (url: string | null, label: string) => url ? `<a href="${esc(url)}">${esc(label)}</a>` : esc(label);
      const html = `<p>Verificação diária da sincronização — há itens para rever.</p>`
        + section('Eventos editados à mão', report.manual_edit, r => `${esc(r.day_date)} · ${a(r.link, 'lead')} · ${a(r.gcal, 'evento')}`)
        + section('Eventos órfãos', report.orphan, r => `${esc(r.day_date)} · ${a(r.link, 'lead')}`)
        + section('Eventos TCC sem ligação', report.unmapped_tagged, r => `${esc(r.day_date)} ${esc(r.summary)} · ${a(r.gcal, 'evento')}`)
        + section('Fila com falhas', report.queue_failed, r => `${esc(r.target)} · ${a(r.link, String(r.entity_id))} · ${esc(r.last_error)}`)
        + section('Conflitos NetHunt (24 h)', report.nethunt_conflicts, r => `${esc(r.field)} · ${a(ADMIN_URL_BASE + r.entity_id, 'lead')} · vence ${esc(r.winner)}`)
        + section('Deals NetHunt sem lead', report.deals_unlinked, r => a(r.link, r.yt_id || r.record_id))
        + section('Leads sem file NetHunt (30 dias)', report.leads_without_nethunt, r => a(r.link, `${r.yt_id || r.lead_code || ''} ${r.client_name || ''}`))
        + `<p>${a('https://yourtoursportugal.lovable.app/admin/sync', 'Abrir página Sincronização')}</p>`;
      const subject = `Sincronização TCC — ${stats.manual_edit + stats.orphan} evento(s), ${stats.queue_failed} falha(s) para rever`;
      const text = html.replace(/<[^>]+>/g, ' ');
      for (const to of await getSyncAdmins(sb)) {
        const { error } = await sb.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: crypto.randomUUID(),
            idempotency_key: `sync-reconcile-${today}-${to}`,
            to, from: 'Your Tours TCC <noreply@yourtours.pt>', sender_domain: 'notify.yourtours.pt',
            subject, html, text, purpose: 'transactional', label: 'sync_reconcile', queued_at: new Date().toISOString(),
          },
        });
        if (!error) emailed = true; else console.error('enqueue_email failed', error);
      }
    }
    await sb.from('sync_reconcile_runs').update({ finished_at: new Date().toISOString(), stats, report, emailed }).eq('id', run.id);
    return { ok: true, run_id: run.id, stats, emailed };
  } catch (e: any) {
    await sb.from('sync_reconcile_runs').update({ finished_at: new Date().toISOString(), stats, report, error: String(e?.message || e) }).eq('id', run.id);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    const body = await req.json().catch(() => ({}));
    const given = req.headers.get('x-sync-secret') || '';
    let trigger = 'manual';
    if (given) {
      const { data: expected } = await sb.rpc('get_sync_worker_secret');
      if (!expected || given !== expected) return reply({ ok: false, error: 'forbidden' }, 403);
      trigger = 'cron';
    } else {
      const email = await callerEmail(req);
      const admins = await getSyncAdmins(sb);
      if (!email || !admins.includes(email)) return reply({ ok: false, error: 'reservado aos administradores de sincronização' }, 403);
    }

    const action = String(body.action || 'reconcile');
    if (action === 'reconcile') return reply(await reconcile(sb, trigger));
    if (trigger === 'cron') return reply({ ok: false, error: 'ação não permitida' }, 403);

    if (action === 'requeue') {
      const id = Number(body.id);
      const { error } = await sb.from('sync_queue').update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'failed');
      if (error) throw error;
      return reply({ ok: true });
    }
    if (action === 'link_deal') {
      const rid = String(body.record_id || ''); const leadId = String(body.lead_id || '');
      if (!rid || !leadId) return reply({ ok: false, error: 'record_id e lead_id obrigatórios' }, 400);
      const { data: taken } = await sb.from('leads').select('id').eq('nethunt_record_id', rid).maybeSingle();
      if (taken) return reply({ ok: false, error: 'Este deal já está ligado a outra lead' }, 409);
      const { error } = await sb.from('leads').update({ nethunt_record_id: rid }).eq('id', leadId).is('nethunt_record_id', null);
      if (error) throw error;
      await runPull({ recordId: rid });
      return reply({ ok: true });
    }
    if (action === 'create_lead_from_deal') {
      const rid = String(body.record_id || '');
      const { data: taken } = await sb.from('leads').select('id').eq('nethunt_record_id', rid).maybeSingle();
      if (taken) return reply({ ok: true, lead_id: taken.id, existing: true });
      const rec = await fetchRecord(DEALS_FOLDER, rid);
      if (!rec) return reply({ ok: false, error: 'Deal não encontrado no NetHunt' }, 404);
      const leadId = await createLeadFromDeal(sb as any, rec, []);
      return reply({ ok: !!leadId, lead_id: leadId });
    }
    return reply({ ok: false, error: 'ação desconhecida' }, 400);
  } catch (err: any) {
    console.error('calendar-reconcile error:', err);
    return reply({ ok: false, error: String(err.message || err) }, 500);
  }
});
