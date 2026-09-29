// Generic sync worker. Called by pg_cron (every minute) and by enqueue_sync (fire-and-forget).
// Requires header x-sync-secret matching the vault secret 'sync_worker_secret'.
// Step 1: processes target='calendar' only; 'nethunt' items stay pending.
import { createClient, SUPABASE_URL, SERVICE_ROLE_KEY, getSyncAdmins, runCalendarSync, ADMIN_URL_BASE } from '../_shared/calendar-sync-core.ts';

const BACKOFF_MIN = [1, 2, 5, 15, 60];
const MAX_ATTEMPTS = 5;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function esc(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

async function notifyFailure(sb: any, leadId: string, error: string) {
  const { data: lead } = await sb.from('leads').select('yt_id, lead_code, client_name').eq('id', leadId).maybeSingle();
  const ref = lead?.yt_id || lead?.lead_code || leadId;
  const link = `${ADMIN_URL_BASE}${leadId}`;
  const subject = `Falha de sincronização Calendar — ${ref}`;
  const text = `A sincronização do Google Calendar falhou 5 vezes.\n\nLead: ${lead?.client_name || ''}\nYT ID: ${ref}\nErro: ${error}\n\n${link}`;
  const html = `<p>A sincronização do Google Calendar falhou 5 vezes.</p><p><b>Lead:</b> ${esc(lead?.client_name || '')}<br><b>YT ID:</b> ${esc(ref)}<br><b>Erro:</b> ${esc(error)}</p><p><a href="${link}">${link}</a></p>`;
  for (const to of await getSyncAdmins(sb)) {
    const messageId = crypto.randomUUID();
    const { error: e } = await sb.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        idempotency_key: `sync-fail-${leadId}-${to}-${new Date().toISOString().slice(0, 13)}`,
        to,
        from: 'Your Tours TCC <noreply@yourtours.pt>',
        sender_domain: 'notify.yourtours.pt',
        subject, html, text,
        purpose: 'transactional',
        label: 'sync_failure',
        queued_at: new Date().toISOString(),
      },
    });
    if (e) console.error('enqueue_email failed', e);
  }
}

Deno.serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const given = req.headers.get('x-sync-secret') || '';
  const { data: expected } = await sb.rpc('get_sync_worker_secret');
  if (!expected || given !== expected) return reply({ error: 'forbidden' }, 403);

  const { data: items, error } = await sb.rpc('claim_sync_items', { p_target: 'calendar', p_limit: 20 });
  if (error) return reply({ error: error.message }, 500);

  const out: any[] = [];
  for (const it of (items || []) as any[]) {
    try {
      const res = await runCalendarSync(sb, { lead_id: it.entity_id, mode: 'update' });
      const errs = (res.body?.results || []).filter((r: any) => r.action === 'error').map((r: any) => `${r.day_date}: ${r.error}`);
      if (res.body?.ok === false) errs.push(String(res.body.error || 'erro'));
      if (errs.length) throw new Error(errs.join(' | ').slice(0, 2000));
      await sb.from('sync_queue').update({ status: 'done', last_error: null, updated_at: new Date().toISOString() }).eq('id', it.id);
      out.push({ id: it.id, ok: true });
    } catch (e: any) {
      const msg = String(e?.message || e);
      const attempts = (it.attempts || 0) + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      const next = new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000).toISOString();
      await sb.from('sync_queue').update({
        status: failed ? 'failed' : 'pending', attempts, next_attempt_at: next, last_error: msg, updated_at: new Date().toISOString(),
      }).eq('id', it.id);
      if (failed) await notifyFailure(sb, it.entity_id, msg);
      out.push({ id: it.id, ok: false, attempts, error: msg });
    }
  }
  return reply({ processed: out.length, items: out });
});
