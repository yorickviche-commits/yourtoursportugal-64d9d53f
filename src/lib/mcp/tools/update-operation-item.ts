import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, resolveLead } from "../lead";
import { BOOKING_OPTIONS, INVOICE_OPTIONS, PAYMENT_OPTIONS } from "@/components/leads/opsConstants";

const values = (opts: { value: string }[]) => opts.map((o) => o.value);

export default defineTool({
  name: "update_operation_item",
  title: "Update an operations service",
  description:
    "Update one service on the operations board of a lead: booking status, payment status, invoice status, schedule, supplier, pax, net value, the supplier confirmation number and notes. Uses the same states as the Operações tab.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    item_key: z.string().describe("Service key from get_operations."),
    booking_status: z.enum(["neutral", "sent", "booked"]).optional().describe("Booking state."),
    payment_status: z
      .enum(["neutral", "paid", "partially_paid", "monthly_account", "guide_to_pay", "not_paid"])
      .optional()
      .describe("Payment state."),
    invoice_status: z.enum(["not_received", "guide_pickup", "received"]).optional().describe("Invoice state."),
    schedule_time: z.string().optional().describe("Service time, HH:MM."),
    supplier: z.string().optional().describe("Supplier / FSE name."),
    pax: z.number().int().min(0).optional().describe("Number of participants."),
    net_value: z.number().optional().describe("Agreed net value in EUR."),
    confirmation_number: z.string().optional().describe("Supplier booking confirmation reference."),
    notes: z.string().optional().describe("Operational note for this service."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const { lead_id, lead_code, item_key, confirmation_number, notes, ...rest } = args;
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });

    const { data: row, error: readErr } = await supabase
      .from("lead_operations")
      .select("*")
      .eq("lead_id", lead.id)
      .eq("item_key", item_key)
      .maybeSingle();
    if (readErr) throw new ToolError(readErr.message);
    if (!row) {
      const { data: keys } = await supabase.from("lead_operations").select("item_key").eq("lead_id", lead.id);
      throw new ToolError(
        `Service "${item_key}" not found on ${leadLabel(lead)}. Valid keys: ${
          ((keys ?? []) as any[]).map((k) => k.item_key).join(", ") || "(no services yet)"
        }`,
      );
    }

    if (rest.booking_status && !values(BOOKING_OPTIONS).includes(rest.booking_status)) {
      throw new ToolError(`Invalid booking_status. Valid: ${values(BOOKING_OPTIONS).join(", ")}`);
    }
    if (rest.payment_status && !values(PAYMENT_OPTIONS).includes(rest.payment_status)) {
      throw new ToolError(`Invalid payment_status. Valid: ${values(PAYMENT_OPTIONS).join(", ")}`);
    }
    if (rest.invoice_status && !values(INVOICE_OPTIONS).includes(rest.invoice_status)) {
      throw new ToolError(`Invalid invoice_status. Valid: ${values(INVOICE_OPTIONS).join(", ")}`);
    }
    if (rest.schedule_time && !/^\d{2}:\d{2}(:\d{2})?$/.test(rest.schedule_time)) {
      throw new ToolError("schedule_time must be HH:MM");
    }

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) updates[k] = v;

    if (confirmation_number !== undefined) updates.confirmation_number = confirmation_number;
    if (notes !== undefined) updates.notes = notes;

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(updates)) changes[key] = { from: (row as any)[key] ?? null, to: updates[key] };

    const { error } = await supabase
      .from("lead_operations")
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq("id", (row as any).id);
    if (error) throw new ToolError(error.message);

    await auditLead(supabase, ctx, lead, "operation_updated", changes, { item_key });

    const payload = { lead: leadLabel(lead), lead_id: lead.id, item_key, updated_fields: changes };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
