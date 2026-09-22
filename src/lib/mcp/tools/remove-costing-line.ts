import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { costingTotals, loadCosting, saveCostingDay } from "../costing";

export default defineTool({
  name: "remove_costing_line",
  title: "Remove a costing line",
  description:
    "Remove one line from the costing of a lead, like deleting a row in the Custos table. Only costing lines are affected — leads, versions and travel plans are never deleted by MCP tools.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to edit (default: LIVE version)."),
    day_number: z.number().int().min(0).describe("Day holding the line (0 = accommodation block)."),
    line_id: z.string().describe("Line id from get_costing."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, version, day_number, line_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const ver = version ?? liveVersion(lead);

    const days = await loadCosting(supabase, lead, ver);
    const day = days.find((d) => d.day_number === day_number);
    if (!day) throw new ToolError(`Day ${day_number} has no costing lines for version ${ver}`);
    const line = day.items.find((i) => i.id === line_id);
    if (!line) {
      throw new ToolError(
        `Line "${line_id}" not found on day ${day_number}. Valid ids: ${day.items.map((i) => i.id).join(", ") || "(none)"}`,
      );
    }

    day.items = day.items.filter((i) => i.id !== line_id);
    await saveCostingDay(supabase, lead, ver, day);

    const totals = costingTotals(days);
    await auditLead(
      supabase,
      ctx,
      lead,
      "costing_line_removed",
      { costing_line: { from: `${line.description} (${line.pvpTotal} EUR)`, to: null } },
      { version: ver, day_number, line_id },
    );

    const payload = { lead: leadLabel(lead), lead_id: lead.id, version: ver, removed: line.description, totals };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
