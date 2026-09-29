import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { leadLabel, resolveLead } from "../lead";
import { BOOKING_OPTIONS, INVOICE_OPTIONS, PAYMENT_OPTIONS, normalizeBookingStatus, normalizeInvoiceStatus, normalizePaymentStatus } from "@/components/leads/opsConstants";

export default defineTool({
  name: "get_operations",
  title: "Get operations board",
  description:
    "Read the operations board of a lead: services per day with supplier/FSE, booking status, payment status, invoice status, schedule, pax, net value, and the operational trip briefing (pickup hotel, flights, on-site contacts, special requests).",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });

    const { data, error } = await supabase
      .from("lead_operations")
      .select("*")
      .eq("lead_id", lead.id)
      .order("day_number", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new ToolError(error.message);

    const { data: dayOps } = await supabase
      .from("lead_day_ops")
      .select("day_number, guide_name, vehicle, vehicle_pickup, pickup_time, pickup_location, pickup_maps_url, dropoff_location, dropoff_maps_url, notes_backoffice, notes_guide, guide_payment_amount")
      .eq("lead_id", lead.id)
      .order("day_number", { ascending: true });

    const services = ((data ?? []) as any[]).map((r) => ({
      item_key: r.item_key,
      day_number: r.day_number,
      schedule_time: r.schedule_time,
      schedule_end_time: r.schedule_end_time ?? null,
      service: r.activity_title,
      supplier: r.supplier,
      pax: r.pax,
      net_value_eur: r.net_value,
      real_cost_eur: r.real_cost,
      booking_status: normalizeBookingStatus(r.booking_status),
      payment_status: normalizePaymentStatus(r.payment_status),
      invoice_status: normalizeInvoiceStatus(r.invoice_status),
      invoice_file: r.invoice_file_name,
      source: r.source,
    }));

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      trip_briefing: (lead as any).trip_briefing ?? null,
      service_language: (lead as any).service_language ?? null,
      booking_origin: (lead as any).booking_origin ?? null,
      external_booking_ref: (lead as any).external_booking_ref ?? null,
      day_ops: dayOps ?? [],
      services,
      pending_bookings: services.filter((s) => s.booking_status !== "booked").length,
      valid_statuses: {
        booking: BOOKING_OPTIONS.map((o) => o.value),
        payment: PAYMENT_OPTIONS.map((o) => o.value),
        invoice: INVOICE_OPTIONS.map((o) => o.value),
      },
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
