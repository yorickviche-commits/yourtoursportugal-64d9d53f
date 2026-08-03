import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description:
    "Create an operational or sales task for the signed-in user. Keep titles short and actionable.",
  inputSchema: {
    title: z.string().trim().describe("Short actionable title."),
    description: z.string().optional().describe("Optional details."),
    team: z.string().optional().describe("Team, e.g. sales or ops."),
    priority: z.string().optional().describe("Priority, e.g. low, medium, high, urgent."),
    due_date: z.string().optional().describe("Due date as YYYY-MM-DD."),
    lead_id: z.string().optional().describe("Link to this lead uuid."),
    trip_id: z.string().optional().describe("Link to this trip uuid."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, description, team, priority, due_date, lead_id, trip_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    if (!title.trim()) throw new ToolError("title is required");
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description ?? null,
        team: team ?? null,
        priority: priority ?? null,
        due_date: due_date ?? null,
        lead_id: lead_id ?? null,
        trip_id: trip_id ?? null,
        created_by: ctx.getUserId(),
      })
      .select()
      .single();

    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify({ created: true, task: data }, null, 2) }],
      structuredContent: { task: data },
    };
  },
});
