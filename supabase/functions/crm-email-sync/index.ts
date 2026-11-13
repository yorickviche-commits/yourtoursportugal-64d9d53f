// Scheduled read-only mirror: links every message of the shared mailboxes to TCC files.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { gmailGet, gmailBatch, META_QS, MAILBOX_KEY_RE } from '../_shared/gmail.ts';
import { loadLeadIndex } from '../_shared/lead-matcher.ts';
import { toMeta, linkMessages, loadSupplierEmails } from '../_shared/email-link.ts';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const BUDGET_MS = 110_000;

function lisbonHour(d = new Date()) { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hour12: false }).format(d)); }

async function authorized(req: Request, db: any) {
  const secret = req.headers.get('x-sync-secret');
  if (secret) { const { data } = await db.rpc('get_sync_worker_secret'); return !!data && data === secret; }
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const { data } = await db.auth.getUser(auth.slice(7));
  if (!data?.user) return false;
  const r = await db.rpc('is_internal_user', { _user_id: data.user.id });
  return !!r.data;
}

async function alert(db: any, mailbox: string, message: string) {
  const title = `Sincronização de emails falhou: ${mailbox}`;
  const open = await db.from('workbench_alerts').select('id').eq('title', title).eq('status', 'open').limit(1);
  if (!open.data?.length) await db.from('workbench_alerts').insert({ side: mailbox.startsWith('reservas') ? 'sales' : 'ops', title, reason: message.slice(0, 500), next_step: 'Verificar a ligação Gmail desta caixa nos conectores.', status: 'open' });
}

async function syncMailbox(db: any, st: any, leads: any[], suppliers: Set<string>, started: number) {
  const mailbox = st.mailbox as string, key = st.secret_name as string | null;
  if (!key || !MAILBOX_KEY_RE.test(key) || !Deno.env.get(key)) return { mailbox, skipped: 'Caixa ainda não ligada' };
  const profile = await gmailGet(key, '/profile');
  if (profile.status !== 200) throw new Error(`Gmail perfil [${profile.status}]: ${JSON.stringify(profile.body).slice(0, 300)}`);
  if (String(profile.body.emailAddress).toLowerCase() !== mailbox) throw new Error(`A ligação ${key} corresponde a ${profile.body.emailAddress}, não a ${mailbox}`);
  let totals = { linked: 0, suggested: 0, skipped: 0, messages: 0 };
  const process = async (ids: string[]) => {
    if (!ids.length) return;
    const res = await gmailBatch(key, ids.map((id) => `/messages/${id}${META_QS}`));
    const metas = res.filter((r) => r.status === 200 && r.body?.id && !(r.body.labelIds || []).some((l: string) => l === 'SPAM' || l === 'TRASH' || l === 'DRAFT')).map((r) => toMeta(mailbox, r.body));
    const bad = res.filter((r) => r.status !== 200 && r.status !== 404);
    if (bad.length) throw new Error(`Gmail mensagens [${bad[0].status}]: ${JSON.stringify(bad[0].body).slice(0, 200)}`);
    // oldest first so thread links propagate to later replies within the same run
    metas.sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)));
    const r = await linkMessages(db, leads, suppliers, metas, 'crm-email-sync');
    totals = { linked: totals.linked + r.linked, suggested: totals.suggested + r.suggested, skipped: totals.skipped + r.skipped, messages: totals.messages + metas.length };
  };
  const save = (p: Record<string, unknown>) => db.from('mailbox_sync_state').update({ ...p, last_run_at: new Date().toISOString() }).eq('mailbox', mailbox);

  // Backfill (first run, or after an expired history id)
  if (!st.last_history_id || st.backfill_page_token || st.backfill_history_id) {
    const days = st.backfill_days || 90;
    let historyId = st.backfill_history_id || String(profile.body.historyId);
    let page = st.backfill_page_token || '';
    const q = encodeURIComponent(`newer_than:${days}d -in:chats`);
    do {
      const list = await gmailGet(key, `/messages?maxResults=100&q=${q}${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
      if (list.status !== 200) throw new Error(`Gmail lista [${list.status}]`);
      await process((list.body.messages || []).map((m: any) => m.id));
      page = list.body.nextPageToken || '';
      if (page && Date.now() - started > BUDGET_MS) { await save({ backfill_page_token: page, backfill_history_id: historyId, backfill_days: days, last_error: null }); return { mailbox, backfill: 'continua', ...totals }; }
    } while (page);
    await save({ last_history_id: historyId, backfill_page_token: null, backfill_history_id: null, backfill_days: null, backfill_done_at: new Date().toISOString(), last_error: null });
    return { mailbox, backfill: 'concluído', days, ...totals };
  }
  // Incremental via history
  let page = '', newest = st.last_history_id as string;
  do {
    const h = await gmailGet(key, `/history?startHistoryId=${encodeURIComponent(st.last_history_id)}&historyTypes=messageAdded&maxResults=500${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
    if (h.status === 404) { await save({ backfill_days: 7, backfill_history_id: String(profile.body.historyId), backfill_page_token: null, last_error: 'Histórico expirado — refazer últimos 7 dias' }); return { mailbox, reset: '7 dias' }; }
    if (h.status !== 200) throw new Error(`Gmail histórico [${h.status}]: ${JSON.stringify(h.body).slice(0, 200)}`);
    const ids = [...new Set((h.body.history || []).flatMap((x: any) => (x.messagesAdded || []).map((a: any) => a.message.id)))] as string[];
    await process(ids);
    if (h.body.historyId) newest = String(h.body.historyId);
    page = h.body.nextPageToken || '';
  } while (page && Date.now() - started < BUDGET_MS);
  await save({ last_history_id: newest, last_error: null });
  return { mailbox, ...totals };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  if (!(await authorized(req, db))) return json({ error: 'Não autorizado' }, 401);
  const body = await req.json().catch(() => ({}));
  // Cron fires every 10 min; outside 07–21h Lisbon only the first slot of each hour runs.
  if (body.cron) { const h = lisbonHour(); if ((h < 7 || h >= 21) && new Date().getUTCMinutes() >= 10) return json({ skipped: 'fora de horas' }); }
  const started = Date.now();
  // Keep secret names in sync with Cockpit mailbox settings.
  const settings = await db.from('workbench_settings').select('key,value').in('key', ['mailbox_sales', 'mailbox_ops', 'mailbox_finance']);
  const defaults: Record<string, string> = { mailbox_sales: 'reservas@yourtours.pt', mailbox_ops: 'operations@yourtours.pt', mailbox_finance: 'contabilidade@yourtours.pt' };
  for (const s of settings.data || []) { const v = s.value || {}; await db.from('mailbox_sync_state').upsert({ mailbox: String(v.address || defaults[s.key]).toLowerCase(), secret_name: v.secret_name || null }, { onConflict: 'mailbox' }); }
  let q = db.from('mailbox_sync_state').select('*');
  if (body.mailbox) q = q.eq('mailbox', String(body.mailbox).toLowerCase());
  const states = await q;
  if (states.error) return json({ error: states.error.message }, 500);
  const [leads, suppliers] = await Promise.all([loadLeadIndex(db), loadSupplierEmails(db)]);
  const results: unknown[] = [];
  for (const st of states.data || []) {
    try { results.push(await syncMailbox(db, st, leads, suppliers, started)); await db.from('workbench_alerts').update({ status: 'handled', handled_at: new Date().toISOString() }).eq('title', `Sincronização de emails falhou: ${st.mailbox}`).eq('status', 'open'); }
    catch (e) { const msg = e instanceof Error ? e.message : String(e); console.error('crm-email-sync', st.mailbox, msg); await db.from('mailbox_sync_state').update({ last_error: msg, last_run_at: new Date().toISOString() }).eq('mailbox', st.mailbox); await alert(db, st.mailbox, msg); results.push({ mailbox: st.mailbox, error: msg }); }
  }
  return json({ ok: true, results });
});
