import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, resolveLead } from "../lead";

export default defineTool({
  name: "update_trip_briefing",
  title: "Update the operational trip briefing",
  description:
    "Store the operational briefing of a trip: pickup hotel, arrival and departure flights, on-site contacts, and special requests. Only the fields sent are changed; the others keep their current value. Read it back with get_operations.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    pickup_hotel: z.string().optional().describe("Hotel or address where the guide picks the clients up."),
    pickup_time: z.string().optional().describe("Pickup time, HH:MM."),
    arrival_flight: z.string().optional().describe("Arrival flight, e.g. 'TP1234 LIS 12:40, 14 Mai'."),
    departure_flight: z.string().optional().describe("Departure flight."),
    on_site_contacts: z.string().optional().describe("Phone numbers / contacts on the ground."),
    special_requests: z.string().optional().describe("Dietary needs, mobility, celebrations, anything the guide must know."),
    notes: z.string().optional().describe("Free operational notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, ...fields }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });

    const current = ((lead as any).trip_briefing ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;
    if (!Object.keys(patch).length) throw new ToolError("Send at least one briefing field to update");
    if (typeof patch.pickup_time === "string" && !/^\d{2}:\d{2}$/.test(patch.pickup_time)) {
      throw new ToolError("pickup_time must be HH:MM");
    }

    const next = { ...current, ...patch, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("leads").update({ trip_briefing: next } as never).eq("id", lead.id);
    if (error) throw new ToolError(error.message);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(patch)) changes[key] = { from: current[key] ?? null, to: patch[key] };
    await auditLead(supabase, ctx, lead, "trip_briefing_updated", changes);

    const payload = { lead: leadLabel(lead), lead_id: lead.id, trip_briefing: next };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
