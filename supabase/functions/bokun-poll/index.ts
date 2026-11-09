// Bókun → TCC by polling (accounts without webhooks). Called by two pg_cron schedules:
//   mode=business (every 20 min, 07:00–22:00 Lisbon) and mode=night (every 6 h, 22:00–07:00 Lisbon).
// Light first: if Bókun reports nothing created/changed since the cursor, it only refreshes the
// heartbeat row and exits. Admins can import a date range with mode=import (JWT, admin only).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  searchBookings, normalizeBooking, applyBooking, bookingHash, alertAdmins, lisbonHour, isBusinessHour,
  BokunApiError, type BokunBooking,
} from '../_shared/bokun.ts';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MARGIN_MS = 10 * 60 * 1000;
const FULL_SCAN_EVERY_MS = 60 * 60 * 1000; // future-trip comparison, at most hourly
const FUTURE_DAYS = 400;

async function isAdminRequest(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const { data } = await sb.auth.getClaims(auth.slice(7));
  const uid = data?.claims?.sub;
  if (!uid) return false;
  const { data: ok } = await sb.rpc('is_admin', { _user_id: uid });
  return Boolean(ok);
}

async function processItems(items: any[], label: string) {
  const counts = { seen: items.length, created: 0, updated: 0, cancelled: 0, unchanged: 0, errors: 0 };
  const errors: { code: string; error: string }[] = [];
  const changed: string[] = [];
  for (const it of items) {
    let x: BokunBooking | null = null;
    try {
      x = normalizeBooking(it);
      const { result, leadId } = await applyBooking(sb, x);
      counts[result]++;
      if (result !== 'unchanged') changed.push(`${x.code}:${result}`);
      void leadId;
    } catch (e) {
      counts.errors++;
      const msg = String((e as Error)?.message || e).slice(0, 500);
      errors.push({ code: x?.code || String(it?.confirmationCode || '?'), error: msg });
      await alertAdmins(sb, { key: `booking-${x?.code}-${new Date().toISOString().slice(0, 13)}`, title: `Bókun: falha na reserva ${x?.code || ''}`, body: msg, ref: x?.code });
    }
  }
  if (counts.created || counts.updated || counts.cancelled || counts.errors) {
    await sb.from('bokun_events').insert({
      event_id: `poll:${label}:${new Date().toISOString()}`, event_type: 'poll_run',
      status: counts.errors ? 'erro' : 'processado', raw_payload: { ...counts, changed, errors },
      error_message: errors.length ? errors.map((e) => `${e.code}: ${e.error}`).join(' | ').slice(0, 2000) : null,
      processed_at: new Date().toISOString(),
    });
  }
  return { counts, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const mode = String(body?.mode || '');

  // ----- Manual import by an admin -----
  if (mode === 'import') {
    if (!(await isAdminRequest(req))) return reply({ error: 'unauthorized' }, 401);
    const from = Date.parse(body?.from), to = Date.parse(body?.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 366 * 86400000) return reply({ error: 'Intervalo inválido (máx. 1 ano)' }, 400);
    if (!(await sb.rpc('bokun_try_lock', { p_seconds: 600 })).data) return reply({ error: 'Já existe uma sincronização Bókun a correr' }, 409);
    try {
      const items = await searchBookings({ creationDateRange: { from, to: to + 86399999 } }, 40);
      const r = await processItems(items, 'import');
      return reply({ ok: true, ...r.counts });
    } catch (e) {
      return reply({ error: String((e as Error).message) }, 502);
    } finally {
      await sb.from('bokun_sync_state').update({ locked_until: null }).eq('id', 1);
    }
  }

  // ----- Scheduled runs -----
  const secret = req.headers.get('x-sync-secret') || '';
  const { data: expected } = await sb.rpc('get_sync_worker_secret');
  if (!expected || secret !== expected) return reply({ error: 'forbidden' }, 403);
  const h = lisbonHour();
  // The cron windows are in UTC; skip (no reads/writes) when outside this mode's Lisbon window (DST-safe).
  if (mode === 'business' && !isBusinessHour(h)) return reply({ ok: true, skipped: 'fora do horário útil' });
  if (mode === 'night' && isBusinessHour(h)) return reply({ ok: true, skipped: 'horário útil' });
  if (mode !== 'business' && mode !== 'night') return reply({ error: 'mode inválido' }, 400);

  const now = Date.now();
  const { data: state } = await sb.from('bokun_sync_state').select('*').eq('id', 1).maybeSingle();
  if (!state?.cursor_at) {
    // First start: cursor = now, no history import.
    const iso = new Date(now).toISOString();
    await sb.from('bokun_sync_state').upsert({ id: 1, cursor_at: iso, last_run_at: iso, last_success_at: iso, last_full_scan_at: iso, consecutive_failures: 0, updated_at: iso });
    return reply({ ok: true, initialized: true });
  }

  try {
    const from = Date.parse(state.cursor_at) - MARGIN_MS;
    const fullScan = mode === 'night' || !state.last_full_scan_at || now - Date.parse(state.last_full_scan_at) >= FULL_SCAN_EVERY_MS;
    // Light calls: created and modified since the cursor.
    const [created, modified] = await Promise.all([
      searchBookings({ creationDateRange: { from, to: now } }),
      searchBookings({ lastModifiedDateRange: { from, to: now } }),
    ]);
    const byCode = new Map<string, any>();
    for (const it of [...created, ...modified]) if (it?.confirmationCode) byCode.set(it.confirmationCode, it);

    if (fullScan) {
      // Changes/cancellations of future trips: compare with the stored fingerprint (reads only).
      const future = await searchBookings({ startDateRange: { from: now - 86400000, to: now + FUTURE_DAYS * 86400000 } }, 40);
      const codes = future.map((f) => f?.confirmationCode).filter(Boolean);
      const known = new Map<string, string | null>();
      for (let i = 0; i < codes.length; i += 200) {
        const { data } = await sb.from('leads').select('bokun_confirmation_code, bokun_hash').in('bokun_confirmation_code', codes.slice(i, i + 200));
        for (const r of data ?? []) known.set(r.bokun_confirmation_code, r.bokun_hash);
      }
      for (const it of future) {
        const code = it?.confirmationCode;
        if (!code || byCode.has(code) || !known.has(code)) continue; // unknown future bookings predate the cursor: not imported
        if ((await bookingHash(normalizeBooking(it))) !== known.get(code)) byCode.set(code, it);
      }
    }

    let result: any = { counts: { seen: 0 } };
    if (byCode.size) {
      if (!(await sb.rpc('bokun_try_lock', { p_seconds: 600 })).data) return reply({ ok: true, skipped: 'outra execução em curso' });
      result = await processItems([...byCode.values()], mode);
    }
    // Single heartbeat write per run (needed for the "not running" watchdog).
    await sb.from('bokun_sync_state').update({
      cursor_at: new Date(now).toISOString(), last_run_at: new Date().toISOString(), last_success_at: new Date().toISOString(),
      ...(fullScan ? { last_full_scan_at: new Date(now).toISOString() } : {}),
      consecutive_failures: 0, last_error: null, locked_until: null, stale_alerted_at: null, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    return reply({ ok: true, fullScan, ...result.counts });
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 1000);
    const fails = (state.consecutive_failures ?? 0) + 1;
    await sb.from('bokun_sync_state').update({ last_run_at: new Date().toISOString(), consecutive_failures: fails, last_error: msg, locked_until: null, updated_at: new Date().toISOString() }).eq('id', 1);
    await sb.from('bokun_events').insert({ event_id: `poll-error:${new Date().toISOString()}`, event_type: 'poll_run', status: 'erro', error_message: msg, raw_payload: { mode, consecutive_failures: fails } });
    const auth = e instanceof BokunApiError && (e.status === 401 || e.status === 403 || e.status === 0);
    if (auth || fails === 1 || fails === 3) {
      await alertAdmins(sb, {
        key: `poll-fail-${fails}-${new Date().toISOString().slice(0, 13)}`,
        title: fails >= 3 ? `Bókun: sincronização falhou ${fails} vezes seguidas` : `Bókun: falha na sincronização${auth ? ' (autenticação)' : ''}`,
        body: msg,
      });
    }
    return reply({ ok: false, error: msg }, 500);
  }
});
