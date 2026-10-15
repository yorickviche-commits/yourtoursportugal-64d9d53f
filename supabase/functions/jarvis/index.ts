// JARVIS — dados do ecrã Jarvis (/agents). Só leitura neste passo.
// GET /jarvis/live → pipeline NetHunt ao vivo (todas as files ativas) + fios de email, calendário,
// fornecedores por file, emails de FSE e Aprovações AI pendentes do TCC.
// As ações para aprovação são calculadas no ecrã (mesma regra do Jarvis no claude.ai).
import { corsHeadersAuth, requireInternalUser } from "../_shared/require-auth.ts";
import {
  DEALS_FOLDER, F, F_VALUE, canonicalStage, field, pageRecords, recId, serviceClient, toIso, ytKey,
  type NHRecord,
} from "../_shared/nethunt.ts";

const headers = { ...corsHeadersAuth, "Access-Control-Allow-Methods": "GET, OPTIONS", "Content-Type": "application/json" };
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
    const stage = canonicalStage(field(r, F.stage) as string | null);
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
    queue.push({
      ref, sev: "MÉDIA", dl: "APROVAÇÕES AI", title: a.title ?? a.type,
      rec: p.to_name ?? p.recipient_name ?? p.supplier ?? "",
      to: p.to ?? p.recipient ?? p.email ?? "",
      draft: String(p.body_text ?? p.text ?? p.body ?? a.subtitle ?? "").replace(/<[^>]+>/g, ""),
      key: `queue|${a.id}`,
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
    deals: rows, emails, threads, calendar, ops, fse, queue, leadIds, done: {}, checklist: {},
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;
  const path = new URL(req.url).pathname.replace(/^.*\/jarvis/, "") || "/";
  try {
    if (req.method === "GET" && (path === "/live" || path === "/")) return out(await live());
    return out({ error: "Ainda não disponível neste passo", path }, 501);
  } catch (e) {
    console.error("jarvis error:", e);
    return out({ error: (e as Error).message }, 500);
  }
});
