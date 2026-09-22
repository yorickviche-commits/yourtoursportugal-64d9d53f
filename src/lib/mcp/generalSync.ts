import type { SupabaseClient } from "@supabase/supabase-js";
import { buildParticipantsLabel } from "@/lib/participantsLabel";

/**
 * Server-side mirror of `syncGeneralToProposal` — propagates participants and
 * dates from the general data into the travel plan and proposal of the SAME
 * version. Other versions are never touched.
 */
export async function syncGeneralToProposalServer(
  supabase: SupabaseClient,
  args: {
    leadId: string;
    version: number;
    pax: number;
    paxChildren?: number | null;
    travelDates?: string | null;
    travelEndDate?: string | null;
  },
): Promise<void> {
  const { data: planRow } = await supabase
    .from("travel_plans")
    .select("id, days")
    .eq("lead_id", args.leadId)
    .eq("version", args.version)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const days = (Array.isArray((planRow as any)?.days) ? (planRow as any).days : []) as any[];
  const startDate = days[0]?.date || args.travelDates || null;
  const endDate = days[days.length - 1]?.date || args.travelEndDate || args.travelDates || null;

  const { data: proposalRow } = await supabase
    .from("proposals")
    .select("id, language")
    .eq("lead_id", args.leadId)
    .eq("version", args.version)
    .maybeSingle();

  const language = (proposalRow as any)?.language || "en";
  const participants = buildParticipantsLabel(args.pax, args.paxChildren, language);

  if (planRow) {
    await supabase
      .from("travel_plans")
      .update({ pax: participants, start_date: startDate, end_date: endDate } as never)
      .eq("id", (planRow as any).id);
  }
  if (proposalRow) {
    const dateRange = startDate && endDate ? `${startDate} — ${endDate}` : startDate || "";
    await supabase
      .from("proposals")
      .update({ participants, date_range: dateRange } as never)
      .eq("id", (proposalRow as any).id);
  }
}
