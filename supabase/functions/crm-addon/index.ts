// API for the YT CRM Google Workspace Add-on (Gmail + Calendar card). Auth = Google ID token.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'npm:jose@5';
import { z } from 'npm:zod@3';
import { loadLeadIndex, extractRefs, matchByRefs, matchByEmail, parseAddress, parseAddressList, isInternalEmail } from '../_shared/lead-matcher.ts';
import { gmailGet, gmailBatch, META_QS, MAILBOX_KEY_RE, gmailThreadUrl } from '../_shared/gmail.ts';
import { toMeta } from '../_shared/email-link.ts';

import { extractWithFailover } from '../_shared/lead-extract.ts';
import { createComment } from '../_shared/nethunt.ts';

const APP = 'https://yourtoursportugal.lovable.app';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (error: string, s = 200) => json({ ok: false, error }, s);

const STAGES = [
  ['SALES - New Lead', 'SALES · New Lead', 'sales', 'new'],
  ['SALES - - Budgeting & Fine-Tuning', 'SALES · Budgeting & Fine-Tuning', 'sales', 'proposal_sent'],
  ['SALES - Final Negotiation & Ready to Book', 'SALES · Final Negotiation & Ready to Book', 'sales', 'negotiation'],
  ['SALES - Archive', 'SALES · Archive', 'sales', 'lost'],
  ['OPERATIONS - Deposit/Payment Received', 'OPERATIONS · Deposit/Payment Received', 'ops', 'won'],
  ['OPERATIONS - Suppliers Bookings & Confirmations', 'OPERATIONS · Suppliers Bookings & Confirmations', 'ops', 'won'],
  ['OPERATIONS - Technical Briefing (Internal & Suppliers Final Validations)', 'OPERATIONS · Technical Briefing', 'ops', 'won'],
  ['OPERATIONS - Trip Ready / In Execution', 'OPERATIONS · Trip Ready / In Execution', 'ops', 'won'],
  ['OPERATIONS - Post-Trip Loop / Feedback', 'OPERATIONS · Post-Trip Loop / Feedback', 'ops', 'won'],
  ['OPERATIONS - Deferred / Postponed Trip', 'OPERATIONS · Deferred / Postponed Trip', 'ops', 'won'],
  ['OPERATIONS - Archive', 'OPERATIONS · Archive', 'ops', 'lost'],
] as const;
const stageOf = (code: string | null, status?: string | null) => STAGES.find((s) => s[0] === code) ?? (status === 'won' ? STAGES[4] : null);

type Actor = { email: string; label: string; userId: string | null };
const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function authenticate(req: Request, sb: any): Promise<Actor | Response> {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return fail('Token Google em falta', 401);
  const token = h.slice(7);
  let aud = '';
  try { const d = decodeJwt(token); aud = Array.isArray(d.aud) ? d.aud[0] : String(d.aud || ''); } catch { return fail('Token Google inválido', 401); }
  const allowed = (Deno.env.get('ADDON_GOOGLE_CLIENT_IDS') || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!allowed.includes(aud)) return fail(`Add-on ainda não autorizado. Configurar ADDON_GOOGLE_CLIENT_IDS com: ${aud}`, 403);
  let p: any;
  try { ({ payload: p } = await jwtVerify(token, JWKS, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: allowed })); }
  catch { return fail('Token Google inválido ou expirado', 401); }
  if (!p.email_verified || p.hd !== 'yourtours.pt') return fail('Conta não autorizada (só @yourtours.pt)', 403);
  const email = String(p.email).toLowerCase();
  const prof = await sb.from('profiles').select('id,full_name').ilike('email', email).maybeSingle();
  if (prof.data?.id) {
    const roles = await sb.from('user_roles').select('role').eq('user_id', prof.data.id).limit(1);
    if (roles.data?.length) return { email, userId: prof.data.id, label: `Add-on Gmail (${email})` };
  }
  const shared = await sb.from('workbench_settings').select('value').eq('key', 'addon_shared_mailboxes').maybeSingle();
  if (((shared.data?.value as string[]) || []).map((x) => x.toLowerCase()).includes(email)) return { email, userId: null, label: `Add-on Gmail (Caixa ${email})` };
  return fail('Utilizador sem acesso ao TCC', 403);
}

// ---------- LeadCard ----------
const LEAD_COLS = 'id,yt_id,client_name,email,nethunt_stage,status,trip_start,trip_finish,travel_dates,travel_end_date,pax,pax_children,destination,pvp_override,estimated_value,active_version,client_type,source,booking_origin,assigned_agents,language,updated_at,nethunt_record_id';
const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

async function timeline(sb: any, leadId: string, before?: string) {
  const lim = 25, b = before || '9999-12-31';
  const [em, ev, cl, nt, nn, tk, st] = await Promise.all([
    sb.from('email_links').select('mailbox,gmail_thread_id,direction,from_email,from_name,to_emails,subject,snippet,sent_at').eq('lead_id', leadId).eq('unlinked', false).lt('sent_at', b).order('sent_at', { ascending: false }).limit(lim),
    sb.from('calendar_events').select('google_event_id,day_date').eq('lead_id', leadId).lt('day_date', b).order('day_date', { ascending: false }).limit(lim),
    sb.from('calendar_event_links').select('title,start_at,html_link,event_id').eq('lead_id', leadId).eq('unlinked', false).lt('start_at', b).order('start_at', { ascending: false }).limit(lim),
    sb.from('nethunt_timeline').select('event_time,snippet,creator_name').eq('lead_id', leadId).eq('event_type', 'comment').lt('event_time', b).order('event_time', { ascending: false }).limit(lim),
    sb.from('item_notes').select('created_at,note_text').eq('entity_type', 'lead').eq('entity_key', leadId).lt('created_at', b).order('created_at', { ascending: false }).limit(lim),
    sb.from('tasks').select('title,due_date,created_at,completed').eq('lead_id', leadId).lt('created_at', b).order('created_at', { ascending: false }).limit(lim),
    sb.from('lead_stage_history').select('stage_label,stage_code,entered_at,source').eq('lead_id', leadId).lt('entered_at', b).order('entered_at', { ascending: false }).limit(lim),
  ]);
  const items: any[] = [];
  for (const e of em.data || []) items.push({ type: 'email', at: e.sent_at, title: e.subject || '(sem assunto)', subtitle: `${e.mailbox} · ${e.direction === 'out' ? (e.to_emails || []).join(', ') : e.from_name || e.from_email} · ${(e.snippet || '').slice(0, 120)}`, direction: e.direction, mailbox: e.mailbox, url: gmailThreadUrl(e.mailbox, e.gmail_thread_id) });
  for (const e of ev.data || []) items.push({ type: 'event', at: `${e.day_date}T09:00:00Z`, title: 'Evento Reservas YT', subtitle: e.day_date, direction: null, mailbox: null, url: null });
  for (const e of cl.data || []) items.push({ type: 'event', at: e.start_at, title: e.title || 'Evento', subtitle: 'Evento ligado', direction: null, mailbox: null, url: e.html_link });
  for (const n of nt.data || []) items.push({ type: 'note', at: n.event_time, title: (n.snippet || '').slice(0, 140), subtitle: n.creator_name || 'Nota', direction: null, mailbox: null, url: null });
  for (const n of nn.data || []) items.push({ type: 'note', at: n.created_at, title: (n.note_text || '').slice(0, 140), subtitle: 'Nota TCC', direction: null, mailbox: null, url: null });
  for (const t of tk.data || []) items.push({ type: 'task', at: t.created_at, title: t.title, subtitle: `${t.completed ? 'Concluída' : 'Aberta'}${t.due_date ? ` · ${t.due_date}` : ''}`, direction: null, mailbox: null, url: null });
  for (const s of st.data || []) items.push({ type: 'stage', at: s.entered_at, title: s.stage_label || s.stage_code, subtitle: s.source || '', direction: null, mailbox: null, url: null });
  return items.filter((x) => x.at).sort((a, c) => String(c.at).localeCompare(String(a.at))).slice(0, lim);
}

async function leadCard(sb: any, leadId: string, linkSource: string | null = null) {
  const r = await sb.from('leads').select(LEAD_COLS).eq('id', leadId).maybeSingle();
  if (!r.data) return null;
  const l = r.data;
  const [cost, paid, agents, task, tl] = await Promise.all([
    sb.from('lead_costing_data').select('items').eq('lead_id', leadId).eq('version', l.active_version ?? 0),
    sb.from('payments_ledger').select('amount_gross,payment_type,status').eq('lead_id', leadId),
    (l.assigned_agents || []).length ? sb.from('profiles').select('full_name,email').in('id', l.assigned_agents) : { data: [] },
    sb.from('tasks').select('title,due_date').eq('lead_id', leadId).eq('completed', false).order('due_date', { ascending: true, nullsFirst: false }).limit(1),
    timeline(sb, leadId),
  ]);
  let pvp = 0;
  for (const row of cost.data || []) for (const it of (Array.isArray(row.items) ? row.items : [])) if (it?.status !== 'eliminar' && it?.status !== 'opcionais') pvp += Number(it?.pvpTotal) || 0;
  const value = l.pvp_override != null ? Number(l.pvp_override) : pvp > 0 ? Math.round(pvp * 100) / 100 : l.estimated_value != null ? Number(l.estimated_value) : null;
  const paidAmount = (paid.data || []).filter((p: any) => !['requested', 'exception'].includes(p.status)).reduce((s: number, p: any) => s + (p.payment_type === 'refund' ? -1 : 1) * Number(p.amount_gross || 0), 0);
  const stage = stageOf(l.nethunt_stage, l.status);
  const program = l.client_name || '';
  const client = program.replace(/^YT\s*-?\s*\d+\s*-\s*/i, '').split(/\s+[-|]\s+/)[0] || program;
  const lastAt = [l.updated_at, ...tl.map((x: any) => x.at)].filter(Boolean).sort().pop();
  return {
    id: l.id, yt_id: l.yt_id, client_name: client, program_name: program,
    stage_key: stage?.[0] ?? l.nethunt_stage ?? null, stage_label: stage?.[1] ?? l.nethunt_stage ?? null, side: stage?.[2] ?? 'sales',
    start_date: iso(l.trip_start) ?? iso(l.travel_dates), end_date: iso(l.trip_finish) ?? iso(l.travel_end_date),
    pax: (Number(l.pax) || 0) + (Number(l.pax_children) || 0) || null, destination: l.destination || null,
    value_pvp: value, currency: 'EUR', paid_amount: Math.round(paidAmount * 100) / 100,
    b2x: l.client_type === 'B2B' ? 'B2B' : l.client_type === 'B2C' ? 'B2C' : null,
    origin: l.booking_origin || l.source || null, agents: (agents.data || []).map((a: any) => a.full_name || a.email),
    language: l.language || null, next_task: task.data?.[0] ? { title: task.data[0].title, due_date: task.data[0].due_date } : null,
    last_activity_at: lastAt || null, link_source: linkSource,
    tcc_url: `${APP}/leads/${l.id}`, cockpit_url: `${APP}/cockpit?lead=${l.id}`, timeline: tl,
  };
}
const cards = async (sb: any, ids: string[]) => (await Promise.all([...new Set(ids)].slice(0, 10).map((id) => leadCard(sb, id)))).filter(Boolean);

// ---------- email helpers ----------
const EmailData = z.object({
  mailbox: z.string().email(), gmail_message_id: z.string().min(1), gmail_thread_id: z.string().optional().nullable(),
  rfc822_message_id: z.string().optional().nullable(), subject: z.string().optional().default(''), from: z.string().optional().default(''),
  to: z.string().optional().default(''), cc: z.string().optional().default(''), date: z.string().optional().nullable(), body_excerpt: z.string().optional().default(''),
});
type EmailIn = z.infer<typeof EmailData>;
function emailRow(d: EmailIn) {
  const mailbox = d.mailbox.toLowerCase(), from = parseAddress(d.from);
  const dt = d.date ? new Date(d.date) : null;
  return {
    mailbox, gmail_message_id: d.gmail_message_id, gmail_thread_id: d.gmail_thread_id || null, rfc822_message_id: d.rfc822_message_id || null,
    direction: from.email === mailbox || isInternalEmail(from.email) ? 'out' : 'in', from_email: from.email, from_name: from.name,
    to_emails: [...parseAddressList(d.to), ...parseAddressList(d.cc)], subject: d.subject, snippet: (d.body_excerpt || '').slice(0, 300),
    body_excerpt: (d.body_excerpt || '').slice(0, 4000) || null, sent_at: dt && !isNaN(+dt) ? dt.toISOString() : new Date().toISOString(),
  };
}
async function existingLink(sb: any, d: EmailIn) {
  const mb = d.mailbox.toLowerCase();
  const own = await sb.from('email_links').select('lead_id,link_source,unlinked').eq('mailbox', mb).eq('gmail_message_id', d.gmail_message_id).maybeSingle();
  if (own.data) return own.data;
  if (d.rfc822_message_id) { const r = await sb.from('email_links').select('lead_id,link_source,unlinked').eq('rfc822_message_id', d.rfc822_message_id).eq('unlinked', false).limit(1); if (r.data?.[0]) return { ...r.data[0], link_source: 'thread' }; }
  if (d.gmail_thread_id) { const r = await sb.from('email_links').select('lead_id,link_source,unlinked').eq('mailbox', mb).eq('gmail_thread_id', d.gmail_thread_id).eq('unlinked', false).limit(1); if (r.data?.[0]) return { ...r.data[0], link_source: 'thread' }; }
  return null;
}
async function mailboxKey(sb: any, mailbox: string) {
  const r = await sb.from('mailbox_sync_state').select('secret_name').eq('mailbox', mailbox).maybeSingle();
  const k = r.data?.secret_name; return k && MAILBOX_KEY_RE.test(k) && Deno.env.get(k) ? k : null;
}
/** Links one message and, when the mailbox connection exists, every message of its thread. */
async function linkThread(sb: any, d: EmailIn, leadId: string, source: string, actor: Actor) {
  const row = { ...emailRow(d), lead_id: leadId, link_source: source, linked_by: actor.label, unlinked: false };
  const u = await sb.from('email_links').upsert(row, { onConflict: 'mailbox,gmail_message_id' }); if (u.error) throw u.error;
  if (source === 'manual' && d.gmail_thread_id) {
    await sb.from('email_links').update({ lead_id: leadId, unlinked: false, link_source: 'manual', linked_by: actor.label }).eq('mailbox', row.mailbox).eq('gmail_thread_id', d.gmail_thread_id);
    const key = await mailboxKey(sb, row.mailbox);
    if (key) {
      const t = await gmailGet(key, `/threads/${d.gmail_thread_id}?format=minimal`);
      const ids = (t.body?.messages || []).map((m: any) => m.id).filter((id: string) => id !== d.gmail_message_id);
      if (ids.length) {
        const res = await gmailBatch(key, ids.map((id: string) => `/messages/${id}${META_QS}`));
        const rows = res.filter((x) => x.status === 200).map((x) => { const { refs_header: _r, ...m } = toMeta(row.mailbox, x.body); return { ...m, lead_id: leadId, link_source: 'thread', linked_by: actor.label }; });
        if (rows.length) await sb.from('email_links').upsert(rows, { onConflict: 'mailbox,gmail_message_id', ignoreDuplicates: true });
      }
    }
  }
  await audit(sb, actor, leadId, 'email_linked', { mailbox: row.mailbox, subject: row.subject, source });
}
async function audit(sb: any, actor: Actor, leadId: string, action: string, details: Record<string, unknown>) {
  await sb.from('activity_logs').insert({ action_type: action, entity_type: 'lead', entity_id: leadId, user_id: actor.userId, details: { actor: actor.label, actor_email: actor.email, ...details } });
}

// ---------- actions ----------
async function emailContext(sb: any, d: EmailIn, actor: Actor) {
  const ex = await existingLink(sb, d);
  if (ex && !ex.unlinked) {
    if (ex.link_source === 'thread') await linkThread(sb, d, ex.lead_id, 'thread', actor).catch(() => null);
    return { ok: true, linked: await leadCard(sb, ex.lead_id, ex.link_source), candidates: [], supplier: await supplierOf(sb, d) };
  }
  const blocked = ex?.unlinked ? ex.lead_id : null;
  const leads = await loadLeadIndex(sb);
  const refs = matchByRefs(leads, extractRefs(`${d.subject} ${d.body_excerpt}`)).filter((l) => l.id !== blocked);
  const supplier = await supplierOf(sb, d);
  if (refs.length === 1 && !blocked) { await linkThread(sb, d, refs[0].id, 'auto_ref', actor); return { ok: true, linked: await leadCard(sb, refs[0].id, 'auto_ref'), candidates: [], supplier }; }
  let cand = refs.map((l) => l.id);
  if (!supplier) {
    const row = emailRow(d);
    const ext = [row.from_email, ...row.to_emails].filter((e) => e && !isInternalEmail(e));
    cand.push(...ext.flatMap((e) => matchByEmail(leads, e).map((l) => l.id)));
    if (!cand.length) {
      const dom = ext.map((e) => e.split('@')[1]).find((x) => x && !/^(gmail|hotmail|outlook|yahoo|icloud|live|me|aol|msn)\./i.test(x));
      if (dom) cand.push(...leads.filter((l) => l.email?.toLowerCase().endsWith('@' + dom)).map((l) => l.id));
    }
  }
  cand = cand.filter((x) => x !== blocked);
  return { ok: true, linked: null, candidates: await cards(sb, cand), supplier };
}
async function supplierOf(sb: any, d: EmailIn) {
  const e = parseAddress(d.from).email; if (!e) return null;
  const r = await sb.from('suppliers').select('id,name').ilike('contact_email', `%${e}%`).limit(1);
  return r.data?.[0] ?? null;
}
const normEvent = (id: string) => id.replace(/_\d{8}(T\d{6}Z?)?$/, '');

async function handle(sb: any, action: string, data: any, actor: Actor) {
  switch (action) {
    case 'stages': return { ok: true, stages: STAGES.map(([key, label, side]) => ({ key, label, side })) };
    case 'email_context': return emailContext(sb, EmailData.parse(data), actor);
    case 'search': {
      const q = z.object({ q: z.string().trim().min(2) }).parse(data).q.replace(/[%,()]/g, ' ');
      const digits = q.replace(/\D/g, '');
      const filters = [`client_name.ilike.%${q}%`, `email.ilike.%${q}%`, `yt_id.ilike.%${q}%`];
      if (/^YT\s*-?\s*\d+$/i.test(q) && digits) filters.push(`yt_id.ilike.%${digits}%`);
      const r = await sb.from('leads').select('id').or(filters.join(',')).order('updated_at', { ascending: false }).limit(10);
      if (r.error) throw r.error;
      return { ok: true, results: await cards(sb, (r.data || []).map((x: any) => x.id)) };
    }
    case 'link_email': {
      const d = EmailData.extend({ lead_id: z.string().uuid() }).parse(data);
      await linkThread(sb, d, d.lead_id, 'manual', actor);
      return { ok: true, linked: await leadCard(sb, d.lead_id, 'manual') };
    }
    case 'unlink_email': {
      const d = z.object({ mailbox: z.string().email(), gmail_thread_id: z.string().optional().nullable(), rfc822_message_id: z.string().optional().nullable(), lead_id: z.string().uuid() }).parse(data);
      const mb = d.mailbox.toLowerCase();
      if (d.gmail_thread_id) await sb.from('email_links').update({ unlinked: true, linked_by: actor.label }).eq('lead_id', d.lead_id).eq('mailbox', mb).eq('gmail_thread_id', d.gmail_thread_id);
      if (d.rfc822_message_id) await sb.from('email_links').update({ unlinked: true, linked_by: actor.label }).eq('lead_id', d.lead_id).eq('rfc822_message_id', d.rfc822_message_id);
      await audit(sb, actor, d.lead_id, 'email_unlinked', { mailbox: mb, thread: d.gmail_thread_id });
      return { ok: true, linked: null };
    }
    case 'event_context': {
      const d = z.object({ calendar_id: z.string().min(1), event_id: z.string().min(1) }).parse(data);
      const eid = normEvent(d.event_id);
      const own = await sb.from('calendar_events').select('lead_id').in('google_event_id', [eid, d.event_id]).limit(1);
      let ev: any = null;
      const key = Deno.env.get('GOOGLE_CALENDAR_API_KEY'), api = Deno.env.get('LOVABLE_API_KEY');
      if (key && api) {
        const r = await fetch(`https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/${encodeURIComponent(d.calendar_id)}/events/${encodeURIComponent(d.event_id)}`, { headers: { Authorization: `Bearer ${api}`, 'X-Connection-Api-Key': key } });
        if (r.ok) ev = await r.json(); else await r.text();
      }
      const event = ev ? { title: ev.summary || '', start: ev.start?.dateTime || ev.start?.date || null, end: ev.end?.dateTime || ev.end?.date || null } : null;
      if (own.data?.[0]) return { ok: true, linked: await leadCard(sb, own.data[0].lead_id, 'tcc_event'), candidates: [], event };
      const link = await sb.from('calendar_event_links').select('lead_id,unlinked,link_source').eq('calendar_id', d.calendar_id).in('event_id', [eid, d.event_id]).limit(1);
      if (link.data?.[0] && !link.data[0].unlinked) return { ok: true, linked: await leadCard(sb, link.data[0].lead_id, link.data[0].link_source), candidates: [], event };
      const refs = ev ? matchByRefs(await loadLeadIndex(sb), extractRefs(`${ev.summary || ''} ${ev.description || ''}`)).filter((l) => l.id !== link.data?.[0]?.lead_id) : [];
      return { ok: true, linked: null, candidates: await cards(sb, refs.map((l) => l.id)), event };
    }
    case 'link_event': case 'unlink_event': {
      const d = z.object({ calendar_id: z.string().min(1), event_id: z.string().min(1), lead_id: z.string().uuid() }).parse(data);
      const eid = normEvent(d.event_id);
      if (action === 'unlink_event') {
        await sb.from('calendar_event_links').update({ unlinked: true }).eq('calendar_id', d.calendar_id).eq('event_id', eid).eq('lead_id', d.lead_id);
        await audit(sb, actor, d.lead_id, 'event_unlinked', { event_id: eid });
        return { ok: true, linked: null };
      }
      let title = null, start = null, html = null;
      const key = Deno.env.get('GOOGLE_CALENDAR_API_KEY'), api = Deno.env.get('LOVABLE_API_KEY');
      if (key && api) { const r = await fetch(`https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/${encodeURIComponent(d.calendar_id)}/events/${encodeURIComponent(d.event_id)}`, { headers: { Authorization: `Bearer ${api}`, 'X-Connection-Api-Key': key } }); if (r.ok) { const e = await r.json(); title = e.summary || null; start = e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00Z` : null); html = e.htmlLink || null; } else await r.text(); }
      const u = await sb.from('calendar_event_links').upsert({ calendar_id: d.calendar_id, event_id: eid, lead_id: d.lead_id, title, start_at: start, html_link: html, link_source: 'manual', unlinked: false }, { onConflict: 'calendar_id,event_id' });
      if (u.error) throw u.error;
      await audit(sb, actor, d.lead_id, 'event_linked', { event_id: eid, title });
      return { ok: true, linked: await leadCard(sb, d.lead_id, 'manual') };
    }
    case 'create_file': {
      const d = EmailData.parse(data);
      if (d.rfc822_message_id) {
        const prev = await sb.from('email_links').select('lead_id').eq('rfc822_message_id', d.rfc822_message_id).eq('link_source', 'manual').eq('linked_by', `create_file:${actor.label}`).limit(1);
        const prev2 = prev.data?.[0] ? prev : await sb.from('email_links').select('lead_id,linked_by').eq('rfc822_message_id', d.rfc822_message_id).like('linked_by', 'create_file:%').limit(1);
        if (prev2.data?.[0]) return { ok: true, linked: await leadCard(sb, prev2.data[0].lead_id, 'manual') };
      }
      const row = emailRow(d);
      let e: any = {};
      try { e = await extractWithFailover(`From: ${d.from}\nTo: ${d.to}\nSubject: ${d.subject}\nDate: ${d.date || ''}\n\n${d.body_excerpt}`); } catch (err) { console.warn('extract failed', err); }
      const yt = await sb.rpc('next_yt_id'); if (yt.error) throw yt.error;
      const name = e.clientName || row.from_name || row.from_email || 'Cliente';
      const isB2B = /agency|agência|agencia|travel|tours|dmc|b2b/i.test(`${row.from_email.split('@')[1] || ''} ${d.body_excerpt}`) && !/gmail|hotmail|outlook|yahoo|icloud/i.test(row.from_email);
      const ins = await sb.from('leads').insert({
        yt_id: yt.data, client_name: `${yt.data} - ${name}`, email: e.email || (row.direction === 'in' ? row.from_email : row.to_emails.find((x: string) => !isInternalEmail(x))) || '',
        phone: e.phone || '', destination: e.destination || 'A definir', travel_dates: e.travelStartDate || e.travelDates || 'A definir', travel_end_date: e.travelEndDate || '',
        number_of_days: e.numberOfDays || 0, dates_type: e.datesType || 'estimated', pax: e.pax || 2, language: e.language || null,
        status: 'new', nethunt_stage: 'SALES - New Lead', source: 'direct', client_type: isB2B ? 'B2B' : 'B2C', budget_level: e.budget || '€€',
        notes: [e.request, e.preferences].filter(Boolean).join('\n'), travel_style: Array.isArray(e.travelStyle) ? e.travelStyle : [], comfort_level: e.comfortLevel || '',
        created_via: 'crm_addon', created_by: actor.userId,
      }).select('id').single();
      if (ins.error) throw ins.error;
      const id = ins.data.id;
      await sb.from('email_links').upsert({ ...row, lead_id: id, link_source: 'manual', linked_by: `create_file:${actor.label}`, unlinked: false }, { onConflict: 'mailbox,gmail_message_id' });
      await linkThread(sb, d, id, 'manual', actor).catch((err) => console.warn('thread link', err));
      await sb.from('email_links').update({ linked_by: `create_file:${actor.label}` }).eq('mailbox', row.mailbox).eq('gmail_message_id', d.gmail_message_id);
      await sb.rpc('enqueue_sync', { p_target: 'nethunt', p_entity: 'lead_create_deal', p_entity_id: id, p_fields: [], p_reason: 'crm_addon' });
      await audit(sb, actor, id, 'lead_created', { via: 'crm_addon', yt_id: yt.data });
      return { ok: true, linked: await leadCard(sb, id, 'manual') };
    }
    case 'set_stage': {
      const d = z.object({ lead_id: z.string().uuid(), stage_key: z.string().min(3) }).parse(data);
      const target = STAGES.find((s) => s[0] === d.stage_key || s[1] === d.stage_key);
      if (!target) return { ok: false, error: 'Etapa desconhecida' };
      const cur = await sb.from('leads').select('nethunt_stage,status').eq('id', d.lead_id).maybeSingle();
      if (!cur.data) return { ok: false, error: 'File não encontrada' };
      const curSide = stageOf(cur.data.nethunt_stage, cur.data.status)?.[2];
      if (curSide === 'ops' && target[2] === 'sales') return { ok: false, error: 'Não é possível voltar de OPS para SALES pelo add-on' };
      if (cur.data.nethunt_stage !== target[0] || cur.data.status !== target[3]) {
        const u = await sb.from('leads').update({ nethunt_stage: target[0], status: target[3] }).eq('id', d.lead_id); if (u.error) throw u.error;
        await audit(sb, actor, d.lead_id, 'lead_status_changed', { nethunt_stage: { from: cur.data.nethunt_stage, to: target[0] } });
      }
      return { ok: true, linked: await leadCard(sb, d.lead_id) };
    }
    case 'add_note': {
      const d = z.object({ lead_id: z.string().uuid(), text: z.string().trim().min(1).max(5000) }).parse(data);
      const lead = await sb.from('leads').select('nethunt_record_id').eq('id', d.lead_id).maybeSingle();
      const text = `${d.text}\n— ${actor.label}`;
      if (lead.data?.nethunt_record_id) {
        await createComment(lead.data.nethunt_record_id, text);
        const now = new Date().toISOString();
        await sb.from('nethunt_timeline').upsert({ lead_id: d.lead_id, nethunt_record_id: lead.data.nethunt_record_id, event_id: `local-comment:${d.lead_id}:${Date.now()}`, event_type: 'comment', event_time: now, creator_email: actor.email, creator_name: actor.label, snippet: text.slice(0, 300), body_html: text, payload: { local: true, text }, synced_at: now }, { onConflict: 'event_id' });
      } else {
        const r = await sb.from('item_notes').insert({ entity_type: 'lead', entity_id: d.lead_id, entity_key: d.lead_id, note_text: text, created_by: actor.userId }); if (r.error) throw r.error;
      }
      await audit(sb, actor, d.lead_id, 'note_added', {});
      return { ok: true, linked: await leadCard(sb, d.lead_id) };
    }
    case 'add_task': {
      const d = z.object({ lead_id: z.string().uuid(), title: z.string().trim().min(1).max(300), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable() }).parse(data);
      const r = await sb.from('tasks').insert({ lead_id: d.lead_id, title: d.title, due_date: d.due_date || null, status: 'todo', priority: 'medium', team: 'sales', category: 'general', creator_email: actor.email, created_by: actor.userId, description: actor.label }).select('id').single();
      if (r.error) throw r.error;
      await sb.rpc('enqueue_sync', { p_target: 'nethunt', p_entity: 'task', p_entity_id: r.data.id, p_fields: [], p_reason: 'crm_addon' });
      await audit(sb, actor, d.lead_id, 'task_created', { title: d.title });
      return { ok: true, linked: await leadCard(sb, d.lead_id) };
    }
    case 'timeline': {
      const d = z.object({ lead_id: z.string().uuid(), before: z.string().optional() }).parse(data);
      return { ok: true, items: await timeline(sb, d.lead_id, d.before) };
    }
    default: return { ok: false, error: `Ação desconhecida: ${action}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Método não permitido', 405);
  const sb = db();
  const actor = await authenticate(req, sb);
  if (actor instanceof Response) return actor;
  try {
    const body = z.object({ action: z.string().min(1), data: z.any().optional() }).parse(await req.json());
    return json(await handle(sb, body.action, body.data ?? {}, actor));
  } catch (e) {
    const msg = e instanceof z.ZodError ? `Dados inválidos: ${e.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}` : e instanceof Error ? e.message : String(e);
    console.error('crm-addon', msg);
    return fail(msg);
  }
});
