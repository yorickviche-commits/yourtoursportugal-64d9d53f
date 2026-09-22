import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { queueSummary, type QueueRow } from "../queue";

export default defineTool({
  name: "list_pending_approvals",
  title: "List AI approval queue",
  description:
    "List the actions waiting for human approval in the TCC (client emails, supplier/FSE emails, payment links). Agents propose these actions; a person approves, edits or rejects them in the 'Aprovações AI' page and only then are they executed.",
  inputSchema: {
    status: z
      .enum(["pending", "approved", "rejected", "executed", "failed"])
      .optional()
      .describe("Filter by status (default: pending)."),
    type: z.enum(["client_email", "fse_email", "payment_link"]).optional().describe("Filter by action type."),
    lead_id: z.string().optional().describe("Only items of this lead (uuid)."),
    lead_code: z.string().optional().describe("Only items of this lead (code such as YT5130)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max items (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, type, lead_id, lead_code, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("ai_action_queue")
      .select("*")
      .eq("status", status ?? "pending")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (type) query = query.eq("type", type);
    if (lead_id || lead_code) {
      const lead = await resolveLead(supabase, { lead_id, lead_code }, "id, lead_code, yt_id, client_name");
      query = query.eq("lead_id", lead.id);
    }

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const items = ((data ?? []) as unknown as QueueRow[]).map((row) => ({
      ...queueSummary(row),
      payload_preview: {
        to: (row.payload as any)?.to ?? null,
        subject: (row.payload as any)?.subject ?? null,
        amount_eur: (row.payload as any)?.amount_eur ?? null,
        attachments: ((row.payload as any)?.attachments ?? []).map((a: any) => a?.filename).filter(Boolean),
      },
    }));

    const payload = { status: status ?? "pending", count: items.length, items };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
