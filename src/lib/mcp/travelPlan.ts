import { ToolError } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildParticipantsLabel } from "@/lib/participantsLabel";
import { APP_ORIGIN, leadLabel, type LeadRow } from "./lead";

/**
 * Server-side mirror of the Travel Planner save path in TravelPlanProposal.tsx:
 * the plan lives in `travel_plans` (editor shape) and is projected into
 * `proposals` (client-facing shape). Both are written together so the digital
 * itinerary and the PDF always match the editor.
 */

export interface PlanImage {
  url: string;
  caption?: string;
}

export interface PlanDay {
  day_number: number;
  date?: string;
  title: string;
  subtitle?: string;
  bullets: (string | { text: string })[];
  overnight?: string;
  images?: PlanImage[];
  mapUrl?: string;
}

export interface PlanData {
  trip_title: string;
  narrative: string;
  cover_image?: PlanImage | null;
  brand_logo?: string | null;
  days: PlanDay[];
}

export interface PlanMeta {
  closing: Record<string, unknown>;
  language: string;
}

export interface LoadedPlan {
  plan: PlanData;
  meta: PlanMeta;
  planRowId: string | null;
  version: number;
  isEmpty: boolean;
}

const bulletText = (b: string | { text: string }) => (typeof b === "string" ? b : String(b?.text ?? ""));

export async function loadPlan(
  supabase: SupabaseClient,
  lead: LeadRow,
  version: number,
): Promise<LoadedPlan> {
  const { data, error } = await supabase
    .from("travel_plans")
    .select("id, trip_title, narrative, days, extra_instructions")
    .eq("lead_id", lead.id)
    .eq("version", version)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ToolError(error.message);

  let meta: PlanMeta = { closing: {}, language: "EN" };
  if ((data as any)?.extra_instructions) {
    try {
      const parsed = JSON.parse((data as any).extra_instructions) as Record<string, unknown>;
      meta = {
        closing: (parsed.closing as Record<string, unknown>) ?? {},
        language: String(parsed.language ?? "EN"),
      };
      (meta as any).cover_image = parsed.cover_image ?? null;
      (meta as any).brand_logo = parsed.brand_logo ?? null;
    } catch {
      /* legacy rows without metadata */
    }
  }

  const days = (Array.isArray((data as any)?.days) ? (data as any).days : []) as PlanDay[];
  const plan: PlanData = {
    trip_title: String((data as any)?.trip_title ?? ""),
    narrative: String((data as any)?.narrative ?? ""),
    cover_image: ((meta as any).cover_image as PlanImage | null) ?? null,
    brand_logo: ((meta as any).brand_logo as string | null) ?? null,
    days,
  };

  return {
    plan,
    meta,
    planRowId: ((data as any)?.id as string) ?? null,
    version,
    isEmpty: days.length === 0 && !plan.trip_title,
  };
}

export interface SaveContext {
  clientName: string;
  pax: number;
  paxChildren: number;
  language: string;
  travelDates?: string | null;
  travelEndDate?: string | null;
  leadCode: string;
  totalPvpEur?: number | null;
}

const DAY_LABEL: Record<string, string> = { en: "Day", fr: "Jour", es: "Día", pt: "Dia", it: "Giorno", de: "Tag" };

const token = (leadCode: string, version: number) =>
  `${leadCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v${version}-${Math.random().toString(36).slice(2, 8)}`;

export async function savePlan(
  supabase: SupabaseClient,
  lead: LeadRow,
  version: number,
  plan: PlanData,
  meta: PlanMeta,
  sc: SaveContext,
): Promise<void> {
  const startDate = plan.days[0]?.date || sc.travelDates || null;
  const endDate = plan.days[plan.days.length - 1]?.date || sc.travelEndDate || null;
  const lang = (meta.language || sc.language || "EN").toLowerCase().slice(0, 2);
  const paxStr = buildParticipantsLabel(sc.pax, sc.paxChildren, lang);
  const metadata = JSON.stringify({
    cover_image: plan.cover_image || null,
    brand_logo: plan.brand_logo || null,
    closing: meta.closing || {},
    language: meta.language || sc.language || "EN",
  });

  const planPayload = {
    lead_id: lead.id,
    file_id: sc.leadCode,
    trip_title: plan.trip_title,
    client_name: sc.clientName,
    start_date: startDate,
    end_date: endDate,
    pax: paxStr,
    narrative: plan.narrative,
    days: plan.days as never,
    extra_instructions: metadata,
    status: "draft",
    version,
  };

  const { data: existingPlanRow } = await supabase
    .from("travel_plans")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("version", version)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = existingPlanRow
    ? await supabase.from("travel_plans").update(planPayload as never).eq("id", (existingPlanRow as any).id)
    : await supabase.from("travel_plans").insert(planPayload as never);
  if (error) throw new ToolError(error.message);

  const dateRange = startDate && endDate ? `${startDate} — ${endDate}` : startDate || "";
  const proposalDays = plan.days.map((d) => ({
    day_number: d.day_number,
    date_label: d.date || `${DAY_LABEL[lang] || "Day"} ${d.day_number}`,
    title: d.title,
    subtitle: d.subtitle || "",
    cover_image_url: d.images?.[0]?.url || "",
    images: (d.images || []).map((img) => ({ url: img.url, caption: img.caption || "" })),
    items: (d.bullets || []).map(bulletText),
    accommodation: d.overnight ? { label: d.overnight, hotel_name: d.overnight, note: "" } : null,
    map_url: d.mapUrl || "",
  }));

  const { data: existingProposal } = await supabase
    .from("proposals")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("version", version)
    .maybeSingle();

  const common = {
    title: plan.trip_title,
    client_name: sc.clientName,
    date_range: dateRange,
    participants: paxStr,
    hero_image_url: plan.cover_image?.url || "",
    brand_logo_url: plan.brand_logo || null,
    summary_text: plan.narrative,
    days: proposalDays as never,
    language: lang,
    total_value_eur: sc.totalPvpEur ?? null,
    closing_terms: (meta.closing || {}) as never,
  };

  if (existingProposal) {
    const { error: upErr } = await supabase
      .from("proposals")
      .update(common as never)
      .eq("id", (existingProposal as any).id);
    if (upErr) throw new ToolError(upErr.message);
  } else {
    const { error: insErr } = await supabase.from("proposals").insert({
      ...common,
      public_token: token(sc.leadCode, version),
      lead_id: lead.id,
      version,
      map_stops: [] as never,
      status: "draft",
    } as never);
    if (insErr) throw new ToolError(insErr.message);
  }
}

/** Warnings an agent must read before sending a programme to a client. */
export function planWarnings(plan: PlanData): string[] {
  const w: string[] = [];
  if (!plan.trip_title) w.push("Programme has no title");
  if (!plan.narrative) w.push("Programme has no summary");
  if (!plan.cover_image?.url) w.push("No cover image");
  for (const d of plan.days) {
    const n = d.day_number;
    if (!d.images?.filter((i) => i?.url).length) w.push(`Day ${n} has no images`);
    if (!d.mapUrl) w.push(`Day ${n} has no map`);
    if (!d.overnight) w.push(`Day ${n} has no overnight stay`);
    if (!(d.bullets || []).filter((b) => bulletText(b).trim()).length) w.push(`Day ${n} has no included items`);
  }
  return w;
}

export async function planPayload(
  supabase: SupabaseClient,
  lead: LeadRow,
  version: number,
  plan: PlanData,
) {
  const { data: proposal } = await supabase
    .from("proposals")
    .select("public_token, wetravel_checkout_url, total_value_eur, participants, date_range, language")
    .eq("lead_id", lead.id)
    .eq("version", version)
    .maybeSingle();
  const p = proposal as any;
  return {
    lead: leadLabel(lead),
    lead_id: lead.id,
    version,
    title: plan.trip_title,
    summary: plan.narrative,
    language: p?.language ?? null,
    participants: p?.participants ?? null,
    date_range: p?.date_range ?? null,
    total_value_eur: p?.total_value_eur ?? null,
    itinerary_url: p?.public_token ? `${APP_ORIGIN}/proposal/${p.public_token}` : null,
    booking_url: p?.wetravel_checkout_url ?? null,
    days: plan.days.map((d) => ({
      day_number: d.day_number,
      date: d.date ?? null,
      title: d.title,
      tagline: d.subtitle ?? null,
      items: (d.bullets || []).map(bulletText),
      night_at: d.overnight ?? null,
      map_url: d.mapUrl || null,
      images: (d.images || []).filter((i) => i?.url).length,
    })),
    warnings: planWarnings(plan),
  };
}
