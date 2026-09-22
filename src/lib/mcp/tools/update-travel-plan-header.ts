import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { loadPlan, planPayload, savePlan } from "../travelPlan";

export default defineTool({
  name: "update_travel_plan_header",
  title: "Update the programme header",
  description:
    "Update the header of the travel plan: title, subtitle/tagline, summary text and cover image. Same effect as editing the top of the Travel Planner, reflected in the digital itinerary and in the PDF.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to edit (default: LIVE version)."),
    title: z.string().optional().describe("Programme title."),
    summary: z.string().optional().describe("Programme summary / narrative."),
    cover_image_url: z.string().url().optional().describe("Cover image URL."),
    cover_image_caption: z.string().optional().describe("Cover image caption."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, version, title, summary, cover_image_url, cover_image_caption }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    if (!title && !summary && !cover_image_url && !cover_image_caption) {
      throw new ToolError("Send at least one header field to update");
    }
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const l = lead as any;
    const ver = version ?? liveVersion(lead);

    const { plan, meta } = await loadPlan(supabase, lead, ver);
    const next = {
      ...plan,
      trip_title: title ?? plan.trip_title,
      narrative: summary ?? plan.narrative,
      cover_image:
        cover_image_url || cover_image_caption
          ? { url: cover_image_url ?? plan.cover_image?.url ?? "", caption: cover_image_caption ?? plan.cover_image?.caption }
          : plan.cover_image,
    };

    await savePlan(supabase, lead, ver, next, meta, {
      clientName: String(l.client_name ?? ""),
      pax: Number(l.pax ?? 0),
      paxChildren: Number(l.pax_children ?? 0),
      language: String(l.language ?? "EN"),
      travelDates: l.travel_dates,
      travelEndDate: l.travel_end_date,
      leadCode: String(l.yt_id || lead.lead_code),
    });

    await auditLead(supabase, ctx, lead, "travel_plan_header_updated", {
      title: { from: plan.trip_title, to: next.trip_title },
      summary: { from: plan.narrative ? `${plan.narrative.slice(0, 60)}…` : null, to: next.narrative ? `${next.narrative.slice(0, 60)}…` : null },
      cover_image: { from: plan.cover_image?.url ?? null, to: next.cover_image?.url ?? null },
    }, { version: ver });

    const payload = { lead: leadLabel(lead), ...(await planPayload(supabase, lead, ver, next)) };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
