import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { leadLabel, liveVersion, resolveLead } from "../lead";
import { ACCOMMODATION_DAY, costingTotals, loadCosting, paymentsSummary } from "../costing";

export default defineTool({
  name: "get_costing",
  title: "Get costing",
  description:
    "Read the costing of a lead: lines per day (service, supplier/FSE, unit cost, quantity, pax type, markup, selling price, optional yes/no), totals, margin, total YT, deposited and outstanding. Day 0 is the accommodation block.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to read (default: LIVE version)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, version }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const ver = version ?? liveVersion(lead);

    const days = await loadCosting(supabase, lead, ver);
    const totals = costingTotals(days);
    const deposited = await paymentsSummary(supabase, lead);

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      version: ver,
      days: days.map((d) => ({
        day_number: d.day_number,
        title: d.title,
        is_accommodation_block: d.day_number === ACCOMMODATION_DAY,
        lines: d.items.map((i) => ({
          line_id: i.id,
          description: i.description,
          supplier: i.supplier || null,
          pricing_type: i.pricingType,
          num_adults: i.numAdults,
          price_adults: i.priceAdults,
          num_children: i.numChildren,
          price_children: i.priceChildren,
          net_total: i.netTotal,
          margin_percent: i.marginPercent,
          pvp_total: i.pvpTotal,
          status: i.status,
          optional: i.status === "opcionais",
          is_protocol: !!i.isProtocol,
          is_fixed_rate: !!i.isFixedRate,
        })),
      })),
      totals: {
        ...totals,
        total_yt_eur: totals.pvp_eur,
        deposited_eur: deposited,
        outstanding_eur: Math.round((totals.pvp_eur - deposited) * 100) / 100,
      },
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
