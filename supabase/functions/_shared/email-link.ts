// Applies the automatic email → file linking rules to Gmail message metadata.
import { extractRefs, matchByRefs, matchByEmail, parseAddress, parseAddressList, isInternalEmail, type MatchLead } from './lead-matcher.ts';
import { hdr } from './gmail.ts';

export type MsgMeta = { mailbox: string; gmail_message_id: string; gmail_thread_id: string | null; rfc822_message_id: string | null; direction: 'in' | 'out'; from_email: string; from_name: string; to_emails: string[]; subject: string; snippet: string; sent_at: string | null; refs_header: string[] };

export function toMeta(mailbox: string, m: any): MsgMeta {
  const from = parseAddress(hdr(m, 'From'));
  const out = (m.labelIds || []).includes('SENT') || from.email === mailbox.toLowerCase();
  const rid = (hdr(m, 'Message-ID') || '').trim() || null;
  const refsHeader = `${hdr(m, 'In-Reply-To')} ${hdr(m, 'References')}`.match(/<[^>]+>/g) || [];
  return {
    mailbox, gmail_message_id: m.id, gmail_thread_id: m.threadId || null, rfc822_message_id: rid, direction: out ? 'out' : 'in',
    from_email: from.email, from_name: from.name, to_emails: [...parseAddressList(hdr(m, 'To')), ...parseAddressList(hdr(m, 'Cc'))],
    subject: hdr(m, 'Subject'), snippet: (m.snippet || '').slice(0, 500),
    sent_at: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null, refs_header: refsHeader,
  };
}

/** Links what the rules allow; returns counts. Never relinks a message/thread a person unlinked. */
export async function linkMessages(db: any, leads: MatchLead[], supplierEmails: Set<string>, metas: MsgMeta[], linkedBy: string) {
  const res = { linked: 0, suggested: 0, skipped: 0 };
  if (!metas.length) return res;
  const mailbox = metas[0].mailbox;
  const ids = metas.map((m) => m.gmail_message_id);
  const threads = [...new Set(metas.map((m) => m.gmail_thread_id).filter(Boolean))] as string[];
  const rfcs = [...new Set(metas.flatMap((m) => [m.rfc822_message_id, ...m.refs_header]).filter(Boolean))] as string[];
  const existing = await db.from('email_links').select('gmail_message_id').eq('mailbox', mailbox).in('gmail_message_id', ids);
  if (existing.error) throw existing.error;
  const known = new Set((existing.data || []).map((x: any) => x.gmail_message_id));
  const thr = threads.length ? await db.from('email_links').select('lead_id,gmail_thread_id,unlinked').eq('mailbox', mailbox).in('gmail_thread_id', threads) : { data: [] };
  const rfc = rfcs.length ? await db.from('email_links').select('lead_id,rfc822_message_id,unlinked').in('rfc822_message_id', rfcs) : { data: [] };
  const unl = new Map<string, Set<string>>(); // thread -> leads unlinked by hand
  const threadLead = new Map<string, Set<string>>();
  for (const r of thr.data || []) {
    const map = r.unlinked ? unl : threadLead;
    if (!map.has(r.gmail_thread_id)) map.set(r.gmail_thread_id, new Set());
    map.get(r.gmail_thread_id)!.add(r.lead_id);
  }
  const rfcLead = new Map<string, Set<string>>(); const rfcUnl = new Map<string, Set<string>>();
  for (const r of rfc.data || []) { const map = r.unlinked ? rfcUnl : rfcLead; if (!map.has(r.rfc822_message_id)) map.set(r.rfc822_message_id, new Set()); map.get(r.rfc822_message_id)!.add(r.lead_id); }
  const rows: any[] = [], sugg: any[] = [];
  for (const m of metas) {
    if (known.has(m.gmail_message_id)) { res.skipped++; continue; }
    const blocked = new Set<string>([...(unl.get(m.gmail_thread_id || '') || []), ...(rfcUnl.get(m.rfc822_message_id || '') || [])]);
    const pick = (s: Set<string> | string[]) => [...s].filter((x) => !blocked.has(x));
    let leadIds: string[] = [], source = '';
    const t = pick(threadLead.get(m.gmail_thread_id || '') || new Set());
    const r = pick(new Set([m.rfc822_message_id, ...m.refs_header].flatMap((k) => [...(rfcLead.get(k || '') || [])])));
    if (t.length) { leadIds = t; source = 'thread'; }
    else if (r.length) { leadIds = r; source = 'thread'; }
    else {
      const refs = pick(matchByRefs(leads, extractRefs(`${m.subject} ${m.snippet}`)).map((l) => l.id));
      if (refs.length === 1) { leadIds = refs; source = 'auto_ref'; }
      else {
        const counter = m.direction === 'in' ? [m.from_email] : m.to_emails;
        const ext = counter.filter((e) => !isInternalEmail(e));
        const isSupplier = ext.some((e) => supplierEmails.has(e));
        if (!isSupplier) {
          const byEmail = [...new Set(ext.flatMap((e) => matchByEmail(leads, e, true).map((l) => l.id)))].filter((x) => !blocked.has(x));
          if (byEmail.length === 1 && refs.length === 0) { leadIds = byEmail; source = 'auto_email'; }
          else if (byEmail.length || refs.length > 1) sugg.push({ mailbox, gmail_message_id: m.gmail_message_id, gmail_thread_id: m.gmail_thread_id, rfc822_message_id: m.rfc822_message_id, from_email: m.from_email, subject: m.subject, snippet: m.snippet, sent_at: m.sent_at, candidate_lead_ids: [...new Set([...refs, ...byEmail])].slice(0, 10), reason: refs.length > 1 ? 'Várias refs YT' : 'Email do cliente em várias files' });
        } else if (refs.length > 1) sugg.push({ mailbox, gmail_message_id: m.gmail_message_id, gmail_thread_id: m.gmail_thread_id, rfc822_message_id: m.rfc822_message_id, from_email: m.from_email, subject: m.subject, snippet: m.snippet, sent_at: m.sent_at, candidate_lead_ids: refs.slice(0, 10), reason: 'Várias refs YT' });
      }
    }
    if (leadIds.length === 1) {
      const { refs_header: _r, ...base } = m;
      rows.push({ ...base, lead_id: leadIds[0], link_source: source === 'auto_email' ? 'auto_ref' : source, linked_by: linkedBy });
      if (m.gmail_thread_id) { if (!threadLead.has(m.gmail_thread_id)) threadLead.set(m.gmail_thread_id, new Set()); threadLead.get(m.gmail_thread_id)!.add(leadIds[0]); }
    } else if (leadIds.length > 1) sugg.push({ mailbox, gmail_message_id: m.gmail_message_id, gmail_thread_id: m.gmail_thread_id, rfc822_message_id: m.rfc822_message_id, from_email: m.from_email, subject: m.subject, snippet: m.snippet, sent_at: m.sent_at, candidate_lead_ids: leadIds.slice(0, 10), reason: 'Conversa ligada a várias files' });
  }
  if (rows.length) { const u = await db.from('email_links').upsert(rows, { onConflict: 'mailbox,gmail_message_id', ignoreDuplicates: true }); if (u.error) throw u.error; res.linked += rows.length; }
  if (sugg.length) { const u = await db.from('email_link_suggestions').upsert(sugg, { onConflict: 'mailbox,gmail_message_id', ignoreDuplicates: true }); if (u.error) throw u.error; res.suggested += sugg.length; }
  return res;
}

export async function loadSupplierEmails(db: any): Promise<Set<string>> {
  const r = await db.from('suppliers').select('contact_email').not('contact_email', 'is', null);
  if (r.error) throw r.error;
  return new Set((r.data || []).flatMap((x: any) => String(x.contact_email).split(/[,;\s]+/)).map((e: string) => e.trim().toLowerCase()).filter((e: string) => e.includes('@')));
}
