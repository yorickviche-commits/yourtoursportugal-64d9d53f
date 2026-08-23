// Core NetHunt → Lovable pull logic, shared by nethunt-pull and nethunt-webhook.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  DEALS_FOLDER, TASKS_FOLDER, EPOCH, F, TF,
  corsHeaders, json, serviceClient, logSync, getState, setState,
  pageRecords, fetchRecord, nhSoft, recId, recUpdatedAt, field,
  stageToStatus, toClientType, toSource, toDate, toIso,
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

  if (!lead && ytId) {
    const byYt = await sb
      .from("leads").select("id, updated_at, nethunt_stage")
      .eq("yt_id", String(ytId)).maybeSingle();
    lead = (byYt.data as Lead | null) ?? null;
  }
  if (!lead) {
    logs.push({ direction: "pull", entity: "lead", nethunt_record_id: rid, action: "unmatched", status: "skipped", detail: { yt_id: ytId ?? null } });
    return null;
  }
  if (lead.updated_at && lead.updated_at > updatedAt) {
    logs.push({ direction: "pull", entity: "lead", entity_id: lead.id, nethunt_record_id: rid, action: "update", status: "skipped_lww" });
    return lead.id;
  }

  const stage = field(r, F.stage) ? String(field(r, F.stage)) : null;
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

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
};

async function syncTimeline(sb: SupabaseClient, recordIds: Map<string, string>, since: string, logs: LogRow[]) {
  if (!recordIds.size) return;
  const rows: Record<string, unknown>[] = [];
  for (const ev of TIMELINE) {
    const items = await nhSoft<Record<string, unknown>[]>(
      `/triggers/${ev.endpoint}/${DEALS_FOLDER}?since=${encodeURIComponent(since)}&limit=500`,
      [],
    );
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const rid = String(it.recordId ?? it.record_id ?? (it.record as Record<string, unknown>)?.id ?? "");
      const leadId = recordIds.get(rid);
      if (!leadId) continue;
      const time = toIso(it.createdAt ?? it.time ?? it.date ?? it.updatedAt) ?? new Date().toISOString();
      const evId = String(it.id ?? `${ev.type}:${rid}:${time}`);
      const body = pick(it, ["bodyHtml", "body_html", "html", "body", "text", "message", "transcript"]);
      let type = ev.type;
      const subject = pick(it, ["subject", "title", "summary", "name"]);
      const raw = JSON.stringify(it).toLowerCase();
      if (ev.type === "email" && /whatsapp|telegram|messenger|chat/.test(raw)) type = "chat";
      if (ev.type === "field_change" && /calendar|event|meeting/.test(raw)) type = "calendar";
      rows.push({
        lead_id: leadId,
        nethunt_record_id: rid,
        event_id: evId,
        event_type: type,
        event_time: time,
        pinned: Boolean(it.pinned),
        creator_name: pick(it, ["creatorName", "authorName", "userName", "createdByName"]),
        creator_email: pick(it, ["creatorEmail", "authorEmail", "userEmail", "from", "createdBy"]),
        subject,
        snippet: (body ?? subject ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || null,
        body_html: body,
        payload: it,
        synced_at: new Date().toISOString(),
      });
    }
  }
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb
      .from("nethunt_timeline")
      .upsert(rows.slice(i, i + 200) as never, { onConflict: "event_id", ignoreDuplicates: false });
    if (error) logs.push({ direction: "pull", entity: "timeline", action: "upsert", status: "error", detail: { message: error.message } });
  }
  logs.push({ direction: "pull", entity: "timeline", action: "upsert", status: "ok", detail: { count: rows.length } });
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

