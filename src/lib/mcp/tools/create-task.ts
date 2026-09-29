import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description:
    "Create an operational or sales task for the signed-in user. Keep titles short and actionable. Link it to a lead with lead_id (uuid) or lead_code/yt_id (e.g. YT4794); tasks on leads linked to NetHunt are created in NetHunt automatically.",
  inputSchema: {
    title: z.string().trim().describe("Short actionable title."),
    description: z.string().optional().describe("Optional details."),
    team: z.string().optional().describe("Team, e.g. sales or ops."),
    priority: z.string().optional().describe("Priority, e.g. low, medium, high, urgent."),
    due_date: z.string().optional().describe("Due date as YYYY-MM-DD."),
    lead_id: z.string().optional().describe("Link to this lead uuid."),
    lead_code: z.string().optional().describe("Link to this lead by code, e.g. YT4794."),
    yt_id: z.string().optional().describe("Alias of lead_code."),
    trip_id: z.string().optional().describe("Link to this trip uuid."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, description, team, priority, due_date, lead_id, lead_code, yt_id, trip_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    if (!title.trim()) throw new ToolError("title is required");
    const supabase = supabaseForUser(ctx);

    let leadId: string | null = null;
    let leadRid: string | null = null;
    const code = lead_code ?? yt_id;
    if (lead_id || code) {
      const lead = await resolveLead(supabase, { lead_id, lead_code: lead_id ? undefined : code }, "id, nethunt_record_id");
      leadId = lead.id;
      leadRid = lead.nethunt_record_id;
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description ?? null,
        team: team ?? null,
        priority: priority ?? null,
        due_date: due_date ?? null,
        lead_id: leadId,
        trip_id: trip_id ?? null,
        created_by: ctx.getUserId(),
      })
      .select()
      .single();

    if (error) throw new ToolError(error.message);

    // The DB trigger enqueues the NetHunt creation; wait briefly for the worker to link it.
    let task = data as Record<string, unknown>;
    if (leadRid) {
      for (let i = 0; i < 4 && !task.nethunt_record_id; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const { data: fresh } = await supabase.from("tasks").select("*").eq("id", task.id as string).maybeSingle();
        if (fresh) task = fresh as Record<string, unknown>;
      }
    }
    const nethunt_sync = !leadRid
      ? { status: "not_linked" }
      : task.nethunt_record_id
        ? { status: "synced", nethunt_record_id: task.nethunt_record_id }
        : { status: "queued" };

    return {
      content: [{ type: "text", text: JSON.stringify({ created: true, task, nethunt_sync }, null, 2) }],
      structuredContent: { task, nethunt_sync },
    };
  },
});
