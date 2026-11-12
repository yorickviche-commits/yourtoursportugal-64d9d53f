import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { VALIDATION, fail, json } from "../finance";
export default defineTool({
  name: "list_finance_batch",
  title: "List finance batch",
  description: "Read finance batch items by date and validation status (e.g. approved items ready to issue).",
  inputSchema: { batch_date: z.string().optional().describe("YYYY-MM-DD."), validation_status: z.enum(VALIDATION).optional(), limit: z.number().int().min(1).max(500).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    let q = supabaseForUser(ctx).from("finance_batch_items").select("*").order("created_at", { ascending: false }).limit(a.limit ?? 200);
    if (a.batch_date) q = q.eq("batch_date", a.batch_date);
    if (a.validation_status) q = q.eq("validation_status", a.validation_status);
    const { data, error } = await q; fail(error);
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { items: json(data) } };
  },
});
