import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description: "List operational and sales tasks, optionally filtered by status, team or lead.",
  inputSchema: {
    status: z.string().optional().describe("Filter by task status, e.g. todo, doing, done."),
    team: z.string().optional().describe("Filter by team, e.g. sales or ops."),
    lead_id: z.string().optional().describe("Only tasks linked to this lead uuid."),
    limit: z.number().int().optional().describe("Max rows to return (default 50, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, team, lead_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const take = Math.min(Math.max(limit ?? 50, 1), 100);
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("tasks")
      .select("id,title,description,status,priority,team,category,due_date,lead_id,trip_id,assigned_to,updated_at")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(take);

    if (status) query = query.eq("status", status);
    if (team) query = query.eq("team", team);
    if (lead_id) query = query.eq("lead_id", lead_id);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const payload = { total: data?.length ?? 0, tasks: data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
