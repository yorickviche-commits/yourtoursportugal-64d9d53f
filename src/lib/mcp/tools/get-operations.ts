import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { leadLabel, resolveLead } from "../lead";
import { buildOpsRows } from "../operations";
import { BOOKING_OPTIONS, INVOICE_OPTIONS, PAYMENT_OPTIONS } from "../../../components/leads/opsConstants";

export default defineTool({
  name: "get_operations",
  title: "Get operations board",
  description:
    "Read the operations board of a lead exactly as the Operações tab shows it (LIVE version planner items, falling back to costing lines, merged with saved operations): services per day with stable item_key, supplier/FSE, schedule, pax, net value, real_cost (Real € = net total confirmed by the FSE, post-confirmation margin control; does not change Custos) and cost deviation real_cost − net_value, booking/payment/invoice status, confirmation number, notes, plus the trip briefing, per-day ops and lead totals (net budgeted, real confirmed, cost deviation). Positive deviation means over budget; negative means under budget.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });

    let built;
    try { built = await buildOpsRows(supabase, lead); } catch (e: any) { throw new ToolError(e.message); }

    const { data: dayOps } = await supabase
      .from("lead_day_ops")
      .select("day_number, guide_name, vehicle, vehicle_pickup, pickup_time, pickup_location, pickup_maps_url, dropoff_location, dropoff_maps_url, notes_backoffice, notes_guide, guide_payment_amount")
      .eq("lead_id", lead.id)
      .order("day_number", { ascending: true });

    const services = built.rows.map(({ op: _op, ...r }) => ({
      item_key: r.item_key,
      day_number: r.day_number,
      schedule_time: r.schedule_time || null,
      schedule_end_time: r.schedule_end_time || null,
      service: r.activity_title,
      supplier: r.supplier || null,
      pax: r.pax,
      net_value_eur: r.net_value,
      real_cost_eur: r.real_cost,
      deviation_eur: r.real_cost != null ? Math.round((r.real_cost - (r.net_value || 0)) * 100) / 100 : null,
      booking_status: r.booking_status,
      payment_status: r.payment_status,
      invoice_status: r.invoice_status,
      invoice_file: r.invoice_file_name,
      confirmation_number: r.confirmation_number,
      notes: r.notes,
      source: r.source,
      saved: r.saved,
    }));

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const confirmed = services.filter((s) => s.real_cost_eur != null);
    const totals = {
      net_budgeted_eur: r2(services.reduce((a, s) => a + (s.net_value_eur || 0), 0)),
      real_confirmed_eur: r2(confirmed.reduce((a, s) => a + (s.real_cost_eur as number), 0)),
      net_budgeted_confirmed_items_eur: r2(confirmed.reduce((a, s) => a + (s.net_value_eur || 0), 0)),
      deviation_eur: r2(confirmed.reduce((a, s) => a + (s.deviation_eur as number), 0)),
      services_with_real_cost: confirmed.length,
    };

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      version: built.version,
      trip_briefing: (lead as any).trip_briefing ?? null,
      service_language: (lead as any).service_language ?? null,
      booking_origin: (lead as any).booking_origin ?? null,
      external_booking_ref: (lead as any).external_booking_ref ?? null,
      day_ops: dayOps ?? [],
      total_services: services.length,
      totals,
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
