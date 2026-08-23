// One-off backfill: links NetHunt deal records to existing leads by YT ID, and imports tasks.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";
import {
  DEALS_FOLDER, TASKS_FOLDER, EPOCH, F, TF,
  corsHeaders, json, serviceClient, logSync, setState,
  pageRecords, recId, recUpdatedAt, field,
  stageToStatus, toClientType, toSource, toDate, toIso, ytKey, canonicalStage,
  type LogRow,
} from "../_shared/nethunt.ts";

const PRIORITY_IN: Record<string, string> = { High: "high", Medium: "medium", Low: "low" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireInternalUser(req, { adminOnly: true });
  if (!auth.ok) return auth.response;

  const sb = serviceClient();
  const logs: LogRow[] = [];
  try {
    // ── Leads ──
    const deals = await pageRecords("new-record", DEALS_FOLDER, EPOCH, 60);
    const { data: leadRows } = await sb.from("leads").select("id, yt_id, nethunt_record_id");
    const leads = (leadRows as { id: string; yt_id: string | null; nethunt_record_id: string | null }[] | null) ?? [];
    const byYt = new Map(leads.filter((l) => ytKey(l.yt_id)).map((l) => [ytKey(l.yt_id)!, l]));

    const ridByLead = new Map<string, string>();
    let matched = 0, unmatched = 0, maxDeal = EPOCH;

    for (const r of deals) {
      const rid = recId(r);
      const updatedAt = recUpdatedAt(r);
      if (updatedAt > maxDeal) maxDeal = updatedAt;
      const ytRaw = field(r, F.ytId);
      const lead = ytKey(ytRaw) ? byYt.get(ytKey(ytRaw)!) : undefined;
      if (!lead) {
        unmatched++;
        logs.push({ direction: "pull", entity: "lead", nethunt_record_id: rid, action: "unmatched", status: "skipped", detail: { yt_id: ytRaw ?? null, name: field(r, F.name) ?? null } });
        continue;
      }
      const stage = canonicalStage(field(r, F.stage) as string | null);
      const patch: Record<string, unknown> = {
        nethunt_record_id: rid,
        nethunt_stage: stage,
        nethunt_updated_at: updatedAt,
        nethunt_synced_at: new Date().toISOString(),
        trip_start: toDate(field(r, F.tripStart)),
        trip_finish: toDate(field(r, F.tripFinish)),
        close_date: toDate(field(r, F.closeDate)),
      };
      const ct = toClientType(field(r, F.clientType));
      if (ct) patch.client_type = ct;
      const src = toSource(field(r, F.source));
      if (src) patch.source = src;
      const st = stageToStatus(stage);
      if (st) patch.status = st;

      const { error } = await sb.from("leads").update(patch as never).eq("id", lead.id);
      if (error) {
        logs.push({ direction: "pull", entity: "lead", entity_id: lead.id, nethunt_record_id: rid, action: "backfill", status: "error", detail: { message: error.message } });
      } else {
        matched++;
        ridByLead.set(rid, lead.id);
      }
    }

    // ── Tasks ──
    const taskRecords = await pageRecords("new-record", TASKS_FOLDER, EPOCH, 60);
    let tCreated = 0, tUpdated = 0, maxTask = EPOCH;
    const { data: existingRows } = await sb.from("tasks").select("id, nethunt_record_id").not("nethunt_record_id", "is", null);
    const existing = new Map(((existingRows as { id: string; nethunt_record_id: string }[] | null) ?? []).map((t) => [t.nethunt_record_id, t.id]));

    for (const r of taskRecords) {
      const rid = recId(r);
      const updatedAt = recUpdatedAt(r);
      if (updatedAt > maxTask) maxTask = updatedAt;
      const links = field(r, TF.recordLinks);
      const linkIds = Array.isArray(links) ? links.map(String) : links ? [String(links)] : [];
      const leadId = linkIds.map((l) => ridByLead.get(l)).find(Boolean) ?? null;
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
      const exId = existing.get(rid);
      if (exId) {
        await sb.from("tasks").update(row as never).eq("id", exId);
        tUpdated++;
      } else {
        const { error } = await sb.from("tasks").insert({ ...row, team: "sales" } as never);
        if (error) logs.push({ direction: "pull", entity: "task", nethunt_record_id: rid, action: "backfill", status: "error", detail: { message: error.message } });
        else tCreated++;
      }
    }

    await setState(sb, "deals_since", maxDeal);
    await setState(sb, "tasks_since", maxTask);
    logs.push({ direction: "pull", entity: "backfill", action: "summary", detail: { deals: deals.length, matched, unmatched, tasks: taskRecords.length, tCreated, tUpdated } });
    await logSync(sb, logs);

    return json({
      ok: true,
      deals_total: deals.length, leads_matched: matched, records_unmatched: unmatched,
      tasks_total: taskRecords.length, tasks_created: tCreated, tasks_updated: tUpdated,
    });
  } catch (e) {
    console.error("nethunt-backfill error:", e);
    await logSync(sb, [...logs, { direction: "pull", entity: "backfill", action: "error", status: "error", detail: { message: (e as Error).message } }]);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
