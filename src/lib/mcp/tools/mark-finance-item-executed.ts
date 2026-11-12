import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail } from "../finance";
export default defineTool({
  name: "mark_finance_item_executed",
  title: "Mark finance item executed",
  description: "Mark a human-approved finance batch item as executed or failed with the issued document reference. Only approved items are accepted.",
  inputSchema: { item_id: z.string(), result: z.enum(["executed", "failed"]), execution_ref: z.string().optional().describe("Issued document number, or failure reason.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ item_id, result, execution_ref }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const cur = await db.from("finance_batch_items").select("validation_status").eq("id", item_id).maybeSingle(); fail(cur.error);
    if (!cur.data) throw new ToolError("Item not found");
    if (cur.data.validation_status !== "approved") throw new ToolError(`Item is ${cur.data.validation_status}; only items approved by a person can be executed.`);
    const r = await db.from("finance_batch_items").update({ validation_status: result, execution_ref: execution_ref ?? null, executed_at: new Date().toISOString() }).eq("id", item_id).eq("validation_status", "approved"); fail(r.error);
    return { content: [{ type: "text", text: `Item ${item_id} marked ${result}.` }] };
  },
});
