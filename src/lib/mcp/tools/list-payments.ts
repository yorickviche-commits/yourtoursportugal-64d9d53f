import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CHANNELS, PAY_STATUS, fail, json } from "../finance";
export default defineTool({
  name: "list_payments",
  title: "List payments ledger",
  description: "List client payment lines from the TCC payments ledger (Finanças), filtered by file, status, channel or dates.",
  inputSchema: { yt_ref: z.string().optional(), lead_id: z.string().optional(), status: z.enum(PAY_STATUS).optional(), channel: z.enum(CHANNELS).optional(), date_from: z.string().optional().describe("YYYY-MM-DD (created_at)."), date_to: z.string().optional().describe("YYYY-MM-DD (created_at)."), limit: z.number().int().min(1).max(500).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    let q = supabaseForUser(ctx).from("payments_ledger").select("*").order("created_at", { ascending: false }).limit(a.limit ?? 100);
    if (a.yt_ref) q = q.ilike("yt_ref", `%${a.yt_ref.replace(/\D/g, "").slice(-4)}%`);
    if (a.lead_id) q = q.eq("lead_id", a.lead_id);
    if (a.status) q = q.eq("status", a.status);
    if (a.channel) q = q.eq("channel", a.channel);
    if (a.date_from) q = q.gte("created_at", a.date_from);
    if (a.date_to) q = q.lte("created_at", `${a.date_to}T23:59:59`);
    const { data, error } = await q; fail(error);
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { payments: json(data) } };
  },
});
