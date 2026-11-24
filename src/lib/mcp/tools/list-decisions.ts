import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { KINDS, SIDES, rpc, withLink } from "../decisions";
export default defineTool({
  name: "list_decisions",
  title: "List 'Precisa de ti' decisions",
  description: "Read the YT Cockpit decision queue (default: open cards), with why, what is prepared, last check, age and whether it is human-approval only.",
  inputSchema: {
    status: z.enum(["open", "snoozed", "approved", "rejected", "auto_closed", "executed", "failed", "all"]).optional().describe("Default open."),
    side: z.enum(SIDES).optional(), kind: z.enum(KINDS).optional(),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    older_than_days: z.number().int().min(0).max(365).optional(),
    updated_since: z.string().optional().describe("ISO timestamp."),
    limit: z.number().int().min(1).max(300).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const lead = a.lead_code ? await resolveLead(db, { lead_code: a.lead_code }, "id") : null;
    const rows = ((await rpc(db, "mcp_list_decisions", { p_status: a.status ?? "open", p_side: a.side ?? null, p_kind: a.kind ?? null, p_lead: lead?.id ?? null, p_older_than_days: a.older_than_days ?? null, p_updated_since: a.updated_since ?? null, p_limit: a.limit ?? 100 })) as any[]).map(withLink);
    return { content: [{ type: "text", text: `${rows.length} decision(s).\n` + JSON.stringify(rows) }], structuredContent: { decisions: rows } };
  },
});
