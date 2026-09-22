import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { leadLabel, liveVersion, resolveLead } from "../lead";
import { costingTotals, loadCosting, paymentsSummary } from "../costing";
import { loadPlan, planWarnings } from "../travelPlan";

const days = (from?: string | null, to?: string | null) => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000) + 1;
};

export default defineTool({
  name: "validate_lead",
  title: "Validate a lead before the next stage",
  description:
    "Checklist for one lead: required fields still missing, inconsistencies (dates vs number of days, pax vs costing, programme language vs client language, B2B without partner/logo), costing and margin health, and what is still needed before moving to the next pipeline stage.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    version: z.number().int().optional().describe("Version to validate (default: LIVE version)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, version }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const ver = version ?? liveVersion(lead);
    const l = lead as any;

    const missing: string[] = [];
    const inconsistencies: string[] = [];

    if (!l.client_name) missing.push("client_name");
    if (!l.email) missing.push("email");
    if (!l.phone) missing.push("phone");
    if (!l.travel_dates) missing.push("start date");
    if (!l.travel_end_date) missing.push("end date");
    if (!Number(l.pax)) missing.push("pax (adults)");
    if (!l.language) missing.push("language");
    if (!l.destination) missing.push("destination");
    if (!l.assigned_agents?.length) missing.push("assigned agent");

    const span = days(l.travel_dates, l.travel_end_date);
    if (span !== null && Number(l.number_of_days) && span !== Number(l.number_of_days)) {
      inconsistencies.push(`Dates span ${span} days but number_of_days is ${l.number_of_days}`);
    }
    if (span !== null && span <= 0) inconsistencies.push("End date is not after the start date");

    const { plan } = await loadPlan(supabase, lead, ver);
    const { data: proposalRow } = await supabase
      .from("proposals")
      .select("public_token, language, brand_logo_url")
      .eq("lead_id", lead.id)
      .eq("version", ver)
      .maybeSingle();
    const proposal = proposalRow as { public_token?: string | null; language?: string | null; brand_logo_url?: string | null } | null;
    const planDays = plan.days.length;
    if (!planDays) missing.push("travel plan (no days yet)");
    if (planDays && span !== null && planDays !== span) {
      inconsistencies.push(`Travel plan has ${planDays} days but the dates span ${span} days`);
    }
    if (planDays && proposal?.language && l.language && String(proposal.language).toLowerCase() !== String(l.language).toLowerCase()) {
      inconsistencies.push(`Programme language is ${proposal.language} but the client language is ${l.language}`);
    }

    const costing = await loadCosting(supabase, lead, ver);
    const lines = costing.flatMap((d) => d.items);
    const totals = costingTotals(costing);
    if (!lines.length) missing.push("costing (no lines yet)");
    const unpriced = lines.filter((i) => !i.priceAdults).length;
    if (unpriced) inconsistencies.push(`${unpriced} costing lines without a net rate`);
    const paxMismatch = lines.filter((i) => i.pricingType === "per_person" && i.numAdults !== Number(l.pax || 0));
    if (paxMismatch.length) inconsistencies.push(`${paxMismatch.length} per-person costing lines do not use ${l.pax} adults`);
    if (totals.pvp_eur > 0 && totals.margin_percent < totals.min_margin_percent) {
      inconsistencies.push(`Margin ${totals.margin_percent}% is below the ${totals.min_margin_percent}% minimum`);
    }

    if (String(l.client_type || "").toUpperCase() === "B2B") {
      if (!l.partner_id) missing.push("B2B partner");
      if (!proposal?.brand_logo_url) missing.push("B2B logo on the proposal");
    }

    const deposited = await paymentsSummary(supabase, lead);
    const nextStage: string[] = [];
    if (missing.length || inconsistencies.length) nextStage.push("Fix the items above before sending to the client");
    if (!proposal?.public_token) nextStage.push("Generate the digital itinerary link");
    if (totals.requires_ceo_approval) nextStage.push(`Total above ${totals.ceo_threshold_eur} EUR — CEO approval required`);
    if (!deposited) nextStage.push("No payment recorded yet — deposit needed before Operations");

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      version: ver,
      stage: l.nethunt_stage ?? l.status,
      ready: missing.length === 0 && inconsistencies.length === 0,
      missing_fields: missing,
      inconsistencies,
      plan_warnings: planWarnings(plan),
      costing: { ...totals, deposited_eur: deposited, outstanding_eur: Math.round((totals.pvp_eur - deposited) * 100) / 100 },
      to_advance_stage: nextStage,
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
