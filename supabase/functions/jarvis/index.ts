// JARVIS — servidor do ecrã Jarvis (/agents).
// GET  /jarvis/live   → pipeline NetHunt ao vivo (todas as files ativas) + fios de email, calendário,
//                       fornecedores por file, emails de FSE e Aprovações AI pendentes do TCC.
// POST /jarvis/outbox → executa o que a pessoa aprovou no ecrã (envio Gmail, mudança de fase no NetHunt,
//                       Aprovações AI). Nada corre sem o clique "Aprovar" de um utilizador interno.
// POST /jarvis/state  → progresso da checklist por file.
// As ações para aprovação são calculadas no ecrã (mesma regra do Jarvis no claude.ai).
import { corsHeadersAuth, requireInternalUser } from "../_shared/require-auth.ts";
import {
  DEALS_FOLDER, F, F_VALUE, canonicalStage, createComment, field, logSync, pageRecords, rawStage, recId, serviceClient,
  toIso, updateRecord, wkey, ytKey, type NHRecord,
} from "../_shared/nethunt.ts";

const headers = { ...corsHeadersAuth, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Content-Type": "application/json" };
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

// As 11 fases pela ordem do ecrã (forma canónica de _shared/nethunt.ts).
const SCREEN_STAGES = [
  "SALES - New Lead",
  "SALES - - Budgeting & Fine-Tuning",
  "SALES - Final Negotiation & Ready to Book",
  "SALES - Archive",
  "OPERATIONS - Deposit/Payment Received",
  "OPERATIONS - Suppliers Bookings & Confirmations",
  "OPERATIONS - Technical Briefing (Internal & Suppliers Final Validations)",
  "OPERATIONS - Trip Ready / In Execution",
  "OPERATIONS - Post-Trip Loop / Feedback",
  "OPERATIONS - Deferred / Postponed Trip",
  "OPERATIONS - Archive",
];
// Valores exatos no NetHunt (o ecrã usa-os para mostrar e, mais tarde, para escrever).
const RAW_STAGES = SCREEN_STAGES.map((s) => (s === "SALES - - Budgeting & Fine-Tuning" ? "SALES -  -  Budgeting & Fine-Tuning" : s));
const ARCHIVE = new Set([3, 10]);
const LAST_IN = ["Last Email Received", "41"], LAST_OUT = ["Last Email Sent", "43"], DAYS_ON_STAGE = ["Days on Stage", "61"];
const D = 86_400_000;

const ms = (v: unknown): number | null => {
  const t = toIso(v);
  return t ? Date.parse(t) : null;
};
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const refOf = (r: NHRecord): string => {
  const yt = ytKey(field(r, F.ytId));
  if (yt) return `YT${yt}`;
  const m = String(field(r, F.name) ?? "").match(/YT\s?(\d{4})/i);
  return m ? `YT${m[1]}` : `NH${recId(r).slice(-5).toUpperCase()}`;
};

// Cache curto por instância: o ecrã sincroniza de hora a hora e no arranque; evita varrer o NetHunt em cada clique.
let cache: { at: number; deals: NHRecord[] } | null = null;
async function allDeals(): Promise<NHRecord[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.deals;
  const since = "2020-01-01T00:00:00Z";
  const recs = [...(await pageRecords("new-record", DEALS_FOLDER, since)), ...(await pageRecords("updated-record", DEALS_FOLDER, since))];
  const uniq = new Map<string, NHRecord>();
  for (const r of recs) if (!r.deleted) uniq.set(recId(r), r);
  cache = { at: Date.now(), deals: [...uniq.values()] };
  return cache.deals;
}

async function live() {
  const sb = serviceClient();
  const now = Date.now();
  const deals = await allDeals();

  // Estado do Jarvis: ações já tratadas, checklist e mudanças de fase recentes (o NetHunt pode demorar a refletir).
  const { data: js } = await sb.from("jarvis_state").select("key, kind, ref, data, updated_at")
    .gte("updated_at", new Date(now - 90 * D).toISOString()).limit(5000);
  const done: Record<string, unknown> = {};
  const checklist: Record<string, unknown> = {};
  const moved = new Map<string, string>();
  for (const x of (js ?? []) as { key: string; kind: string; ref: string | null; data: Record<string, any>; updated_at: string }[]) {
    if (x.kind === "done") done[x.key.slice(5)] = x.data;
    else if (x.kind === "check" && x.ref) checklist[x.ref] = x.data;
    else if (x.kind === "stage" && now - Date.parse(x.updated_at) < 15 * 60_000) moved.set(x.key.slice(6), String(x.data.stage ?? ""));
  }

  // Leads do TCC ligadas a cada deal (para timeline, calendário, operações e o link "Abrir no TCC").
  const { data: leadRows } = await sb.from("leads").select("id, yt_id, nethunt_record_id, email");
  const leadByRid = new Map<string, { id: string; email: string | null }>();
  const leadByYt = new Map<string, { id: string; email: string | null }>();
  for (const l of (leadRows ?? []) as { id: string; yt_id: string | null; nethunt_record_id: string | null; email: string | null }[]) {
    if (l.nethunt_record_id) leadByRid.set(l.nethunt_record_id, l);
    const k = ytKey(l.yt_id);
    if (k) leadByYt.set(k, l);
  }

  const rows: unknown[][] = [];
  const leadIds: Record<string, string> = {};
  const refByLead = new Map<string, string>();
  const seen = new Set<string>();
  for (const r of deals) {
    const stage = canonicalStage(moved.get(recId(r)) || (field(r, F.stage) as string | null));
    const st = SCREEN_STAGES.indexOf(stage ?? "");
    if (st < 0 || ARCHIVE.has(st)) continue;
    const ref = refOf(r);
    if (seen.has(ref)) continue;
    seen.add(ref);
    const rid = recId(r);
    const lead = leadByRid.get(rid) ?? leadByYt.get(ytKey(ref) ?? "");
    if (lead) { leadIds[ref] = lead.id; refByLead.set(lead.id, ref); }
    rows.push([
      rid, ref, String(field(r, F.name) ?? ref), st,
      ms(field(r, F.tripStart)), ms(field(r, F.tripFinish)), num(field(r, F_VALUE)),
      ms(field(r, LAST_IN)), ms(field(r, LAST_OUT)), num(field(r, DAYS_ON_STAGE)),
    ]);
  }
  const ids = [...refByLead.keys()];

  // Último email por file (timeline NetHunt guardada no TCC) + último recebido/enviado quando o NetHunt não os trouxe.
  const emails: Record<string, string> = {};
  const threads: Record<string, unknown> = {};
  const lastIO: Record<string, { in?: number; out?: number }> = {};
  if (ids.length) {
    const { data: ev } = await sb.from("nethunt_timeline")
      .select("lead_id, event_time, creator_email, subject, snippet, payload")
      .eq("event_type", "email").in("lead_id", ids)
      .gte("event_time", new Date(now - 180 * D).toISOString())
      .order("event_time", { ascending: false }).limit(3000);
    for (const e of (ev ?? []) as { lead_id: string; event_time: string; creator_email: string | null; subject: string | null; snippet: string | null; payload: Record<string, unknown> | null }[]) {
      const ref = refByLead.get(e.lead_id);
      if (!ref) continue;
      const p = e.payload ?? {};
      const t = Date.parse(e.event_time);
      const io = (lastIO[ref] ??= {});
      if (p.direction === "IN") io.in = Math.max(io.in ?? 0, t);
      if (p.direction === "OUT") io.out = Math.max(io.out ?? 0, t);
      if (!threads[ref]) {
        const d = new Date(t);
        threads[ref] = {
          id: p.thread_id ?? null,
          url: p.url ?? "",
          subject: String(e.subject ?? "").replace(/^[↓↑]\s*/, ""),
          note: String(e.snippet ?? "").replace(/^[↓↑]\s*/, "").slice(0, 160),
          from: e.creator_email ?? "",
          last: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
          lastMsgId: p.gmail_id ?? null,
        };
      }
      if (!emails[ref] && e.creator_email && !/@yourtours\.pt$/i.test(e.creator_email)) emails[ref] = e.creator_email;
    }
  }
  for (const r of rows) {
    const ref = r[1] as string;
    const io = lastIO[ref];
    if (io) { if (r[7] == null && io.in) r[7] = io.in; if (r[8] == null && io.out) r[8] = io.out; }
    const lead = leadIds[ref] ? (leadRows ?? []).find((l: any) => l.id === leadIds[ref]) as { email?: string | null } | undefined : undefined;
    if (!emails[ref] && lead?.email) emails[ref] = lead.email;
  }

  // Calendário (dias geridos pelo TCC).
  const calendar: Record<string, unknown[]> = {};
  if (ids.length) {
    const { data: cal } = await sb.from("calendar_events").select("lead_id, day_date, status, google_event_id")
      .in("lead_id", ids).gte("day_date", new Date(now - D).toISOString().slice(0, 10))
      .lte("day_date", new Date(now + 45 * D).toISOString().slice(0, 10)).order("day_date");
    for (const c of (cal ?? []) as { lead_id: string; day_date: string; status: string | null }[]) {
      const ref = refByLead.get(c.lead_id);
      if (!ref) continue;
      (calendar[ref] ??= []).push({ summary: `${c.day_date} · ${c.status ?? ""}`.trim(), date: c.day_date, url: `https://calendar.google.com/calendar/r/search?q=${ref}` });
    }
  }

  // Fornecedores por file (Operações guardadas) para partidas nos próximos 21 dias.
  const ops: Record<string, unknown[]> = {};
  const soonIds = rows.filter((r) => (r[3] as number) >= 4 && (r[3] as number) <= 6 && r[4] && (r[4] as number) > now - D && (r[4] as number) - now < 21 * D)
    .map((r) => leadIds[r[1] as string]).filter(Boolean);
  if (soonIds.length) {
    const { data: op } = await sb.from("lead_operations").select("lead_id, day_number, schedule_time, activity_title, supplier, pax, booking_status")
      .in("lead_id", soonIds).order("day_number");
    for (const o of (op ?? []) as { lead_id: string; day_number: number | null; schedule_time: string | null; activity_title: string | null; supplier: string | null; pax: number | null; booking_status: string | null }[]) {
      const ref = refByLead.get(o.lead_id);
      if (!ref) continue;
      (ops[ref] ??= []).push({ day_number: o.day_number, schedule_time: o.schedule_time ? o.schedule_time.slice(0, 5) : null, service: o.activity_title ?? "", supplier: o.supplier, pax: o.pax, booking_status: o.booking_status });
    }
  }

  // Emails de FSE: só os que estão na base de fornecedores (sem suposições).
  const fse: Record<string, string> = {};
  const { data: sup } = await sb.from("suppliers").select("name, contact_email").not("contact_email", "is", null);
  for (const s of (sup ?? []) as { name: string; contact_email: string | null }[]) {
    const e = (s.contact_email ?? "").trim();
    if (s.name && e) fse[s.name] = e;
  }

  // Aprovações AI pendentes do TCC entram no Centro de Ações.
  const queue: unknown[] = [];
  const { data: q } = await sb.from("ai_action_queue").select("id, type, lead_id, lead_code, title, subtitle, payload").eq("status", "pending").limit(50);
  for (const a of (q ?? []) as { id: string; type: string; lead_id: string | null; lead_code: string | null; title: string | null; subtitle: string | null; payload: Record<string, any> | null }[]) {
    const ref = (a.lead_id && refByLead.get(a.lead_id)) || null;
    if (!ref) continue;
    const p = a.payload ?? {};
    if (a.type === "payment_link") {
      queue.push({
        ref, sev: "MÉDIA", dl: "APROVAÇÕES AI", title: a.title ?? "Link de pagamento", rec: "Link de pagamento WeTravel", to: "WeTravel",
        draft: `Criar link de pagamento WeTravel\n\nMontante: ${Number(p.amount_eur ?? 0).toFixed(2)} €\nTipo: ${p.kind ?? ""}\nDescrição: ${p.description ?? a.title ?? ""}`
          + (p.requires_ceo_approval ? "\n\nAcima de 8.000,00 € — requer aprovação do CEO." : ""),
        key: `queue|${a.id}`, queueType: a.type,
      });
      continue;
    }
    queue.push({
      ref, sev: "MÉDIA", dl: "APROVAÇÕES AI", title: a.title ?? a.type,
      rec: p.to_name ?? p.recipient_name ?? p.supplier ?? "",
      to: p.to ?? p.recipient ?? p.email ?? "",
      draft: htmlText(String(p.html ?? p.body_text ?? p.text ?? p.body ?? a.subtitle ?? "")),
      subject: p.subject ?? null, cc: (p.cc ?? []).join?.(", ") ?? "",
      key: `queue|${a.id}`, queueType: a.type,
    });
  }

  return {
    meta: {
      syncedAt: new Date(now).toISOString(), folderId: DEALS_FOLDER, stageField: "2", stages: RAW_STAGES,
      nethuntRecordUrl: "", // o ecrã gera o link nethunt.com/web/#nethunt/… (mesmo formato do TCC)
      gmailSearchUrl: "https://mail.google.com/mail/?authuser=reservas@yourtours.pt#search/{ref}",
      calendarSearchUrl: "https://calendar.google.com/calendar/r/search?q={ref}",
      tccUrl: "/leads?q={ref}",
    },
    deals: rows, emails, threads, calendar, ops, fse, queue, leadIds, done, checklist,
  };
}

const htmlText = (h: string) => h
  .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
  .replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();

// ── Gmail (conta ligada reservas@yourtours.pt, via gateway de conectores) ──────────────────────────
const GMAIL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me";
function gmailHeaders() {
  const lov = Deno.env.get("LOVABLE_API_KEY"), gm = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!lov) throw new Error("LOVABLE_API_KEY não configurada");
  if (!gm) throw new Error("Gmail não ligado (GOOGLE_MAIL_API_KEY)");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": gm, "Content-Type": "application/json" };
}
async function gmail<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(GMAIL + path, { method: body ? "POST" : "GET", headers: gmailHeaders(), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Gmail ${r.status}: ${t.slice(0, 200)}`), { status: r.status });
  return (t ? JSON.parse(t) : {}) as T;
}
type Att = { filename: string; mimeType: string; contentBase64: string };
const encH = (v: string) => (/[^\x20-\x7E]/.test(v) ? `=?UTF-8?B?${b64(new TextEncoder().encode(v))}?=` : v);
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const OUR = /^[^@\s]+@yourtours\.pt$/i;
const FROM_NAME: Record<string, string> = { "reservas@yourtours.pt": "Your Tours Portugal - Reservas", "operations@yourtours.pt": "Your Tours Portugal - Operations" };

function mime(o: { from: string; to: string; cc?: string; subject: string; html: string; inReplyTo?: string; references?: string; atts: Att[] }) {
  const mb = `mix_${crypto.randomUUID()}`, ab = `alt_${crypto.randomUUID()}`;
  const L: string[] = [
    `From: ${encH(FROM_NAME[o.from.toLowerCase()] ?? "Your Tours Portugal")} <${o.from}>`, `To: ${o.to}`,
    ...(o.cc ? [`Cc: ${o.cc}`] : []), `Subject: ${encH(o.subject)}`,
    ...(o.inReplyTo ? [`In-Reply-To: ${o.inReplyTo}`, `References: ${[o.references, o.inReplyTo].filter(Boolean).join(" ")}`] : []),
    "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${mb}"`, "", `--${mb}`,
    `Content-Type: multipart/alternative; boundary="${ab}"`, "",
    `--${ab}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap76(b64(new TextEncoder().encode(htmlText(o.html)))),
    `--${ab}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap76(b64(new TextEncoder().encode(o.html))),
    `--${ab}--`, "",
  ];
  for (const a of o.atts) {
    L.push(`--${mb}`, `Content-Type: ${a.mimeType}; name="${a.filename}"`, "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${a.filename}"`, "", wrap76(a.contentBase64));
  }
  L.push(`--${mb}--`, "");
  return b64(new TextEncoder().encode(L.join("\r\n"))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Envia um email. Resposta: mantém o fio (threadId + In-Reply-To). Reencaminhar: original segue em anexo (.eml). */
async function sendMail(it: Item, atts: Att[] = []) {
  const from = OUR.test(it.from ?? "") ? String(it.from) : "reservas@yourtours.pt";
  let inReplyTo: string | undefined, references: string | undefined, threadId: string | undefined;
  const replyId = it.replyMessageId ?? null;
  if (it.forwardMessageId) {
    try {
      const raw = await gmail<{ raw: string }>(`/messages/${encodeURIComponent(it.forwardMessageId)}?format=raw`);
      atts = [...atts, { filename: "mensagem-original.eml", mimeType: "message/rfc822", contentBase64: raw.raw.replace(/-/g, "+").replace(/_/g, "/") }];
    } catch (e) { console.warn("jarvis: original não encontrado para reencaminhar", (e as Error).message); }
  } else if (replyId || it.replyThreadId) {
    try {
      const m = replyId
        ? await gmail<any>(`/messages/${encodeURIComponent(replyId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`)
        : ((await gmail<any>(`/threads/${encodeURIComponent(String(it.replyThreadId))}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`)).messages ?? []).at(-1);
      const h = (n: string) => (m?.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === n.toLowerCase())?.value;
      inReplyTo = h("Message-ID"); references = h("References"); threadId = m?.threadId;
    } catch (e) { console.warn("jarvis: fio não encontrado no Gmail de reservas@ — envia como email novo", (e as Error).message); }
  }
  const raw = mime({ from, to: String(it.to), cc: it.cc || undefined, subject: String(it.subject ?? ""), html: String(it.html ?? ""), inReplyTo, references, atts });
  return await gmail<{ id: string; threadId: string }>("/messages/send", threadId ? { raw, threadId } : { raw });
}

// ── Outbox ────────────────────────────────────────────────────────────────────────────────────────
type Item = {
  id?: string; at: string; type: string; key?: string | null; ref?: string; recordId?: string | null;
  from?: string; to?: string; cc?: string; subject?: string; html?: string; why?: string;
  replyThreadId?: string | null; replyMessageId?: string | null; forwardMessageId?: string | null;
  checklistItem?: string; queueKeepHtml?: boolean;
};
const EMAIL_RE = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;
const emails = (s?: string) => String(s ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const okEmails = (s?: string) => { const l = emails(s); return l.length > 0 && l.every((e) => EMAIL_RE.test(e)); };
const recent = new Map<string, number>(); // proteção contra duplo clique / reenvio (por instância)

async function setState(sb: ReturnType<typeof serviceClient>, key: string, kind: string, ref: string | null, data: unknown, userId: string) {
  const { error } = await sb.from("jarvis_state").upsert({ key, kind, ref, data, updated_by: userId, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
  if (error) console.warn("jarvis_state:", error.message);
}
async function nhComment(recordId: string | null | undefined, text: string) {
  if (!recordId) return;
  try { await createComment(recordId, text); } catch (e) { console.warn("jarvis: comentário NetHunt falhou", (e as Error).message); }
}

async function runQueue(sb: ReturnType<typeof serviceClient>, qid: string, it: Item, userId: string, req: Request) {
  const { data: q, error } = await sb.from("ai_action_queue").select("*").eq("id", qid).maybeSingle();
  if (error || !q) throw new Error("Aprovação AI não encontrada");
  const row = q as { id: string; type: string; status: string; lead_id: string | null; title: string | null; payload: Record<string, any> };
  if (!["pending", "approved", "failed"].includes(row.status)) return { skipped: row.status };
  const p = { ...(row.payload ?? {}) };
  if (row.type !== "payment_link") {
    // O que a pessoa viu e aprovou no ecrã: destinatário, assunto e (se editado) o corpo.
    p.to = it.to; p.subject = it.subject || p.subject; p.cc = emails(it.cc);
    if (!it.queueKeepHtml) p.html = it.html;
  }
  await sb.from("ai_action_queue").update({ status: "approved", payload: p, reviewed_by: userId, reviewed_at: new Date().toISOString() } as never).eq("id", qid);
  try {
    let result: unknown;
    if (row.type === "payment_link") {
      const { data: lead } = await sb.from("leads").select("travel_dates, travel_end_date").eq("id", row.lead_id!).maybeSingle();
      const l = (lead ?? {}) as { travel_dates?: string; travel_end_date?: string };
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wetravel-create-payment-link`, {
        method: "POST",
        headers: { Authorization: req.headers.get("Authorization")!, apikey: req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", lead_id: row.lead_id, proposal_id: p.proposal_id ?? null, title: p.description || row.title,
          trip_ref: p.trip_ref ?? it.ref, start_date: p.start_date || l.travel_dates, end_date: p.end_date || l.travel_end_date || p.start_date,
          amount_cents: Math.round(Number(p.amount_eur) * 100), currency: "EUR", deposit_cents: p.deposit_cents ?? null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d?.error) throw new Error(String(d?.error ?? `WeTravel ${r.status}`));
      result = { payment_link: d?.payment_link ?? null };
    } else {
      if (!okEmails(p.to)) throw new Error("Sem destinatário válido");
      const atts: Att[] = [];
      for (const a of p.attachments ?? []) {
        if (!a?.path) continue;
        const { data: blob, error: e } = await sb.storage.from("travel-plan-pdfs").download(a.path);
        if (e || !blob) throw new Error(`Anexo ${a.filename}: ${e?.message}`);
        atts.push({ filename: a.filename, mimeType: "application/pdf", contentBase64: b64(new Uint8Array(await blob.arrayBuffer())) });
      }
      const g = await sendMail({ ...it, to: p.to, subject: p.subject, html: p.html, cc: (p.cc ?? []).join(", ") }, atts);
      result = { sent: true, message_id: g.id, via: "Jarvis" };
      if (row.lead_id) {
        const { data: l } = await sb.from("leads").select("nethunt_record_id").eq("id", row.lead_id).maybeSingle();
        await nhComment((l as any)?.nethunt_record_id, `📧 Email enviado (Jarvis · Aprovações AI) para ${p.to}: ${p.subject}`);
      }
    }
    await sb.from("ai_action_queue").update({ status: "executed", result, error: null } as never).eq("id", qid);
    return result;
  } catch (e) {
    await sb.from("ai_action_queue").update({ status: "failed", error: (e as Error).message } as never).eq("id", qid);
    throw e;
  }
}

async function outbox(items: Item[], userId: string, req: Request) {
  const sb = serviceClient();
  const done: string[] = [], errors: { id: string; error: string }[] = [];
  const failedRefs = new Set<string>();
  for (const it of items.slice(0, 25)) {
    const id = it.id ?? it.at;
    const dedupe = `${userId}|${id}|${it.type}`;
    if (recent.has(dedupe)) { done.push(id); continue; }
    try {
      const qid = it.key?.startsWith("queue|") ? it.key.slice(6) : null;
      if (it.type === "action.rejected") {
        if (qid) await sb.from("ai_action_queue").update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() } as never).eq("id", qid).in("status", ["pending", "failed"]);
        if (it.key) await setState(sb, `done|${it.key}`, "done", it.ref ?? null, { type: "action.rejected", at: it.at }, userId);
      } else if (it.type === "nethunt.stage") {
        // Só depois de o email da mesma file ter seguido (se falhou nesta remessa, a fase não muda).
        if (it.ref && failedRefs.has(it.ref)) throw new Error("Fase não alterada: o email desta file falhou");
        const stage = canonicalStage(String(it.to ?? ""));
        if (!it.recordId || !stage || !RAW_STAGES.includes(rawStage(stage))) throw new Error("Fase ou registo NetHunt inválido");
        await updateRecord(it.recordId, [{ field: wkey(F.stage), value: rawStage(stage) }]);
        await setState(sb, `stage|${it.recordId}`, "stage", it.ref ?? null, { stage: rawStage(stage), from: it.from ?? null, why: it.why ?? null }, userId);
        await logSync(sb, [{ direction: "push", entity: "lead", nethunt_record_id: it.recordId, action: "update", detail: { fields: ["stage"], to: stage, via: "jarvis", by: userId } }]);
        if (cache) { const r = cache.deals.find((d) => recId(d) === it.recordId); if (r?.fields) r.fields[wkey(F.stage)] = rawStage(stage); }
      } else if (/^gmail\.(send|reply|forward)$/.test(it.type)) {
        if (qid) {
          const r = await runQueue(sb, qid, it, userId, req);
          await setState(sb, `done|${it.key}`, "done", it.ref ?? null, { type: "queue.executed", at: it.at, result: r }, userId);
        } else {
          if (!okEmails(it.to)) throw new Error("Sem destinatário válido");
          if (it.cc && !okEmails(it.cc)) throw new Error("Cc inválido");
          if (!it.subject || !it.html) throw new Error("Falta assunto ou corpo");
          const g = await sendMail(it);
          const url = `https://mail.google.com/mail/?authuser=reservas@yourtours.pt#all/${g.threadId}`;
          if (it.key) await setState(sb, `done|${it.key}`, "done", it.ref ?? null, { type: "gmail.sent", at: it.at, id: g.id, threadId: g.threadId, url }, userId);
          await nhComment(it.recordId, `📧 Jarvis · email enviado para ${it.to}: ${it.subject}${it.checklistItem ? ` (checklist: ${it.checklistItem})` : ""}`);
        }
      } else throw new Error(`Tipo desconhecido: ${it.type}`);
      recent.set(dedupe, Date.now());
      done.push(id);
    } catch (e) {
      if (it.ref) failedRefs.add(it.ref);
      errors.push({ id, error: (e as Error).message });
    }
  }
  for (const [k, t] of recent) if (Date.now() - t > 3_600_000) recent.delete(k);
  return { done, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;
  const path = new URL(req.url).pathname.replace(/^.*\/jarvis/, "") || "/";
  try {
    if (req.method === "GET" && (path === "/live" || path === "/")) return out(await live());
    if (req.method === "POST" && path === "/outbox") {
      const { items } = await req.json().catch(() => ({ items: null }));
      if (!Array.isArray(items)) return out({ error: "items em falta" }, 400);
      return out(await outbox(items as Item[], auth.userId, req));
    }
    if (req.method === "POST" && path === "/state") {
      const { ref, stage, step } = await req.json().catch(() => ({}));
      if (typeof ref !== "string" || !Number.isInteger(stage) || !Number.isInteger(step)) return out({ error: "ref/stage/step inválidos" }, 400);
      await setState(serviceClient(), `check|${ref}`, "check", ref, { stage, step, at: new Date().toISOString() }, auth.userId);
      return out({ ok: true });
    }
    return out({ error: "Rota desconhecida", path }, 404);
  } catch (e) {
    console.error("jarvis error:", e);
    return out({ error: (e as Error).message }, 500);
  }
});
