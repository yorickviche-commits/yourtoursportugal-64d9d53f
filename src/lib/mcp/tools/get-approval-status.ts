import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { queueSummary, type QueueRow } from "../queue";

export default defineTool({
  name: "get_approval_status",
  title: "Get AI approval status",
  description:
    "Check what happened to one item of the AI approval queue: still pending, approved, rejected, executed (with the result, such as the payment link URL or the sent email) or failed (with the error).",
  inputSchema: {
    approval_id: z.string().uuid().describe("Id returned when the action was queued."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ approval_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("ai_action_queue")
      .select("*")
      .eq("id", approval_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError(`Approval item ${approval_id} not found or not accessible`);

    const row = data as unknown as QueueRow;
    const payload = { ...queueSummary(row), result: row.result ?? null, payload: row.payload };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
