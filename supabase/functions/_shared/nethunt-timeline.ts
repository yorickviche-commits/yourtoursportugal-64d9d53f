// Per-lead timeline sync for the CRM tab.
//
// Sources (the NetHunt Zapier API is the ONLY NetHunt surface exposed to API keys and it
// has no timeline endpoint — every /timeline candidate returns 404, and the `new-email`
// trigger is not available for this workspace). So each event type is pulled from the
// system that actually owns it, and the resulting rows keep their real type:
//   comment | file | field_change | call  → NetHunt triggers, queried PER RECORD
//   email                                → Gmail connector (the mailbox NetHunt mirrors)
//   calendar                             → Google Calendar connector + calendar_events
// Everything is upserted into nethunt_timeline by event_id, so re-running is idempotent.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { DEALS_FOLDER, EPOCH, nhSoft, toIso, getState, setState, type LogRow } from "./nethunt.ts";

export type TimelineLead = {
  id: string;
  nethunt_record_id: string;
  yt_id: string | null;
  email: string | null;
  client_name: string | null;
};

type Row = Record<string, unknown>;

const NH_SOURCES = [
  { type: "comment", endpoint: "new-comment" },
  { type: "file", endpoint: "new-gdrivefile" },
  { type: "call", endpoint: "new-call-log" },
  { type: "field_change", endpoint: "record-change" },
] as const;

const strip = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const pick = (o: Row, keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
};

const evTime = (it: Row) =>
  toIso(it.createdAt ?? it.time ?? it.date ?? it.updatedAt) ?? new Date().toISOString();

function describeChange(it: Row) {
  const fa = it.fieldActions as Record<string, Record<string, unknown>> | undefined;
  if (!fa) return { subject: "Alteração de registo", body: null as string | null };
  const parts = Object.entries(fa).map(([f, v]) => {
    const add = v?.add ?? v?.set ?? null;
    const rem = v?.remove ?? null;
    return `${f}: ${rem ? `${rem} → ` : ""}${add ?? "(vazio)"}`;
  });
  return { subject: parts[0] ?? "Alteração de registo", body: parts.join("<br/>") };
}

function baseRow(lead: TimelineLead, type: string, id: string, time: string, extra: Row): Row {
  const body = (extra.body_html as string | null) ?? null;
  return {
    lead_id: lead.id,
    nethunt_record_id: lead.nethunt_record_id,
    event_id: id,
    event_type: type,
    event_time: time,
    pinned: false,
    creator_name: null,
    creator_email: null,
    subject: null,
    body_html: body,
    payload: {},
    synced_at: new Date().toISOString(),
    ...extra,
    snippet:
      (extra.snippet as string | null) ??
      (strip(String(body ?? extra.subject ?? "")).slice(0, 300) || null),
  };
}

// ── NetHunt (per record) ─────────────────────────────────────────────────────
async function nhEvents(lead: TimelineLead, full: boolean, sb: SupabaseClient) {
  const rows: Row[] = [];
  for (const src of NH_SOURCES) {
    const stateKey = `tl:${lead.id}:${src.type}`;
    let cursor = full ? EPOCH : (await getState(sb, stateKey)) ?? EPOCH;
    let maxTime = cursor;

    for (let page = 0; page < 10; page++) {
      const items = await nhSoft<Row[]>(
        `/triggers/${src.endpoint}/${DEALS_FOLDER}?recordId=${encodeURIComponent(lead.nethunt_record_id)}` +
          `&since=${encodeURIComponent(cursor)}&limit=500`,
        [],
      );
      if (!Array.isArray(items) || !items.length) break;
      let pageMax = cursor;

      for (const it of items) {
        const rid = String(it.recordId ?? it.record_id ?? (it.record as Row)?.id ?? "");
        if (rid && rid !== lead.nethunt_record_id) continue;
        const t = evTime(it);
        if (t > pageMax) pageMax = t;

        let subject = pick(it, ["subject", "title", "summary", "name"]);
        let body = pick(it, ["bodyHtml", "body_html", "html", "body", "text", "message", "transcript"]);
        if (src.type === "field_change") {
          const d = describeChange(it);
          subject = subject ?? d.subject;
          body = body ?? d.body;
        }
        if (src.type === "file" && it.url) {
          body = `<a href="${it.url}" target="_blank" rel="noopener">${subject ?? "Ficheiro"}</a>`;
        }
        const user = (it.user ?? {}) as Row;
        rows.push(baseRow(lead, src.type, String(it.id ?? `${src.type}:${rid}:${t}`), t, {
          pinned: Boolean(it.pinned),
          creator_name:
            pick(it, ["creatorName", "authorName", "userName", "createdByName"]) ??
            (typeof user.personalName === "string" ? user.personalName : null),
          creator_email:
            pick(it, ["creatorEmail", "authorEmail", "userEmail", "from", "createdBy"]) ??
            (typeof user.emailAddress === "string" ? user.emailAddress : null),
          subject,
          body_html: body,
          payload: it,
        }));
      }
      if (pageMax > maxTime) maxTime = pageMax;
      if (items.length < 500 || pageMax <= cursor) break;
      cursor = pageMax;
    }
    if (maxTime !== EPOCH) await setState(sb, stateKey, maxTime);
  }
  return rows;
}

// ── Gmail (emails, the source NetHunt itself mirrors) ────────────────────────
const GMAIL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const CAL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

const connHeaders = (key: string) => ({
  Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
  "X-Connection-Api-Key": key,
});

const header = (headers: Row[] | undefined, name: string) =>
  (headers ?? []).find((h) => String(h.name ?? "").toLowerCase() === name.toLowerCase())?.value as
    | string
    | undefined ?? "";

async function gmailEvents(lead: TimelineLead) {
  const key = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!key || !Deno.env.get("LOVABLE_API_KEY")) return [];
  const parts: string[] = [];
  if (lead.email) parts.push(`(from:${lead.email} OR to:${lead.email})`);
  const ref = (lead.yt_id ?? "").match(/\d{3,}/)?.[0];
  if (ref) parts.push(`"YT${ref}"`);
  if (!parts.length) return [];

  const h = connHeaders(key);
  const listRes = await fetch(
    `${GMAIL}/users/me/messages?maxResults=50&q=${encodeURIComponent(parts.join(" OR "))}`,
    { headers: h },
  );
  if (!listRes.ok) return [];
  const list = await listRes.json();
  const ids: string[] = (list.messages ?? []).map((m: Row) => String(m.id));
  if (!ids.length) return [];

  const details = await Promise.all(ids.map(async (id) => {
    const r = await fetch(
      `${GMAIL}/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
      { headers: h },
    );
    if (!r.ok) return null;
    const m = await r.json();
    const hs = m.payload?.headers as Row[] | undefined;
    const from = header(hs, "From");
    const to = header(hs, "To");
    const dateStr = header(hs, "Date");
    const time = m.internalDate
      ? new Date(Number(m.internalDate)).toISOString()
      : toIso(dateStr) ?? new Date().toISOString();
    const inbound = !/yourtours\.pt/i.test(from);
    return baseRow(lead, "email", `gmail:${m.id}`, time, {
      subject: header(hs, "Subject") || "(sem assunto)",
      creator_email: inbound ? from : to,
      creator_name: (inbound ? from : to).replace(/<.*/, "").replace(/"/g, "").trim() || null,
      snippet: `${inbound ? "↓" : "↑"} ${from} — ${String(m.snippet ?? "")}`.slice(0, 300),
      payload: {
        gmail_id: m.id,
        thread_id: m.threadId,
        direction: inbound ? "IN" : "OUT",
        url: `https://mail.google.com/mail/u/0/#all/${m.threadId}`,
      },
    });
  }));
  return details.filter(Boolean) as Row[];
}

// ── Google Calendar (real calendar events) ──────────────────────────────────
async function calendarEvents(sb: SupabaseClient, lead: TimelineLead) {
  const key = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!key || !Deno.env.get("LOVABLE_API_KEY")) return [];
  const { data } = await sb
    .from("integration_settings").select("config").eq("name", "google_calendar").maybeSingle();
  const calendarId = ((data?.config as Row | null)?.calendar_id as string) || "primary";

  const queries = new Set<string>();
  const ref = (lead.yt_id ?? "").match(/\d{3,}/)?.[0];
  if (ref) queries.add(`YT${ref}`);
  if (lead.client_name) queries.add(lead.client_name);
  if (!queries.size) return [];

  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    const url = `${CAL}/calendars/${encodeURIComponent(calendarId)}/events` +
      `?q=${encodeURIComponent(q)}&singleEvents=true&maxResults=100&timeMin=2023-01-01T00:00:00Z`;
    const res = await fetch(url, { headers: connHeaders(key) });
    if (!res.ok) continue;
    const body = await res.json();
    for (const ev of (body.items ?? []) as Row[]) {
      const id = String(ev.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const start = ev.start as Row | undefined;
      const time = toIso(start?.dateTime ?? start?.date) ?? new Date().toISOString();
      const creator = (ev.creator ?? {}) as Row;
      const link = String(ev.htmlLink ?? "");
      rows.push(baseRow(lead, "calendar", `gcal:${id}`, time, {
        subject: String(ev.summary ?? "Evento de calendário"),
        creator_email: typeof creator.email === "string" ? creator.email : null,
        body_html: [
          ev.description ? String(ev.description).replace(/\n/g, "<br/>") : null,
          ev.location ? `<br/><strong>Local:</strong> ${ev.location}` : null,
          link ? `<br/><a href="${link}" target="_blank" rel="noopener">Abrir no Google Calendar</a>` : null,
        ].filter(Boolean).join(""),
        payload: { google_event_id: id, url: link, status: ev.status ?? null },
      }));
    }
  }
  return rows;
}

/** Calendar events created by our own ops sync (guaranteed link via calendar_events). */
async function localCalendarEvents(sb: SupabaseClient, lead: TimelineLead) {
  const { data } = await sb
    .from("calendar_events")
    .select("google_event_id, day_date, status, last_synced_at")
    .eq("lead_id", lead.id);
  const rows = (data as Row[] | null) ?? [];
  return rows
    .filter((r) => r.google_event_id)
    .map((r) =>
      baseRow(lead, "calendar", `gcal:${r.google_event_id}`, toIso(r.day_date) ?? new Date().toISOString(), {
        subject: `Operações ${lead.yt_id ?? ""} — ${String(r.day_date)}`.trim(),
        body_html:
          `Evento operacional sincronizado com o Google Calendar (estado: ${r.status ?? "—"}).` +
          `<br/><a href="https://calendar.google.com/calendar/u/0/r/eventedit/${r.google_event_id}" target="_blank" rel="noopener">Abrir no Google Calendar</a>`,
        payload: { google_event_id: r.google_event_id, day_date: r.day_date },
      })
    );
}

async function upsert(sb: SupabaseClient, rows: Row[], logs: LogRow[]) {
  const byId = new Map(rows.map((r) => [String(r.event_id), r]));
  const uniq = [...byId.values()];
  for (let i = 0; i < uniq.length; i += 200) {
    const { error } = await sb
      .from("nethunt_timeline")
      .upsert(uniq.slice(i, i + 200) as never, { onConflict: "event_id", ignoreDuplicates: false });
    if (error) {
      logs.push({ direction: "pull", entity: "timeline", action: "upsert", status: "error", detail: { message: error.message } });
    }
  }
  return uniq;
}

export async function syncLeadTimeline(
  sb: SupabaseClient,
  lead: TimelineLead,
  logs: LogRow[],
  full = false,
) {
  const collected: Row[] = [];
  for (const task of [
    () => nhEvents(lead, full, sb),
    () => gmailEvents(lead),
    () => calendarEvents(sb, lead),
    () => localCalendarEvents(sb, lead),
  ]) {
    try {
      collected.push(...(await task()));
    } catch (e) {
      logs.push({ direction: "pull", entity: "timeline", entity_id: lead.id, action: "source", status: "error", detail: { message: (e as Error).message } });
    }
  }
  const rows = await upsert(sb, collected, logs);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[String(r.event_type)] = (counts[String(r.event_type)] ?? 0) + 1;
  return counts;
}

async function linkedLeads(sb: SupabaseClient, leadIds?: string[]) {
  const out: TimelineLead[] = [];
  for (let from = 0; ; from += 500) {
    let q = sb
      .from("leads").select("id, nethunt_record_id, yt_id, email, client_name")
      .not("nethunt_record_id", "is", null)
      .order("updated_at", { ascending: false })
      .range(from, from + 499);
    if (leadIds?.length) q = q.in("id", leadIds);
    const { data } = await q;
    const rows = (data as TimelineLead[] | null) ?? [];
    out.push(...rows);
    if (rows.length < 500) break;
  }
  return out;
}

/**
 * Syncs the timeline for linked leads.
 * `full` restarts from EPOCH (history rebuild); otherwise per-lead checkpoints are used.
 * `limit`/`offset` keep each invocation inside the edge-function time budget; when no
 * offset is given the sweep rotates through all leads across consecutive cron runs.
 */
export async function syncTimeline(
  sb: SupabaseClient,
  logs: LogRow[],
  opts: { full?: boolean; limit?: number; offset?: number; leadIds?: string[] } = {},
) {
  const leads = await linkedLeads(sb, opts.leadIds);
  if (!leads.length) return { leads: 0, counts: {} as Record<string, number> };

  const limit = Math.max(1, Math.min(opts.limit ?? (opts.leadIds ? leads.length : 25), leads.length));
  let offset = opts.offset;
  if (offset == null && !opts.leadIds) {
    offset = Number((await getState(sb, "timeline_sweep_offset")) ?? 0) || 0;
  }
  offset = (offset ?? 0) % leads.length;

  const batch: TimelineLead[] = [];
  for (let i = 0; i < limit; i++) batch.push(leads[(offset + i) % leads.length]);

  const counts: Record<string, number> = {};
  for (const lead of batch) {
    const c = await syncLeadTimeline(sb, lead, logs, opts.full);
    for (const [k, v] of Object.entries(c)) counts[k] = (counts[k] ?? 0) + v;
  }
  if (opts.offset == null && !opts.leadIds) {
    await setState(sb, "timeline_sweep_offset", String((offset + limit) % leads.length));
  }
  logs.push({ direction: "pull", entity: "timeline", action: "sweep", status: "ok", detail: { leads: batch.length, offset, counts } });
  return { leads: batch.length, total: leads.length, offset, counts };
}
