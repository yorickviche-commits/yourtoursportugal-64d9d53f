import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_task",
  title: "Update task",
  description:
    "Update an existing task. Provide task_id plus only the fields to change, e.g. set status to done.",
  inputSchema: {
    task_id: z.string().describe("Task uuid to update."),
    status: z
      .enum(["todo", "in_progress", "blocked", "done"])
      .optional()
      .describe("New status: todo, in_progress, blocked or done."),
    title: z.string().optional().describe("New short actionable title."),
    description: z.string().optional().describe("New details."),
    due_date: z.string().optional().describe("Due date as YYYY-MM-DD."),
    priority: z.string().optional().describe("Priority, e.g. low, medium, high, urgent."),
    team: z.string().optional().describe("Team, e.g. sales or ops."),
    assigned_to: z.string().optional().describe("Assignee name or identifier."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id, status, title, description, due_date, priority, team, assigned_to }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    if (!task_id?.trim()) throw new ToolError("task_id is required");
    const supabase = supabaseForUser(ctx);

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (due_date !== undefined) updates.due_date = due_date;
    if (priority !== undefined) updates.priority = priority;
    if (team !== undefined) updates.team = team;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;

    if (Object.keys(updates).length === 0) throw new ToolError("Provide at least one field to update");
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", task_id.trim())
      .select()
      .single();

    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Task not found or not accessible");

    return {
      content: [{ type: "text", text: JSON.stringify({ updated: true, task: data }, null, 2) }],
      structuredContent: { task: data },
    };
  },
});
