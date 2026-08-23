// Core NetHunt → Lovable pull logic, shared by nethunt-pull and nethunt-webhook.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  DEALS_FOLDER, TASKS_FOLDER, EPOCH, F, TF,
  corsHeaders, json, serviceClient, logSync, getState, setState,
  pageRecords, fetchRecord, nhSoft, recId, recUpdatedAt, field,
  stageToStatus, toClientType, toSource, toDate, toIso, ytKey, canonicalStage,
  type LogRow, type NHRecord,
} from "./nethunt.ts";

type Lead = { id: string; updated_at: string; nethunt_stage: string | null };

async function syncDeal(sb: SupabaseClient, r: NHRecord, logs: LogRow[]) {
  const rid = recId(r);
  const updatedAt = recUpdatedAt(r);
  const ytId = field(r, F.ytId);

  let lead: Lead | null = null;
  const byRid = await sb
    .from("leads").select("id, updated_at, nethunt_stage")
    .eq("nethunt_record_id", rid).maybeSingle();
  lead = (byRid.data as Lead | null) ?? null;

  const ytDigits = ytKey(ytId);
  if (!lead && ytDigits) {
    const byYt = await sb
      .from("leads").select("id, updated_at, nethunt_stage, yt_id")
      .ilike("yt_id", `%${ytDigits}`);
    const rows = (byYt.data as (Lead & { yt_id: string })[] | null) ?? [];
    lead = rows.find((l) => ytKey(l.yt_id) === ytDigits) ?? null;
  }
  if (!lead) {
    logs.push({ direction: "pull", entity: "lead", nethunt_record_id: rid, action: "unmatched", status: "skipped", detail: { yt_id: ytId ?? null } });
    return null;
  }
  if (lead.updated_at && lead.updated_at > updatedAt) {
    logs.push({ direction: "pull", entity: "lead", entity_id: lead.id, nethunt_record_id: rid, action: "update", status: "skipped_lww" });
    return lead.id;
  }

  const stage = canonicalStage(field(r, F.stage) as string | null);
  const status = stageToStatus(stage);
  const patch: Record<string, unknown> = {
    nethunt_record_id: rid,
    nethunt_stage: stage,
    nethunt_updated_at: updatedAt,
    nethunt_synced_at: new Date().toISOString(),
    trip_start: toDate(field(r, F.tripStart)),
    trip_finish: toDate(field(r, F.tripFinish)),
    close_date: toDate(field(r, F.closeDate)),
  };
  if (status) patch.status = status;
  const ct = toClientType(field(r, F.clientType));
  if (ct) patch.client_type = ct;
  const src = toSource(field(r, F.source));
  if (src) patch.source = src;

  const { error } = await sb.from("leads").update(patch as never).eq("id", lead.id);
  logs.push({
    direction: "pull", entity: "lead", entity_id: lead.id, nethunt_record_id: rid,
    action: "update", status: error ? "error" : "ok", detail: error ? { message: error.message } : null,
  });
  return lead.id;
}

const PRIORITY_IN: Record<string, string> = { High: "high", Medium: "medium", Low: "low" };

async function syncTask(sb: SupabaseClient, r: NHRecord, logs: LogRow[]) {
  const rid = recId(r);
  const updatedAt = recUpdatedAt(r);
  const links = field(r, TF.recordLinks);
  const linkIds = Array.isArray(links) ? links.map(String) : links ? [String(links)] : [];

  let leadId: string | null = null;
  if (linkIds.length) {
    const { data } = await sb.from("leads").select("id").in("nethunt_record_id", linkIds).limit(1);
    leadId = (data as { id: string }[] | null)?.[0]?.id ?? null;
  }

  const assignee = field(r, TF.assignee);
  const dueAt = toIso(field(r, TF.dueDate));
  const completed = Boolean(field(r, TF.completed));
  const row: Record<string, unknown> = {
    nethunt_record_id: rid,
    title: String(field(r, TF.name) ?? "(sem título)"),
    description: field(r, TF.description) ? String(field(r, TF.description)) : "",
    priority: PRIORITY_IN[String(field(r, TF.priority) ?? "")] ?? "medium",
    completed,
    status: completed ? "done" : "todo",
    all_day: Boolean(field(r, TF.allDay)),
    due_at: dueAt,
    due_date: dueAt ? dueAt.slice(0, 10) : null,
    assignee_emails: Array.isArray(assignee) ? assignee.map(String) : assignee ? [String(assignee)] : [],
    creator_email: field(r, TF.creator) ? String(field(r, TF.creator)) : null,
    nethunt_record_links: linkIds,
    lead_id: leadId,
    nethunt_updated_at: updatedAt,
    nethunt_synced_at: new Date().toISOString(),
  };

  const { data: existing } = await sb
    .from("tasks").select("id, updated_at").eq("nethunt_record_id", rid).maybeSingle();
  const ex = existing as { id: string; updated_at: string } | null;

  if (ex) {
    if (ex.updated_at && ex.updated_at > updatedAt) {
      logs.push({ direction: "pull", entity: "task", entity_id: ex.id, nethunt_record_id: rid, action: "update", status: "skipped_lww" });
      return;
    }
    const { error } = await sb.from("tasks").update(row as never).eq("id", ex.id);
    logs.push({ direction: "pull", entity: "task", entity_id: ex.id, nethunt_record_id: rid, action: "update", status: error ? "error" : "ok", detail: error ? { message: error.message } : null });
  } else {
    const { data, error } = await sb.from("tasks").insert(row as never).select("id").maybeSingle();
    logs.push({ direction: "pull", entity: "task", entity_id: (data as { id: string } | null)?.id ?? null, nethunt_record_id: rid, action: "create", status: error ? "error" : "ok", detail: error ? { message: error.message } : null });
  }
}

type Ev = { type: string; endpoint: string };
const TIMELINE: Ev[] = [
  { type: "comment", endpoint: "new-comment" },
  { type: "email", endpoint: "new-email" },
  { type: "call", endpoint: "new-call-log" },
  { type: "file", endpoint: "new-gdrivefile" },
  { type: "field_change", endpoint: "record-change" },
];

/** Debug helper: returns raw first items per timeline endpoint. */
export async function sampleTimeline() {
  const out: Record<string, unknown> = {};
  for (const ev of TIMELINE) {
    const items = await nhSoft<Record<string, unknown>[]>(
      `/triggers/${ev.endpoint}/${DEALS_FOLDER}?since=${encodeURIComponent(EPOCH)}&limit=3`,
      [],
    );
    out[ev.endpoint] = { count: Array.isArray(items) ? items.length : 0, first: Array.isArray(items) ? items[0] : items };
  }
  return out;
}

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
};

/** Map of every NetHunt deal record id → lead id (paginated, service role). */
async function allLeadMap(sb: SupabaseClient) {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from("leads").select("id, nethunt_record_id")
      .not("nethunt_record_id", "is", null)
      .range(from, from + 999);
    const rows = (data as { id: string; nethunt_record_id: string }[] | null) ?? [];
    for (const r of rows) map.set(r.nethunt_record_id, r.id);
    if (rows.length < 1000) break;
  }
  return map;
}

const evTime = (it: Record<string, unknown>) =>
  toIso(it.createdAt ?? it.time ?? it.date ?? it.updatedAt) ?? new Date().toISOString();

function describeChange(it: Record<string, unknown>) {
  const fa = it.fieldActions as Record<string, Record<string, unknown>> | undefined;
  if (!fa) return { subject: "Alteração de registo", body: null as string | null };
  const parts = Object.entries(fa).map(([f, v]) => {
    const add = v?.add ?? v?.set ?? null;
    const rem = v?.remove ?? null;
    return `${f}: ${rem ? `${rem} → ` : ""}${add ?? "(vazio)"}`;
  });
  return { subject: parts[0] ?? "Alteração de registo", body: parts.join("<br/>") };
}

/** Pulls timeline events for ALL linked leads, with a per-type checkpoint. */
async function syncTimeline(sb: SupabaseClient, logs: LogRow[]) {
  const leadMap = await allLeadMap(sb);
  if (!leadMap.size) return;

  for (const ev of TIMELINE) {
    const stateKey = `timeline_${ev.type}_since`;
    let cursor = (await getState(sb, stateKey)) ?? EPOCH;
    let maxTime = cursor;
    const rows: Record<string, unknown>[] = [];

    for (let page = 0; page < 40; page++) {
      const items = await nhSoft<Record<string, unknown>[]>(
        `/triggers/${ev.endpoint}/${DEALS_FOLDER}?since=${encodeURIComponent(cursor)}&limit=500`,
        [],
      );
      if (!Array.isArray(items) || !items.length) break;

      let pageMax = cursor;
      for (const it of items) {
        const t = evTime(it);
        if (t > pageMax) pageMax = t;
        const rid = String(it.recordId ?? it.record_id ?? (it.record as Record<string, unknown>)?.id ?? "");
        const leadId = leadMap.get(rid);
        if (!leadId) continue;

        let type = ev.type;
        let subject = pick(it, ["subject", "title", "summary", "name"]);
        let body = pick(it, ["bodyHtml", "body_html", "html", "body", "text", "message", "transcript"]);
        if (ev.type === "field_change") {
          const d = describeChange(it);
          subject = subject ?? d.subject;
          body = body ?? d.body;
        }
        if (ev.type === "file" && it.url) body = `<a href="${it.url}" target="_blank" rel="noopener">${subject ?? "Ficheiro"}</a>`;
        const raw = JSON.stringify(it).toLowerCase();
        if (ev.type === "email" && /whatsapp|telegram|messenger|chat/.test(raw)) type = "chat";
        if (ev.type === "field_change" && /calendar|event|meeting/.test(raw)) type = "calendar";

        const user = (it.user ?? {}) as Record<string, unknown>;
        rows.push({
          lead_id: leadId,
          nethunt_record_id: rid,
          event_id: String(it.id ?? `${ev.type}:${rid}:${t}`),
          event_type: type,
          event_time: t,
          pinned: Boolean(it.pinned),
          creator_name: pick(it, ["creatorName", "authorName", "userName", "createdByName"]) ??
            (typeof user.personalName === "string" ? user.personalName : null),
          creator_email: pick(it, ["creatorEmail", "authorEmail", "userEmail", "from", "createdBy"]) ??
            (typeof user.emailAddress === "string" ? user.emailAddress : null),
          subject,
          snippet: (body ?? subject ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || null,
          body_html: body,
          payload: it,
          synced_at: new Date().toISOString(),
        });
      }
      if (pageMax > maxTime) maxTime = pageMax;
      if (items.length < 500 || pageMax <= cursor) break;
      cursor = pageMax;
    }

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb
        .from("nethunt_timeline")
        .upsert(rows.slice(i, i + 200) as never, { onConflict: "event_id", ignoreDuplicates: false });
      if (error) logs.push({ direction: "pull", entity: "timeline", action: "upsert", status: "error", detail: { type: ev.type, message: error.message } });
    }
    if (rows.length) logs.push({ direction: "pull", entity: "timeline", action: "upsert", status: "ok", detail: { type: ev.type, count: rows.length } });
    if (maxTime !== EPOCH && maxTime > (await getState(sb, stateKey) ?? EPOCH)) await setState(sb, stateKey, maxTime);
  }
}

export async function runPull(opts: { recordId?: string; folder?: "deals" | "tasks" } = {}) {
  const sb = serviceClient();
  const logs: LogRow[] = [];
  const leadsByRid = new Map<string, string>();
  let deals = 0, tasks = 0;

  if (opts.recordId) {
    const folder = opts.folder === "tasks" ? TASKS_FOLDER : DEALS_FOLDER;
    const rec = await fetchRecord(folder, opts.recordId);
    if (rec) {
      if (folder === DEALS_FOLDER) {
        const leadId = await syncDeal(sb, rec, logs);
        if (leadId) leadsByRid.set(recId(rec), leadId);
        deals = 1;
      } else {
        await syncTask(sb, rec, logs);
        tasks = 1;
      }
    }
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    await syncTimeline(sb, leadsByRid, since, logs);
    await logSync(sb, logs);
    return { deals, tasks, mode: "single" };
  }

  const dealsSince = (await getState(sb, "deals_since")) ?? EPOCH;
  const tasksSince = (await getState(sb, "tasks_since")) ?? EPOCH;

  const dealRecords = [
    ...(await pageRecords("new-record", DEALS_FOLDER, dealsSince)),
    ...(await pageRecords("updated-record", DEALS_FOLDER, dealsSince)),
  ];
  const uniqDeals = new Map(dealRecords.map((r) => [recId(r), r]));
  let maxDeal = dealsSince;
  for (const r of uniqDeals.values()) {
    const leadId = await syncDeal(sb, r, logs);
    if (leadId) leadsByRid.set(recId(r), leadId);
    if (recUpdatedAt(r) > maxDeal) maxDeal = recUpdatedAt(r);
  }
  deals = uniqDeals.size;

  const taskRecords = [
    ...(await pageRecords("new-record", TASKS_FOLDER, tasksSince)),
    ...(await pageRecords("updated-record", TASKS_FOLDER, tasksSince)),
  ];
  const uniqTasks = new Map(taskRecords.map((r) => [recId(r), r]));
  let maxTask = tasksSince;
  for (const r of uniqTasks.values()) {
    await syncTask(sb, r, logs);
    if (recUpdatedAt(r) > maxTask) maxTask = recUpdatedAt(r);
  }
  tasks = uniqTasks.size;

  await syncTimeline(sb, leadsByRid, dealsSince, logs);

  if (maxDeal !== dealsSince) await setState(sb, "deals_since", maxDeal);
  if (maxTask !== tasksSince) await setState(sb, "tasks_since", maxTask);
  await logSync(sb, logs);

  return { deals, tasks, deals_since: maxDeal, tasks_since: maxTask };
}

