import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { rpc } from "../decisions";
const diff = (b: any, a: any) => {
  if (!b || !a || typeof b !== "object" || typeof a !== "object") return null;
  return Object.keys({ ...b, ...a }).filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => `${k}: ${String(b[k] ?? "").slice(0, 120)} → ${String(a[k] ?? "").slice(0, 120)}`).join(" | ");
};
export default defineTool({
  name: "list_decision_updates",
  title: "List human decisions since",
  description: "What humans decided on queue cards since a date: approved, rejected (with note), edited (diff summary), snoozed, executed/failed. Use it to learn and avoid re-proposing rejected work.",
  inputSchema: { since: z.string().describe("ISO date/time."), limit: z.number().int().min(1).max(500).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ since, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const rows = ((await rpc(supabaseForUser(ctx), "mcp_decision_updates", { p_since: since, p_limit: limit ?? 200 })) as any[])
      .map(({ before, after, ...r }) => ({ ...r, edit_summary: r.action === "edit" ? diff(before, after) : null }));
    return { content: [{ type: "text", text: `${rows.length} update(s).\n` + JSON.stringify(rows) }], structuredContent: { updates: rows } };
  },
});
