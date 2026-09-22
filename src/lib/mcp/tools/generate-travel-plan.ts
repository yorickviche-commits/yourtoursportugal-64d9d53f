import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { loadPlan, planPayload, savePlan, type PlanData, type PlanDay } from "../travelPlan";
import { createLeadVersion } from "../versions";

export default defineTool({
  name: "generate_travel_plan",
  title: "Generate the travel plan with AI",
  description:
    "Generate the day-by-day programme of a lead with the same AI generator used by 'Regenerar Tudo' in the Travel Planner. If the LIVE version already has a programme, a NEW version is created and becomes LIVE — the previous one stays readable, nothing is overwritten. Returns the programme plus the warnings to fix before sending it to the client.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    briefing: z.string().optional().describe("Briefing / extra instructions for the AI (client wishes, pace, must-sees)."),
    catalogue_products: z
      .array(z.string())
      .optional()
      .describe("Catalogue product names to include in the programme."),
    force_new_version: z.boolean().optional().describe("Always create a new version, even if the live one is empty."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ lead_id, lead_code, briefing, catalogue_products, force_new_version }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const l = lead as any;
    const liveVer = liveVersion(lead);

    const current = await loadPlan(supabase, lead, liveVer);
    const newVersionNeeded = force_new_version === true || !current.isEmpty;
    const targetVersion = newVersionNeeded ? await createLeadVersion(supabase, lead, liveVer) : liveVer;

    const extra = [
      briefing?.trim(),
      catalogue_products?.length ? `Include these catalogue products: ${catalogue_products.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data, error } = await supabase.functions.invoke("generate-travel-plan", {
      body: {
        leadData: {
          yt_id: l.yt_id || lead.lead_code,
          client_name: l.client_name,
          destination: l.destination,
          travel_dates: l.travel_dates,
          travel_end_date: l.travel_end_date,
          number_of_days: l.number_of_days,
          pax: l.pax,
          pax_children: l.pax_children,
          language: l.language,
          client_type: l.client_type,
          travel_style: l.travel_style,
          comfort_level: l.comfort_level,
          budget_level: l.budget_level,
          notes: l.notes,
          request: l.request,
        },
        extraInstructions: extra,
        routeMapUrl: l.route_map_url ?? null,
        routeDayMaps: l.route_day_maps ?? null,
      },
    });
    if (error) throw new ToolError(error.message);
    const result = (data as any)?.result;
    if ((data as any)?.error) throw new ToolError(String((data as any).error));
    if (!result?.days?.length) throw new ToolError("The AI generator returned no days — try again with a clearer briefing");

    const plan: PlanData = {
      trip_title: String(result.trip_title ?? ""),
      narrative: String(result.narrative ?? ""),
      cover_image: result.cover_image ?? current.plan.cover_image ?? null,
      brand_logo: result.brand_logo ?? current.plan.brand_logo ?? null,
      days: (result.days as PlanDay[]).map((d, i) => ({ ...d, day_number: d.day_number ?? i + 1 })),
    };

    await savePlan(supabase, lead, targetVersion, plan, current.meta, {
      clientName: String(l.client_name ?? ""),
      pax: Number(l.pax ?? 0),
      paxChildren: Number(l.pax_children ?? 0),
      language: String(l.language ?? "EN"),
      travelDates: l.travel_dates,
      travelEndDate: l.travel_end_date,
      leadCode: String(l.yt_id || lead.lead_code),
    });

    await auditLead(
      supabase,
      ctx,
      lead,
      "travel_plan_generated",
      { travel_plan: { from: `V${liveVer} (${current.plan.days.length} days)`, to: `V${targetVersion} (${plan.days.length} days)` } },
      { new_version_created: newVersionNeeded },
    );

    const payload = {
      ...(await planPayload(supabase, lead, targetVersion, plan)),
      new_version_created: newVersionNeeded,
      previous_version: liveVer,
      live_version: targetVersion,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
