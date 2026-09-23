import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { loadCosting } from "../costing";
import { enqueueAction } from "../queue";
import { normalizeBookingStatus } from "@/components/leads/opsConstants";
import { eur } from "@/lib/money";

const ptDate = (d?: string | null) => {
  if (!d) return "a confirmar";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("pt-PT");
};

export default defineTool({
  name: "draft_fse_requests",
  title: "Draft supplier (FSE) booking requests — human approval required",
  description:
    "Draft the Portuguese availability/booking request emails to each supplier (FSE) of a lead, in the format the TCC already uses and with the correct YT reference. One queue item per supplier is created in 'Aprovações AI'; no email is sent until a human approves it.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    only_pending: z
      .boolean()
      .optional()
      .describe("Only suppliers whose services are not booked yet (default true)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, only_pending }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const l = lead as any;
    const ref = leadLabel(lead);
    const ver = liveVersion(lead);

    const { data: opsRows } = await supabase
      .from("lead_operations")
      .select("*")
      .eq("lead_id", lead.id)
      .order("day_number", { ascending: true });

    type Service = { supplier: string; day: number; title: string; pax: number; net: number; time: string | null; booked: boolean };
    const services: Service[] = ((opsRows ?? []) as any[]).map((r) => ({
      supplier: String(r.supplier ?? "").trim(),
      day: Number(r.day_number ?? 0),
      title: String(r.activity_title ?? ""),
      pax: Number(r.pax ?? l.pax ?? 0),
      net: Number(r.net_value ?? 0),
      time: r.schedule_time ?? null,
      booked: normalizeBookingStatus(r.booking_status) === "booked",
    }));

    if (!services.length) {
      const costing = await loadCosting(supabase, lead, ver);
      for (const day of costing) {
        for (const item of day.items) {
          if (!item.supplier || item.status === "eliminar") continue;
          services.push({
            supplier: item.supplier.trim(),
            day: day.day_number,
            title: item.description,
            pax: item.numAdults + item.numChildren || Number(l.pax ?? 0),
            net: item.netTotal,
            time: null,
            booked: false,
          });
        }
      }
    }

    const usable = services.filter((s) => s.supplier && (only_pending === false || !s.booked));
    if (!usable.length) throw new ToolError(`No pending supplier services found on ${ref}`);

    const bySupplier = new Map<string, Service[]>();
    for (const s of usable) bySupplier.set(s.supplier, [...(bySupplier.get(s.supplier) ?? []), s]);

    const { data: suppliers } = await supabase.from("suppliers").select("name, email");
    const emailOf = (name: string) =>
      ((suppliers ?? []) as any[]).find((x) => String(x.name ?? "").trim().toLowerCase() === name.toLowerCase())?.email ?? null;

    const items: Record<string, unknown>[] = [];
    for (const [supplier, list] of bySupplier) {
      const lines = list
        .map(
          (s) =>
            `<li><strong>Dia ${s.day}</strong>${s.time ? ` · ${s.time}` : ""} — ${s.title} · ${s.pax} pax${
              s.net ? ` · net previsto ${eur(s.net)}` : ""
            }</li>`,
        )
        .join("\n");
      const subject = `${ref} · Pedido de disponibilidade — ${ptDate(l.travel_dates)} a ${ptDate(l.travel_end_date)}`;
      const html = `<div style="font-family:'Trebuchet MS',sans-serif;font-size:14px;line-height:1.6;color:#0a2540">
<p>Bom dia,</p>
<p>Vimos por este meio pedir <strong>disponibilidade e confirmação</strong> para o seguinte programa:</p>
<p><strong>Referência:</strong> ${ref}<br/>
<strong>Datas:</strong> ${ptDate(l.travel_dates)} a ${ptDate(l.travel_end_date)}<br/>
<strong>Participantes:</strong> ${l.pax ?? "?"} adultos${l.pax_children ? ` + ${l.pax_children} crianças` : ""}</p>
<p><strong>Serviços pedidos:</strong></p>
<ul>
${lines}
</ul>
<p>Agradecemos a confirmação com o número de reserva e as condições aplicáveis.</p>
<p>Obrigado e bom trabalho,<br/><strong>Your Tours Portugal</strong></p>
</div>`;

      const { item, created } = await enqueueAction(supabase, ctx, lead, {
        type: "fse_email",
        title: `${ref} · Pedido FSE — ${supplier}`,
        subtitle: `${list.length} serviço(s)`,
        idempotencyKey: `fse:${supplier.toLowerCase()}:${list.map((s) => `${s.day}-${s.title}`).join("|")}`,
        payload: {
          supplier,
          to: emailOf(supplier),
          subject,
          html,
          services: list,
          missing_email: !emailOf(supplier),
        },
      });
      items.push({ approval_id: item.id, supplier, to: emailOf(supplier), services: list.length, already_queued: !created });
    }

    await auditLead(supabase, ctx, lead, "fse_requests_drafted", {
      fse_requests: { from: null, to: `${items.length} supplier email(s) queued for approval` },
    });

    const payload = {
      lead: ref,
      queued: items.length,
      items,
      suppliers_without_email: items.filter((i) => !i.to).map((i) => i.supplier),
      note: "No email was sent. Each item must be approved in 'Aprovações AI'.",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
