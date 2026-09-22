import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { blankLine, calcLine, costingTotals, loadCosting, saveCostingDay, type CostDay } from "../costing";
import { loadPlan } from "../travelPlan";

/**
 * Same path as the auto-import button in Custos: the day-by-day of the travel
 * plan seeds the costing lines and `auto-fulfill-budget` fills suppliers, net
 * rates and markups from the FSE protocols (with market rates as fallback).
 */
export default defineTool({
  name: "autofill_costing_from_plan",
  title: "Auto-fill costing from the travel plan",
  description:
    "Build or complete the costing of a lead from its travel plan and the FSE protocols, exactly like the auto-import button in Custos. Existing lines keep their id and only empty rates are filled; nothing is deleted. Review the totals and margin afterwards.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to fill (default: LIVE version)."),
    seed_missing_lines: z
      .boolean()
      .optional()
      .describe("Create one costing line per programme item that has none yet (default true)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, version, seed_missing_lines }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const ver = version ?? liveVersion(lead);

    const { plan } = await loadPlan(supabase, lead, ver);
    if (!plan.days.length) throw new ToolError(`Lead ${leadLabel(lead)} has no travel plan on version ${ver} — run generate_travel_plan first`);

    const days = await loadCosting(supabase, lead, ver);
    const byDay = new Map<number, CostDay>(days.map((d) => [d.day_number, d]));
    const pax = Number((lead as any).pax ?? 2);
    const paxChildren = Number((lead as any).pax_children ?? 0);
    let seeded = 0;

    if (seed_missing_lines !== false) {
      for (const day of plan.days) {
        const target =
          byDay.get(day.day_number) ??
          ({ day_number: day.day_number, title: day.title || `Dia ${day.day_number}`, items: [] } as CostDay);
        byDay.set(day.day_number, target);
        const existing = new Set(target.items.map((i) => i.description.trim().toLowerCase()));
        for (const bullet of day.bullets || []) {
          const text = (typeof bullet === "string" ? bullet : bullet?.text || "").replace(/\*\*/g, "").trim();
          if (!text || existing.has(text.toLowerCase())) continue;
          target.items.push(
            blankLine({ description: text, pricingType: "per_person", numAdults: pax, numChildren: paxChildren }),
          );
          existing.add(text.toLowerCase());
          seeded += 1;
        }
      }
    }

    const allDays = [...byDay.values()].sort((a, b) => a.day_number - b.day_number);
    const flat = allDays.flatMap((d, dayIdx) =>
      d.items.map((item, itemIdx) => ({ item, dayIdx, itemIdx, day: d.day_number })),
    );
    const toFill = flat.filter((f) => !f.item.priceAdults);

    let filled = 0;
    if (toFill.length) {
      const { data, error } = await supabase.functions.invoke("auto-fulfill-budget", {
        body: {
          items: toFill.map((f) => ({ description: f.item.description, day: f.day, pricingType: f.item.pricingType })),
          destination: String((lead as any).destination ?? ""),
        },
      });
      if (error) throw new ToolError(error.message);
      if ((data as any)?.error) throw new ToolError(String((data as any).error));

      for (const sug of ((data as any)?.suggestions ?? []) as any[]) {
        const target = toFill[Number(sug.index)];
        if (!target) continue;
        const day = allDays[target.dayIdx];
        day.items[target.itemIdx] = calcLine({
          ...day.items[target.itemIdx],
          supplier: sug.supplier || day.items[target.itemIdx].supplier,
          priceAdults: sug.priceAdults ?? day.items[target.itemIdx].priceAdults,
          pricingType: sug.pricingType || day.items[target.itemIdx].pricingType,
          marginPercent: sug.marginPercent ?? day.items[target.itemIdx].marginPercent,
        });
        filled += 1;
      }
    }

    for (const day of allDays) await saveCostingDay(supabase, lead, ver, day);

    const totals = costingTotals(allDays);
    await auditLead(
      supabase,
      ctx,
      lead,
      "costing_autofilled",
      { costing: { from: `${days.flatMap((d) => d.items).length} lines`, to: `${flat.length} lines` } },
      { version: ver, seeded, filled },
    );

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      version: ver,
      lines_created: seeded,
      lines_priced: filled,
      lines_still_without_price: allDays.flatMap((d) => d.items).filter((i) => !i.priceAdults).length,
      totals,
      margin_below_minimum: totals.pvp_eur > 0 && totals.margin_percent < totals.min_margin_percent,
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
