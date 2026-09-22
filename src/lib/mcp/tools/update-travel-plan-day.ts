import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { loadPlan, planPayload, savePlan, type PlanDay } from "../travelPlan";

export default defineTool({
  name: "update_travel_plan_day",
  title: "Edit, add, remove or reorder a programme day",
  description:
    "Edit one day of the travel plan (title, tagline, included items, night at, date, map), or add, remove and reorder days. Writes the same rows as the Travel Planner, so the digital itinerary and the PDF follow immediately.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to edit (default: LIVE version)."),
    action: z.enum(["update", "add", "remove", "move"]).describe("What to do with the day."),
    day_number: z.number().int().min(1).describe("Day to act on (for 'add', the position of the new day)."),
    move_to: z.number().int().min(1).optional().describe("New position when action is 'move'."),
    title: z.string().optional().describe("Day title."),
    tagline: z.string().optional().describe("Day subtitle / tagline."),
    date: z.string().optional().describe("Day date, YYYY-MM-DD."),
    items: z.array(z.string()).optional().describe("Included items ('Itinerary & Included' bullets)."),
    night_at: z.string().optional().describe("Overnight stay (hotel / town)."),
    map_url: z.string().optional().describe("Google Maps route link for this day."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const { lead_id, lead_code, version, action, day_number, move_to } = args;
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const l = lead as any;
    const ver = version ?? liveVersion(lead);

    const { plan, meta } = await loadPlan(supabase, lead, ver);
    const days = [...plan.days].sort((a, b) => a.day_number - b.day_number);
    const idx = days.findIndex((d) => d.day_number === day_number);

    const apply = (day: PlanDay): PlanDay => ({
      ...day,
      title: args.title ?? day.title,
      subtitle: args.tagline ?? day.subtitle,
      date: args.date ?? day.date,
      bullets: args.items ?? day.bullets,
      overnight: args.night_at ?? day.overnight,
      mapUrl: args.map_url ?? day.mapUrl,
    });

    if (action === "update") {
      if (idx === -1) throw new ToolError(`Day ${day_number} does not exist. Existing days: ${days.map((d) => d.day_number).join(", ") || "(none)"}`);
      days[idx] = apply(days[idx]);
    } else if (action === "add") {
      const fresh: PlanDay = apply({ day_number, title: "", bullets: [] });
      days.splice(Math.min(Math.max(day_number - 1, 0), days.length), 0, fresh);
    } else if (action === "remove") {
      if (idx === -1) throw new ToolError(`Day ${day_number} does not exist`);
      days.splice(idx, 1);
    } else {
      if (idx === -1) throw new ToolError(`Day ${day_number} does not exist`);
      if (!move_to) throw new ToolError("move_to is required when action is 'move'");
      const [moved] = days.splice(idx, 1);
      days.splice(Math.min(Math.max(move_to - 1, 0), days.length), 0, moved);
    }

    const renumbered = days.map((d, i) => ({ ...d, day_number: i + 1 }));
    const next = { ...plan, days: renumbered };

    await savePlan(supabase, lead, ver, next, meta, {
      clientName: String(l.client_name ?? ""),
      pax: Number(l.pax ?? 0),
      paxChildren: Number(l.pax_children ?? 0),
      language: String(l.language ?? "EN"),
      travelDates: l.travel_dates,
      travelEndDate: l.travel_end_date,
      leadCode: String(l.yt_id || lead.lead_code),
    });

    await auditLead(supabase, ctx, lead, "travel_plan_day_updated", {
      [`day_${day_number}`]: { from: `${plan.days.length} days`, to: `${renumbered.length} days (${action})` },
    }, { version: ver, action });

    const payload = { lead: leadLabel(lead), action, ...(await planPayload(supabase, lead, ver, next)) };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
