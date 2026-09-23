import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, liveVersion, resolveLead } from "../lead";
import { costingTotals, loadCosting } from "../costing";
import { enqueueAction } from "../queue";

const KINDS = {
  deposit_25: 0.25,
  deposit_50: 0.5,
  full: 1,
} as const;

export default defineTool({
  name: "request_payment_link",
  title: "Request a payment link (human approval required)",
  description:
    "Propose a WeTravel payment link for a lead. The link is NOT created here: the request is placed in the 'Aprovações AI' queue with the amount, deposit and description. When a person approves it, the existing 'Criar link de pagamento' logic runs and the link is saved on the lead. Amounts default to the base selling price (optionals excluded), as in the UI.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    kind: z
      .enum(["deposit_25", "deposit_50", "full", "optionals", "custom"])
      .describe("What to charge: 25% deposit, 50% deposit, full amount, the optionals, or a custom amount."),
    amount_eur: z.number().positive().optional().describe("Amount in EUR — required for 'custom', otherwise computed."),
    description: z.string().optional().describe("Description shown to the client on the checkout page."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, kind, amount_eur, description }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const l = lead as any;
    const ver = liveVersion(lead);

    const totals = costingTotals(await loadCosting(supabase, lead, ver));
    let amount = amount_eur ?? 0;
    if (kind === "custom") {
      if (!amount_eur) throw new ToolError("amount_eur is required when kind is 'custom'");
    } else if (kind === "optionals") {
      amount = totals.optionals_pvp_eur;
      if (!amount) throw new ToolError("This lead has no optional lines in the costing");
    } else {
      if (!totals.pvp_eur) throw new ToolError("The costing has no selling price yet — fill the costing first");
      amount = Math.round(totals.pvp_eur * KINDS[kind] * 100) / 100;
    }

    const { data: proposal } = await supabase
      .from("proposals")
      .select("id, title")
      .eq("lead_id", lead.id)
      .eq("version", ver)
      .maybeSingle();

    const title = `${leadLabel(lead)} · ${l.client_name} — ${
      kind === "custom" ? "montante personalizado" : kind === "optionals" ? "opcionais" : kind.replace("_", " ")
    }`;

    const { item, created } = await enqueueAction(supabase, ctx, lead, {
      type: "payment_link",
      title,
      subtitle: `${amount.toFixed(2)} EUR`,
      idempotencyKey: `${kind}:${amount.toFixed(2)}`,
      payload: {
        kind,
        amount_eur: amount,
        amount_cents: Math.round(amount * 100),
        currency: "EUR",
        deposit_cents: kind === "deposit_25" || kind === "deposit_50" ? Math.round(amount * 100) : null,
        description: description ?? (proposal as any)?.title ?? l.destination ?? "Your Tours Portugal",
        proposal_id: (proposal as any)?.id ?? null,
        trip_ref: leadLabel(lead),
        start_date: l.travel_dates ?? null,
        end_date: l.travel_end_date ?? null,
        total_pvp_eur: totals.pvp_eur,
        requires_ceo_approval: totals.requires_ceo_approval,
      },
    });

    if (created) {
      await auditLead(supabase, ctx, lead, "payment_link_requested", {
        payment_link: { from: null, to: `${amount.toFixed(2)} EUR (${kind}) — awaiting human approval` },
      }, { approval_id: item.id });
    }

    const payload = {
      approval_id: item.id,
      already_queued: !created,
      status: item.status,
      lead: leadLabel(lead),
      proposed_amount_eur: amount,
      kind,
      requires_ceo_approval: totals.requires_ceo_approval,
      note: "Nothing was created on WeTravel. A human must approve this item in 'Aprovações AI'.",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
