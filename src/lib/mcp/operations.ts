import type { SupabaseClient } from "@supabase/supabase-js";
import { liveVersion, type LeadRow } from "./lead";
import { normalizeBookingStatus, normalizeInvoiceStatus, normalizePaymentStatus } from "../../components/leads/opsConstants";

/**
 * Mirrors LeadOperationsEditor (Operações tab): planner items of the LIVE version,
 * falling back to costing lines, merged with saved lead_operations rows by item_key.
 * Keep in sync with that component.
 */
const PERIOD_ORDER = ["morning", "lunch", "afternoon", "night"] as const;

const slug = (s: string) =>
  (s || "item")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");

export interface OpsRow {
  item_key: string;
  day_number: number;
  source: "planner" | "manual";
  activity_title: string;
  supplier: string;
  pax: number;
  net_value: number;
  real_cost: number | null;
  schedule_time: string;
  schedule_end_time: string;
  booking_status: string;
  payment_status: string;
  invoice_status: string;
  invoice_file_name: string | null;
  confirmation_number: string | null;
  notes: string | null;
  sort_order: number;
  saved: boolean;
  op?: any;
}

export async function buildOpsRows(supabase: SupabaseClient, lead: LeadRow) {
  const version = liveVersion(lead);
  const [planner, costing, ops] = await Promise.all([
    supabase.from("lead_planner_data").select("*").eq("lead_id", lead.id).eq("version", version).order("day_number"),
    supabase.from("lead_costing_data").select("*").eq("lead_id", lead.id).eq("version", version).order("day_number"),
    supabase.from("lead_operations").select("*").eq("lead_id", lead.id),
  ]);
  for (const r of [planner, costing, ops]) if (r.error) throw new Error(r.error.message);
  const plannerDays = (planner.data ?? []) as any[];
  const costingDays = (costing.data ?? []) as any[];
  const operations = (ops.data ?? []) as any[];

  const costingLookup: Record<string, { supplier: string; pax: number; net: number }> = {};
  costingDays.forEach((day) => {
    (Array.isArray(day.items) ? day.items : []).forEach((it: any) => {
      costingLookup[`${day.day_number}|${norm(it.description || it.activity || "")}`] = {
        supplier: it.supplier || "",
        pax: Number(it.numAdults ?? it.num_adults ?? 0) || 0,
        net: Number(it.netTotal ?? it.unitCost ?? it.unit_cost ?? 0) || 0,
      };
    });
  });

  const opsMap: Record<string, any> = {};
  operations.forEach((op) => { opsMap[op.item_key] = op; });
  const rows: OpsRow[] = [];
  const used = new Set<string>();

  const fromOp = (op: any, base: Partial<OpsRow>): OpsRow => ({
    item_key: base.item_key!,
    day_number: base.day_number!,
    source: base.source ?? "planner",
    activity_title: op?.activity_title ?? base.activity_title ?? "—",
    supplier: op?.supplier ?? base.supplier ?? "",
    pax: op?.pax ?? base.pax ?? 0,
    net_value: base.net_value ?? Number(op?.net_value ?? 0),
    real_cost: op?.real_cost != null ? Number(op.real_cost) : null,
    schedule_time: op?.schedule_time || "",
    schedule_end_time: op?.schedule_end_time?.slice(0, 5) || "",
    booking_status: normalizeBookingStatus(op?.booking_status),
    payment_status: normalizePaymentStatus(op?.payment_status),
    invoice_status: normalizeInvoiceStatus(op?.invoice_status),
    invoice_file_name: op?.invoice_file_name ?? null,
    confirmation_number: op?.confirmation_number ?? null,
    notes: op?.notes ?? null,
    sort_order: rows.length,
    saved: !!op,
    op,
  });

  const push = (day: number, title: string) => {
    const baseKey = `d${day}-${slug(title)}`;
    let key = baseKey;
    let n = 2;
    while (used.has(key)) key = `${baseKey}-${n++}`;
    used.add(key);
    const cost = costingLookup[`${day}|${norm(title)}`];
    rows.push(fromOp(opsMap[key], {
      item_key: key, day_number: day, activity_title: title,
      supplier: cost?.supplier, pax: cost?.pax, net_value: cost?.net,
    }));
  };

  plannerDays.forEach((day) => {
    const periods = (day.activities || {}) as Record<string, { items?: { title?: string }[] }>;
    PERIOD_ORDER.forEach((pk) => (periods?.[pk]?.items || []).forEach((it: any) => {
      const t = (it?.title || "").trim();
      if (t) push(day.day_number, t);
    }));
  });
  if (rows.length === 0) {
    costingDays.forEach((day) => (Array.isArray(day.items) ? day.items : []).forEach((it: any) => {
      const t = (it.description || it.activity || "").trim();
      if (t) push(day.day_number, t);
    }));
  }
  operations
    .filter((op) => !used.has(op.item_key))
    .sort((a, b) => (a.day_number - b.day_number) || (a.sort_order - b.sort_order))
    .forEach((op) => {
      used.add(op.item_key);
      rows.push(fromOp(op, {
        item_key: op.item_key, day_number: op.day_number,
        source: op.source === "manual" ? "manual" : "planner",
        net_value: Number(op.net_value ?? 0),
      }));
    });

  return { version, rows };
}
