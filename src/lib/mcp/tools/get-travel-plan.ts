import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { APP_ORIGIN, leadLabel, liveVersion, resolveLead } from "../lead";

const strip = (s: unknown) => String(s ?? "").replace(/\*\*/g, "").trim();

export default defineTool({
  name: "get_travel_plan",
  title: "Get travel plan",
  description:
    "Read the commercial programme of a lead: title, summary, day-by-day (date, title, tagline, included items, night at), hotels and the public link of the digital itinerary. Use this to write client emails without opening the TCC.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5104."),
    version: z.number().int().optional().describe("Version to read (default: LIVE version)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, version }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const ver = version ?? liveVersion(lead);

    const { data: proposal, error } = await supabase
      .from("proposals")
      .select("id, version, title, summary_text, participants, date_range, language, days, public_token, closing_terms, total_value_eur, wetravel_checkout_url")
      .eq("lead_id", lead.id)
      .eq("version", ver)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!proposal) throw new ToolError(`No proposal found for ${leadLabel(lead)} version ${ver}`);

    const p = proposal as any;
    const closing = p.closing_terms || {};
    const days = (Array.isArray(p.days) ? p.days : []).map((d: any, i: number) => ({
      day_number: d.day_number ?? i + 1,
      date: d.date_label || d.date || null,
      title: strip(d.title),
      tagline: strip(d.subtitle),
      items: (Array.isArray(d.items) && d.items.length ? d.items : d.highlights || []).map(strip),
      night_at: typeof d.accommodation === "string" ? strip(d.accommodation) : strip(d.accommodation?.hotel_name || d.accommodation?.label),
      map_url: d.map_url || null,
      images: (Array.isArray(d.images) ? d.images : []).filter((im: any) => im?.url).length,
    }));

    const hotels = [
      ...(Array.isArray(closing.accommodation) ? closing.accommodation : []),
      ...(Array.isArray(closing.hotels) ? closing.hotels : []),
    ].map((h: any) => ({
      name: strip(h.name),
      city: strip(h.city) || null,
      nights: Number(h.nights) || null,
      room_type: strip(h.roomType) || null,
    }));

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      version: ver,
      language: p.language || "en",
      title: strip(p.title),
      participants: p.participants || null,
      date_range: p.date_range || null,
      summary: strip(p.summary_text),
      total_value_eur: p.total_value_eur ?? null,
      itinerary_url: p.public_token ? `${APP_ORIGIN}/proposal/${p.public_token}` : null,
      booking_url: p.wetravel_checkout_url || null,
      days,
      hotels,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
