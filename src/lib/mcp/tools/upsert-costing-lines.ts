import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import {
  assertMinimumMargin,
  blankLine,
  calcLine,
  costingTotals,
  loadCosting,
  saveCostingDay,
  type CostLine,
} from "../costing";

const lineSchema = z.object({
  day_number: z.number().int().min(0).describe("Day of the programme (0 = accommodation block)."),
  day_title: z.string().optional().describe("Day title, used when the day row does not exist yet."),
  line_id: z.string().optional().describe("Existing line id — omit to create a new line."),
  description: z.string().optional().describe("Service description."),
  supplier: z.string().optional().describe("Supplier / FSE name."),
  pricing_type: z.enum(["total", "per_person", "per_night"]).optional().describe("How the net price is expressed."),
  num_adults: z.number().optional().describe("Adults (or number of nights when pricing_type is per_night)."),
  price_adults: z.number().optional().describe("Net price per adult, per night, or the net total."),
  num_children: z.number().optional().describe("Children."),
  price_children: z.number().optional().describe("Net price per child."),
  margin_percent: z.number().min(0).max(300).optional().describe("Markup percentage applied to the net cost."),
  status: z.enum(["neutro", "aceite", "eliminar", "opcionais"]).optional().describe("Line state; 'opcionais' keeps it out of the base totals."),
});

export default defineTool({
  name: "upsert_costing_lines",
  title: "Create or update costing lines",
  description:
    "Create or update costing lines of a lead, exactly like editing the Custos table in the TCC. Totals and profit are recalculated with the same arithmetic. The save is refused when the resulting margin drops below the company minimum, and the answer flags when the file needs CEO approval because it is above the approval threshold.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to edit (default: LIVE version)."),
    lines: z.array(lineSchema).min(1).describe("Lines to create or update."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, version, lines }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const ver = version ?? liveVersion(lead);

    const days = await loadCosting(supabase, lead, ver);
    const byDay = new Map(days.map((d) => [d.day_number, d]));
    const touched = new Set<number>();
    const created: string[] = [];
    const updated: string[] = [];

    for (const input of lines) {
      let day = byDay.get(input.day_number);
      if (!day) {
        day = { day_number: input.day_number, title: input.day_title || "", items: [] };
        byDay.set(input.day_number, day);
      } else if (input.day_title) {
        day.title = input.day_title;
      }
      touched.add(input.day_number);

      const patch: Partial<CostLine> = {
        description: input.description,
        supplier: input.supplier,
        pricingType: input.pricing_type,
        numAdults: input.num_adults,
        priceAdults: input.price_adults,
        numChildren: input.num_children,
        priceChildren: input.price_children,
        marginPercent: input.margin_percent,
        status: input.status,
      };
      for (const k of Object.keys(patch) as (keyof CostLine)[]) {
        if (patch[k] === undefined) delete patch[k];
      }

      const idx = input.line_id ? day.items.findIndex((i) => i.id === input.line_id) : -1;
      if (input.line_id && idx === -1) {
        throw new ToolError(
          `Line "${input.line_id}" not found on day ${input.day_number}. Valid ids: ${
            day.items.map((i) => i.id).join(", ") || "(day has no lines)"
          }`,
        );
      }
      if (idx >= 0) {
        day.items[idx] = calcLine({ ...day.items[idx], ...patch } as CostLine);
        updated.push(day.items[idx].id);
      } else {
        if (!patch.description) throw new ToolError("New costing lines need a description");
        const line = blankLine(patch);
        day.items.push(line);
        created.push(line.id);
      }
    }

    const allDays = [...byDay.values()].sort((a, b) => a.day_number - b.day_number);
    const totals = costingTotals(allDays);
    assertMinimumMargin(totals);

    for (const dayNumber of touched) await saveCostingDay(supabase, lead, ver, byDay.get(dayNumber)!);

    await auditLead(
      supabase,
      ctx,
      lead,
      "costing_updated",
      { costing_lines: { from: `${days.flatMap((d) => d.items).length} lines`, to: `${allDays.flatMap((d) => d.items).length} lines` } },
      { version: ver, created_line_ids: created, updated_line_ids: updated },
    );

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      version: ver,
      created_line_ids: created,
      updated_line_ids: updated,
      totals,
      requires_ceo_approval: totals.requires_ceo_approval,
      note: totals.requires_ceo_approval
        ? `Total above ${totals.ceo_threshold_eur} EUR — needs CEO approval before going to the client.`
        : null,
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
