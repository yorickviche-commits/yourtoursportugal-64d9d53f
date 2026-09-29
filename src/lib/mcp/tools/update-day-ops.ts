import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, resolveLead } from "../lead";

export default defineTool({
  name: "update_day_ops",
  title: "Update day operations data",
  description:
    "Set the per-day operational data of a lead (guide, vehicle, pick-up/drop-off, back-office and guide notes, guide payment). Used to build the Google Calendar event. Only the fields given are changed.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    day_number: z.number().int().min(1).max(60).describe("Trip day number (1 = first day)."),
    guide_name: z.string().max(200).optional(),
    vehicle: z.string().max(200).optional(),
    vehicle_pickup: z.string().max(300).optional(),
    pickup_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe("HH:MM"),
    pickup_location: z.string().max(300).optional(),
    pickup_maps_url: z.string().url().optional(),
    dropoff_location: z.string().max(300).optional(),
    dropoff_maps_url: z.string().url().optional(),
    notes_backoffice: z.string().max(4000).optional().describe("One note per line."),
    notes_guide: z.string().max(4000).optional().describe("One note per line."),
    guide_payment_amount: z.number().min(0).optional().describe("EUR"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const { lead_id, lead_code, day_number, ...fields } = args;
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (!Object.keys(changes).length) throw new ToolError("No fields to update");

    const { error } = await supabase
      .from("lead_day_ops")
      .upsert({ lead_id: lead.id, day_number, ...changes, updated_at: new Date().toISOString() } as any, { onConflict: "lead_id,day_number" });
    if (error) throw new ToolError(error.message);

    await auditLead(supabase, ctx, lead, "day_ops_updated", changes, { day_number });
    const payload = { lead: leadLabel(lead), lead_id: lead.id, day_number, updated_fields: changes };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
