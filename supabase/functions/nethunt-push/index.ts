// Lovable → NetHunt writes. Called explicitly by frontend mutations (never by the pull).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";
import {
  DEALS_FOLDER, TASKS_FOLDER, F, TF,
  corsHeaders, json, serviceClient, logSync,
  updateRecord, createRecord, createComment, fetchRecord,
  fromClientType, fromSource, fromDate, fromDateTime, statusToStage, wkey, rawStage,
  recId, recUpdatedAt,
  type FieldAction,
} from "../_shared/nethunt.ts";

const PRIORITY_OUT: Record<string, string> = { high: "High", urgent: "High", medium: "Medium", low: "Low" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  const sb = serviceClient();
  try {
    const { entity, id, changes = {} } = await req.json() as {
      entity: "lead" | "task" | "comment" | "task_create" | "task_complete";
      id?: string;
      changes?: Record<string, unknown>;
    };
    const now = new Date().toISOString();

    if (entity === "lead") {
      if (!id) throw new Error("id required");
      const { data } = await sb.from("leads")
        .select("id, nethunt_record_id, nethunt_stage, status").eq("id", id).maybeSingle();
      const lead = data as { id: string; nethunt_record_id: string | null; nethunt_stage: string | null; status: string } | null;
      if (!lead?.nethunt_record_id) throw new Error("Lead sem record NetHunt associado");

      const actions: FieldAction[] = [];
      if ("nethunt_stage" in changes || "status" in changes) {
        const stage = (changes.nethunt_stage as string | undefined) ??
          statusToStage((changes.status as string) ?? lead.status, lead.nethunt_stage);
        if (stage) actions.push({ field: wkey(F.stage), value: rawStage(stage) });
      }
      if ("trip_start" in changes) actions.push({ field: wkey(F.tripStart), value: fromDate(changes.trip_start as string) });
      if ("trip_finish" in changes) actions.push({ field: wkey(F.tripFinish), value: fromDate(changes.trip_finish as string) });
      if ("close_date" in changes) actions.push({ field: wkey(F.closeDate), value: fromDate(changes.close_date as string) });
      if ("client_type" in changes) {
        const v = fromClientType(changes.client_type as string);
        actions.push({ field: wkey(F.clientType), value: v ? [v] : [] });
      }
      if ("source" in changes) {
        const v = fromSource(changes.source as string);
        actions.push({ field: wkey(F.source), value: v ? [v] : [] });
      }
      if (!actions.length) return json({ ok: true, skipped: "no_fields" });

      await updateRecord(lead.nethunt_record_id, actions);
      const fresh = await fetchRecord(DEALS_FOLDER, lead.nethunt_record_id);
      await sb.from("leads").update({
        nethunt_updated_at: fresh ? recUpdatedAt(fresh) : now,
        nethunt_synced_at: now,
      } as never).eq("id", lead.id);
      await logSync(sb, [{ direction: "push", entity: "lead", entity_id: lead.id, nethunt_record_id: lead.nethunt_record_id, action: "update", detail: { fields: actions.map((a) => a.field) } }]);
      return json({ ok: true });
    }

    if (entity === "comment") {
      if (!id) throw new Error("lead id required");
      const text = String(changes.text ?? "").trim();
      if (!text) throw new Error("text required");
      const { data } = await sb.from("leads").select("id, nethunt_record_id").eq("id", id).maybeSingle();
      const lead = data as { id: string; nethunt_record_id: string | null } | null;
      if (!lead?.nethunt_record_id) throw new Error("Lead sem record NetHunt associado");
      await createComment(lead.nethunt_record_id, text);
      await sb.from("nethunt_timeline").upsert({
        lead_id: lead.id,
        nethunt_record_id: lead.nethunt_record_id,
        event_id: `local-comment:${lead.id}:${Date.now()}`,
        event_type: "comment",
        event_time: now,
        creator_email: changes.author_email ?? null,
        creator_name: changes.author_name ?? null,
        snippet: text.slice(0, 300),
        body_html: text,
        payload: { local: true, text },
        synced_at: now,
      } as never, { onConflict: "event_id" });
      await logSync(sb, [{ direction: "push", entity: "comment", entity_id: lead.id, nethunt_record_id: lead.nethunt_record_id, action: "create" }]);
      return json({ ok: true });
    }

    if (entity === "task_create") {
      const title = String(changes.title ?? "").trim();
      if (!title) throw new Error("title required");
      let links: string[] = [];
      let leadId: string | null = (changes.lead_id as string) ?? null;
      if (leadId) {
        const { data } = await sb.from("leads").select("nethunt_record_id").eq("id", leadId).maybeSingle();
        const rid = (data as { nethunt_record_id: string | null } | null)?.nethunt_record_id;
        if (rid) links = [rid];
      }
      const dueAt = (changes.due_at as string) ?? null;
      const fields: Record<string, unknown> = {
        [wkey(TF.name)]: title,
        [wkey(TF.description)]: changes.description ?? "",
        [wkey(TF.priority)]: PRIORITY_OUT[String(changes.priority ?? "medium")] ?? "Medium",
        [wkey(TF.completed)]: false,
        [wkey(TF.allDay)]: Boolean(changes.all_day),
      };
      if (dueAt) fields[wkey(TF.dueDate)] = fromDateTime(dueAt);
      if (Array.isArray(changes.assignee_emails) && changes.assignee_emails.length) fields[wkey(TF.assignee)] = changes.assignee_emails;
      if (links.length) fields[wkey(TF.recordLinks)] = links;

      const created = await createRecord(TASKS_FOLDER, fields);
      const rid = created ? recId(created) : null;
      const { data: ins } = await sb.from("tasks").insert({
        title,
        description: String(changes.description ?? ""),
        priority: String(changes.priority ?? "medium"),
        status: "todo",
        completed: false,
        all_day: Boolean(changes.all_day),
        due_at: dueAt,
        due_date: dueAt ? dueAt.slice(0, 10) : null,
        assignee_emails: (changes.assignee_emails as string[]) ?? [],
        creator_email: (changes.creator_email as string) ?? null,
        lead_id: leadId,
        team: String(changes.team ?? "sales"),
        nethunt_record_id: rid,
        nethunt_record_links: links,
        nethunt_updated_at: created ? recUpdatedAt(created) : now,
        nethunt_synced_at: now,
      } as never).select("id").maybeSingle();
      await logSync(sb, [{ direction: "push", entity: "task", entity_id: (ins as { id: string } | null)?.id ?? null, nethunt_record_id: rid, action: "create" }]);
      return json({ ok: true, task_id: (ins as { id: string } | null)?.id ?? null });
    }

    if (entity === "task" || entity === "task_complete") {
      if (!id) throw new Error("task id required");
      const { data } = await sb.from("tasks").select("id, nethunt_record_id").eq("id", id).maybeSingle();
      const task = data as { id: string; nethunt_record_id: string | null } | null;
      if (!task) throw new Error("Task não encontrada");

      const patch: Record<string, unknown> = { nethunt_synced_at: now };
      const actions: FieldAction[] = [];
      if (entity === "task_complete" || "completed" in changes) {
        const done = entity === "task_complete" ? changes.completed !== false : Boolean(changes.completed);
        patch.completed = done;
        patch.status = done ? "done" : "todo";
        actions.push({ field: wkey(TF.completed), value: done });
      }
      if ("title" in changes) { patch.title = changes.title; actions.push({ field: wkey(TF.name), value: changes.title }); }
      if ("description" in changes) { patch.description = changes.description; actions.push({ field: wkey(TF.description), value: changes.description }); }
      if ("priority" in changes) {
        patch.priority = changes.priority;
        actions.push({ field: wkey(TF.priority), value: PRIORITY_OUT[String(changes.priority)] ?? "Medium" });
      }
      if ("due_at" in changes) {
        patch.due_at = changes.due_at;
        patch.due_date = changes.due_at ? String(changes.due_at).slice(0, 10) : null;
        actions.push({ field: wkey(TF.dueDate), value: fromDateTime(changes.due_at as string) });
      }
      if ("all_day" in changes) { patch.all_day = Boolean(changes.all_day); actions.push({ field: wkey(TF.allDay), value: Boolean(changes.all_day) }); }
      if ("assignee_emails" in changes) {
        patch.assignee_emails = changes.assignee_emails;
        actions.push({ field: wkey(TF.assignee), value: changes.assignee_emails ?? [] });
      }

      await sb.from("tasks").update(patch as never).eq("id", task.id);
      if (task.nethunt_record_id && actions.length) {
        await updateRecord(task.nethunt_record_id, actions);
        const fresh = await fetchRecord(TASKS_FOLDER, task.nethunt_record_id);
        if (fresh) await sb.from("tasks").update({ nethunt_updated_at: recUpdatedAt(fresh) } as never).eq("id", task.id);
      }
      await logSync(sb, [{ direction: "push", entity: "task", entity_id: task.id, nethunt_record_id: task.nethunt_record_id, action: "update", status: task.nethunt_record_id ? "ok" : "local_only" }]);
      return json({ ok: true });
    }

    throw new Error(`entity inválida: ${entity}`);
  } catch (e) {
    console.error("nethunt-push error:", e);
    await logSync(sb, [{ direction: "push", entity: "unknown", action: "error", status: "error", detail: { message: (e as Error).message } }]);
    return json({ ok: false, error: (e as Error).message }, 400);
  }
});
