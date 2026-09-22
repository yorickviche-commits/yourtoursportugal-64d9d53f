import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { loadPlan, planPayload, savePlan, type PlanImage } from "../travelPlan";

export default defineTool({
  name: "fill_travel_plan_images",
  title: "Fill programme images",
  description:
    "Fill the missing images of the programme (cover and each day) with the same image search used by 'Preencher Imagens (AI)' in the Travel Planner. Days that already have images are left untouched unless overwrite is set.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to fill (default: LIVE version)."),
    images_per_day: z.number().int().min(1).max(3).optional().describe("Images per day (default 2)."),
    overwrite: z.boolean().optional().describe("Replace images that already exist (default false)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async ({ lead_id, lead_code, version, images_per_day, overwrite }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const l = lead as any;
    const ver = version ?? liveVersion(lead);
    const count = images_per_day ?? 2;

    const { plan, meta } = await loadPlan(supabase, lead, ver);
    if (!plan.days.length) throw new ToolError(`Lead ${leadLabel(lead)} has no travel plan on version ${ver}`);

    const search = async (query: string, n: number): Promise<PlanImage[]> => {
      const { data, error } = await supabase.functions.invoke("search-destination-images", {
        body: { query, count: n, mode: "search" },
      });
      if (error) return [];
      return (((data as any)?.images ?? []) as any[])
        .filter((i) => i?.url)
        .slice(0, n)
        .map((i) => ({ url: i.url, caption: i.caption || query }));
    };

    const destination = String(l.destination ?? "Portugal");
    let filledDays = 0;
    const failures: string[] = [];

    if (overwrite || !plan.cover_image?.url) {
      const cover = await search(`${plan.trip_title || destination} Portugal landscape`, 1);
      if (cover[0]) plan.cover_image = cover[0];
      else failures.push("cover image");
    }

    for (const day of plan.days) {
      const has = (day.images ?? []).filter((i) => i?.url);
      if (!overwrite && has.length >= count) continue;
      const found = await search(`${day.title || destination} ${destination} Portugal`, count);
      if (!found.length) {
        failures.push(`Day ${day.day_number}`);
        continue;
      }
      day.images = overwrite ? found : [...has, ...found].slice(0, count);
      filledDays += 1;
    }

    await savePlan(supabase, lead, ver, plan, meta, {
      clientName: String(l.client_name ?? ""),
      pax: Number(l.pax ?? 0),
      paxChildren: Number(l.pax_children ?? 0),
      language: String(l.language ?? "EN"),
      travelDates: l.travel_dates,
      travelEndDate: l.travel_end_date,
      leadCode: String(l.yt_id || lead.lead_code),
    });

    await auditLead(supabase, ctx, lead, "travel_plan_images_filled", {
      images: { from: "missing", to: `${filledDays} days filled` },
    }, { version: ver });

    const payload = {
      lead: leadLabel(lead),
      days_filled: filledDays,
      days_without_images: failures,
      ...(await planPayload(supabase, lead, ver, plan)),
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
