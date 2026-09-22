import { ToolError } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUSINESS_CONFIG } from "@/lib/businessConfig";
import type { LeadRow } from "./lead";

/**
 * Server-side mirror of LeadCostingEditor: the costing lives in
 * `lead_costing_data` as one row per day holding an array of lines. Day 0 is the
 * accommodation block, lines with status "opcionais" are optional extras that
 * stay out of the base totals, and "eliminar" lines are excluded as well.
 */

export type PricingType = "total" | "per_person" | "per_night";
export type LineStatus = "neutro" | "aceite" | "eliminar" | "opcionais";

export interface CostLine {
  id: string;
  description: string;
  supplier: string;
  pricingType: PricingType;
  numAdults: number;
  priceAdults: number;
  numChildren: number;
  priceChildren: number;
  netTotal: number;
  marginPercent: number;
  pvpTotal: number;
  profit: number;
  status: LineStatus;
  notes: unknown[];
  costLayer?: string;
  isProtocol?: boolean;
  isFixedRate?: boolean;
}

export interface CostDay {
  day_number: number;
  title: string;
  items: CostLine[];
}

export const ACCOMMODATION_DAY = 0;

/** Same arithmetic as calcItem() in LeadCostingEditor. */
export function calcLine(line: CostLine): CostLine {
  let netTotal: number;
  if (line.pricingType === "per_night") {
    netTotal = line.priceAdults * (line.numAdults || 0);
  } else if (line.pricingType === "per_person") {
    netTotal = line.priceAdults * line.numAdults + line.priceChildren * line.numChildren;
  } else {
    netTotal = line.priceAdults;
  }
  const pvpTotal = netTotal * (1 + line.marginPercent / 100);
  return { ...line, netTotal, pvpTotal, profit: pvpTotal - netTotal };
}

export function blankLine(partial: Partial<CostLine>): CostLine {
  return calcLine({
    id: partial.id || `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: partial.description || "",
    supplier: partial.supplier || "",
    pricingType: partial.pricingType || "total",
    numAdults: partial.numAdults ?? 0,
    priceAdults: partial.priceAdults ?? 0,
    numChildren: partial.numChildren ?? 0,
    priceChildren: partial.priceChildren ?? 0,
    netTotal: 0,
    marginPercent: partial.marginPercent ?? BUSINESS_CONFIG.DEFAULT_MARGIN_PERCENT,
    pvpTotal: 0,
    profit: 0,
    status: partial.status || "neutro",
    notes: partial.notes || [],
    costLayer: partial.costLayer,
    isProtocol: partial.isProtocol,
    isFixedRate: partial.isFixedRate,
  });
}

export async function loadCosting(
  supabase: SupabaseClient,
  lead: LeadRow,
  version: number,
): Promise<CostDay[]> {
  const { data, error } = await supabase
    .from("lead_costing_data")
    .select("day_number, title, items")
    .eq("lead_id", lead.id)
    .eq("version", version)
    .order("day_number", { ascending: true });
  if (error) throw new ToolError(error.message);
  return ((data ?? []) as any[]).map((row) => ({
    day_number: Number(row.day_number),
    title: String(row.title ?? ""),
    items: (Array.isArray(row.items) ? row.items : []).map((i: CostLine) => calcLine(i)),
  }));
}

export async function saveCostingDay(
  supabase: SupabaseClient,
  lead: LeadRow,
  version: number,
  day: CostDay,
): Promise<void> {
  const { data: existing } = await supabase
    .from("lead_costing_data")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("version", version)
    .eq("day_number", day.day_number)
    .maybeSingle();

  const payload = {
    lead_id: lead.id,
    version,
    day_number: day.day_number,
    title: day.title || (day.day_number === ACCOMMODATION_DAY ? "Alojamento" : `Dia ${day.day_number}`),
    items: day.items as never,
  };

  const { error } = existing
    ? await supabase.from("lead_costing_data").update(payload as never).eq("id", (existing as any).id)
    : await supabase.from("lead_costing_data").insert(payload as never);
  if (error) throw new ToolError(error.message);
}

const counts = (days: CostDay[], optional: boolean) =>
  days.flatMap((d) => d.items).filter((i) =>
    optional ? i.status === "opcionais" : i.status !== "opcionais" && i.status !== "eliminar",
  );

export interface CostingTotals {
  net_eur: number;
  pvp_eur: number;
  profit_eur: number;
  margin_percent: number;
  optionals_pvp_eur: number;
  requires_ceo_approval: boolean;
  ceo_threshold_eur: number;
  min_margin_percent: number;
}

export function costingTotals(days: CostDay[]): CostingTotals {
  const base = counts(days, false);
  const net = base.reduce((s, i) => s + i.netTotal, 0);
  const pvp = base.reduce((s, i) => s + i.pvpTotal, 0);
  const optionals = counts(days, true).reduce((s, i) => s + i.pvpTotal, 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    net_eur: round(net),
    pvp_eur: round(pvp),
    profit_eur: round(pvp - net),
    margin_percent: pvp > 0 ? round(((pvp - net) / pvp) * 100) : 0,
    optionals_pvp_eur: round(optionals),
    requires_ceo_approval: pvp > BUSINESS_CONFIG.CEO_APPROVAL_THRESHOLD_EUR,
    ceo_threshold_eur: BUSINESS_CONFIG.CEO_APPROVAL_THRESHOLD_EUR,
    min_margin_percent: BUSINESS_CONFIG.MIN_MARGIN_PERCENT,
  };
}

/** Business rule: never let a file drop under the minimum margin. */
export function assertMinimumMargin(totals: CostingTotals) {
  if (totals.pvp_eur > 0 && totals.margin_percent < totals.min_margin_percent) {
    throw new ToolError(
      `Minimum margin violated: ${totals.margin_percent.toFixed(1)}% is below the required ${totals.min_margin_percent}% ` +
        `(net ${totals.net_eur.toFixed(2)} EUR, PVP ${totals.pvp_eur.toFixed(2)} EUR). ` +
        `Raise the selling price or lower the net cost — the costing was not saved.`,
    );
  }
}

export async function paymentsSummary(supabase: SupabaseClient, lead: LeadRow) {
  const { data } = await supabase.from("lead_payments").select("amount_eur").eq("lead_id", lead.id);
  const deposited = ((data ?? []) as any[]).reduce((s, p) => s + Number(p.amount_eur || 0), 0);
  return Math.round(deposited * 100) / 100;
}
