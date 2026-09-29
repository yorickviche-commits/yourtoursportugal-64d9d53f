// Core NetHunt → Lovable pull logic, shared by nethunt-pull and nethunt-webhook.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  DEALS_FOLDER, TASKS_FOLDER, EPOCH, F, TF,
  corsHeaders, json, serviceClient, logSync, getState, setState,
  pageRecords, fetchRecord, nhSoft, recId, recUpdatedAt, field,
  stageToStatus, toClientType, toSource, toDate, toIso, ytKey, canonicalStage,
  type LogRow, type NHRecord,
  dealValues, leadValues, taskNhValues, taskRowValues, getBaselines, setBaselines, same,
  LEAD_SYNC_COLS, type LeadForSync, type Vals,
} from "./nethunt.ts";
import { syncTimeline } from "./nethunt-timeline.ts";

type Lead = LeadForSync & { updated_at: string; nethunt_record_id: string | null; yt_id: string | null };

/** Deals created in NetHunt from this date on create a TCC lead when unmatched. */
const AUTO_CREATE_SINCE = "2026-09-29T00:00:00Z";

/**
 * Field-by-field merge against the baseline (nethunt_field_state).
 * Returns fields to apply to the TCC with the NetHunt value; `push` = TCC must be re-sent.
 * Baselines are written BEFORE the caller updates the TCC row (prevents echo).
 */
async function mergeFields(
  sb: SupabaseClient, entity: "lead" | "task", id: string,
  nhVals: Vals, tccVals: Vals, nhUpdatedAt: string, tccUpdatedAt: string, tccAuthority: Set<string>,
) {
  const base = await getBaselines(sb, entity, id);
  const { data: pend } = await sb.from("sync_queue").select("fields, requested_at")
    .eq("target", "nethunt").eq("entity", entity).eq("entity_id", id).in("status", ["pending", "processing"])
    .order("requested_at", { ascending: false }).limit(1);
  const pending = (pend as { fields: string[]; requested_at: string }[] | null)?.[0] ?? null;
  const tccTime = (f: string) =>
    pending && (!pending.fields?.length || pending.fields.includes(f)) ? pending.requested_at : tccUpdatedAt;

  const apply: string[] = [];
  const newBase: Vals = {};
  const conflicts: Record<string, unknown>[] = [];
  let push = false;
  for (const [f, nv] of Object.entries(nhVals)) {
    if (nv === undefined) continue;
    const tv = tccVals[f];
    const has = base.has(f);
    const bv = base.get(f);
    if (tccAuthority.has(f)) {
      if (!same(nv, tv)) {
        if (has && !same(nv, bv)) conflicts.push({ entity, entity_id: id, field: f, tcc_value: tv ?? null, nethunt_value: nv ?? null, winner: "tcc" });
        push = true;
      }
      newBase[f] = nv;
      continue;
    }
    if (!has) { if (!same(nv, tv)) apply.push(f); newBase[f] = nv; continue; }
    if (same(nv, bv)) continue;
    if (same(tv, bv) || same(tv, nv)) { if (!same(tv, nv)) apply.push(f); newBase[f] = nv; continue; }
    const nhWins = nhUpdatedAt >= tccTime(f);
    conflicts.push({ entity, entity_id: id, field: f, tcc_value: tv ?? null, nethunt_value: nv ?? null, winner: nhWins ? "nethunt" : "tcc" });
    if (nhWins) apply.push(f); else push = true;
    newBase[f] = nv;
  }
  await setBaselines(sb, entity, id, newBase);
  if (conflicts.length) await sb.from("nethunt_conflicts").insert(conflicts as never);
  if (push) await sb.rpc("enqueue_sync", { p_target: "nethunt", p_entity: entity, p_entity_id: id, p_fields: [], p_reason: "pull_conflict" } as never);
  return { apply, push, conflicts: conflicts.length };
}

async function createLeadFromDeal(sb: SupabaseClient, r: NHRecord, logs: LogRow[]) {
  const rid = recId(r);
  const v = dealValues(r);
  const yt = ytKey(field(r, F.ytId));
  const status = stageToStatus(v.stage as string | null);
  const row: Record<string, unknown> = {
    client_name: (v.name as string) || (yt ? `YT${yt}` : "Cliente NetHunt"),
    nethunt_record_id: rid,
    yt_id: yt ? `YT${yt}` : null,
    nethunt_stage: v.stage ?? null,
    status: status ?? "new",
    trip_start: v.trip_start ?? null,
    trip_finish: v.trip_finish ?? null,
    travel_dates: (v.trip_start as string) || "A definir",
    travel_end_date: (v.trip_finish as string) || "",
    client_type: (v.client_type as string) ?? "B2C",
    source: (v.source as string) ?? "direct",
    estimated_value: v.value ?? null,
    close_date: v.close_date ?? null,
    created_via: "nethunt_auto",
    destination: "A definir",
    nethunt_updated_at: recUpdatedAt(r),
    nethunt_synced_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("leads").insert(row as never).select("id").maybeSingle();
  const id = (data as { id: string } | null)?.id ?? null;
  if (id) await setBaselines(sb, "lead", id, v);
  logs.push({ direction: "pull", entity: "lead", entity_id: id, nethunt_record_id: rid, action: "create", status: error ? "error" : "ok", detail: error ? { message: error.message } : { created_via: "nethunt_auto" } });
  return id;
}

async function syncDeal(sb: SupabaseClient, r: NHRecord, logs: LogRow[]) {
  const rid = recId(r);
  const updatedAt = recUpdatedAt(r);
  const ytId = field(r, F.ytId);

  let lead: Lead | null = null;
  const byRid = await sb.from("leads").select(LEAD_SYNC_COLS).eq("nethunt_record_id", rid).maybeSingle();
  lead = (byRid.data as Lead | null) ?? null;

  const ytDigits = ytKey(ytId);
  if (!lead && ytDigits) {
    const byYt = await sb.from("leads").select(LEAD_SYNC_COLS).ilike("yt_id", `%${ytDigits}`);
    const rows = (byYt.data as Lead[] | null) ?? [];
    lead = rows.find((l) => ytKey(l.yt_id) === ytDigits) ?? null;
  }
  if (!lead) {
    const createdAt = toIso(r.createdAt);
    if (createdAt && createdAt >= AUTO_CREATE_SINCE) return await createLeadFromDeal(sb, r, logs);
    logs.push({ direction: "pull", entity: "lead", nethunt_record_id: rid, action: "unmatched", status: "skipped", detail: { yt_id: ytId ?? null } });
    return null;
  }

  const nhVals = dealValues(r);
  const { vals: tccVals, hasCosting } = await leadValues(sb, lead);
  const { apply, conflicts } = await mergeFields(
    sb, "lead", lead.id, nhVals, tccVals, updatedAt, lead.updated_at, new Set(hasCosting ? ["value"] : []),
  );

  const patch: Record<string, unknown> = {
    nethunt_record_id: rid,
    nethunt_updated_at: updatedAt,
    nethunt_synced_at: new Date().toISOString(),
  };
  if (ytDigits) patch.yt_id = `YT${ytDigits}`;
  for (const f of apply) {
    const v = nhVals[f];
    if (f === "stage") {
      patch.nethunt_stage = v;
      const st = stageToStatus(v as string | null);
      if (st) patch.status = st;
    } else if (f === "name") patch.client_name = v;
    else if (f === "value") patch.estimated_value = v;
    else patch[f] = v;
  }

  const { error } = await sb.from("leads").update(patch as never).eq("id", lead.id);
  logs.push({
    direction: "pull", entity: "lead", entity_id: lead.id, nethunt_record_id: rid,
    action: "update", status: error ? "error" : "ok",
    detail: error ? { message: error.message } : { fields: apply, conflicts },
  });
  return lead.id;
}

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

  const { data: existing } = await sb.from("tasks").select("*").eq("nethunt_record_id", rid).maybeSingle();
  const ex = existing as Record<string, any> | null;

  // Deleted in NetHunt → cancelled in the TCC (never deleted).
  if (r.deleted) {
    if (ex && ex.status !== "cancelled") {
      await sb.from("tasks").update({ status: "cancelled", nethunt_synced_at: new Date().toISOString() } as never).eq("id", ex.id);
      logs.push({ direction: "pull", entity: "task", entity_id: ex.id, nethunt_record_id: rid, action: "cancel" });
    }
    return;
  }

  const nhVals = taskNhValues(r);
  const meta = {
    creator_email: field(r, TF.creator) ? String(field(r, TF.creator)) : null,
    nethunt_record_links: linkIds,
    lead_id: leadId,
    nethunt_updated_at: updatedAt,
    nethunt_synced_at: new Date().toISOString(),
  };

  if (ex) {
    const { apply, conflicts } = await mergeFields(sb, "task", ex.id, nhVals, taskRowValues(ex), updatedAt, ex.updated_at, new Set());
    const patch: Record<string, unknown> = { ...meta };
    for (const f of apply) {
      patch[f] = nhVals[f];
      if (f === "completed") patch.status = nhVals.completed ? "done" : "todo";
      if (f === "due_at") patch.due_date = nhVals.due_at ? String(nhVals.due_at).slice(0, 10) : null;
    }
    const { error } = await sb.from("tasks").update(patch as never).eq("id", ex.id);
    logs.push({ direction: "pull", entity: "task", entity_id: ex.id, nethunt_record_id: rid, action: "update", status: error ? "error" : "ok", detail: error ? { message: error.message } : { fields: apply, conflicts } });
  } else {
    const row = {
      ...nhVals, ...meta, nethunt_record_id: rid,
      status: nhVals.completed ? "done" : "todo",
      due_date: nhVals.due_at ? String(nhVals.due_at).slice(0, 10) : null,
    };
    const { data, error } = await sb.from("tasks").insert(row as never).select("id").maybeSingle();
    const id = (data as { id: string } | null)?.id ?? null;
    if (id) await setBaselines(sb, "task", id, nhVals);
    logs.push({ direction: "pull", entity: "task", entity_id: id, nethunt_record_id: rid, action: "create", status: error ? "error" : "ok", detail: error ? { message: error.message } : null });
  }
}

/** Debug helper: probes each NetHunt trigger and reports how many events it exposes. */
export async function sampleTimeline() {
  const out: Record<string, unknown> = {};
  for (const ep of ["new-comment", "new-email", "new-call-log", "new-gdrivefile", "record-change"]) {
    const items = await nhSoft<Record<string, unknown>[]>(
      `/triggers/${ep}/${DEALS_FOLDER}?since=${encodeURIComponent(EPOCH)}&limit=3`,
      [],
    );
    out[ep] = { count: Array.isArray(items) ? items.length : 0, first: items?.[0] ?? null };
  }
  return out;
}


export type SyncPeriod = "yesterday" | "7d" | "30d" | "12m" | "all";

const PERIOD_DAYS: Record<Exclude<SyncPeriod, "all">, number> = {
  yesterday: 1,
  "7d": 7,
  "30d": 30,
  "12m": 365,
};

/** Period → ISO cutoff. `all` rebuilds the whole history. */
export function periodSince(period?: SyncPeriod | null): string | null {
  if (!period) return null;
  if (period === "all") return EPOCH;
  const days = PERIOD_DAYS[period];
  if (!days) return null;
  return new Date(Date.now() - days * 86400000).toISOString();
}

export type PullOpts = {
  recordId?: string;
  folder?: "deals" | "tasks";
  /** Timeline: rebuild history from EPOCH instead of using per-lead checkpoints. */
  fullTimeline?: boolean;
  /** Timeline: how many leads to sweep in this invocation (and where to start). */
  timelineLimit?: number;
  timelineOffset?: number;
  leadIds?: string[];
  /** Manual sync window: reads only what changed inside this period. */
  period?: SyncPeriod;
  /** Explicit ISO cutoff (overrides `period`). */
  since?: string;
};

export async function runPull(opts: PullOpts = {}) {
  const sb = serviceClient();
  const logs: LogRow[] = [];
  const leadsByRid = new Map<string, string>();
  let deals = 0, tasks = 0;
  const windowSince = opts.since ?? periodSince(opts.period);

  const stamp = async (result: Record<string, unknown>) => {
    await setState(sb, "last_manual_sync_at", new Date().toISOString());
    if (opts.period) await setState(sb, "last_manual_sync_period", opts.period);
    await setState(sb, "last_manual_sync_result", JSON.stringify(result).slice(0, 2000));
  };

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
    const timeline = await syncTimeline(sb, logs, {
      full: opts.fullTimeline,
      since: windowSince ?? undefined,
      leadIds: opts.leadIds ?? (leadsByRid.size ? [...leadsByRid.values()] : undefined),
    });
    await logSync(sb, logs);
    const result = { deals, tasks, timeline, mode: "single" as const, period: opts.period ?? null };
    await stamp(result);
    return result;
  }

  const dealsSince = windowSince ?? (await getState(sb, "deals_since")) ?? EPOCH;
  const tasksSince = windowSince ?? (await getState(sb, "tasks_since")) ?? EPOCH;

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

  const timeline = await syncTimeline(sb, logs, {
    full: opts.fullTimeline,
    since: windowSince ?? undefined,
    limit: opts.timelineLimit,
    offset: opts.timelineOffset,
    leadIds: opts.leadIds,
  });

  if (maxDeal !== dealsSince) await setState(sb, "deals_since", maxDeal);
  if (maxTask !== tasksSince) await setState(sb, "tasks_since", maxTask);
  await logSync(sb, logs);

  const result = { deals, tasks, timeline, deals_since: maxDeal, tasks_since: maxTask, period: opts.period ?? null };
  await stamp(result);
  return result;
}


