import { ToolError } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProposalToken } from "@/lib/proposalVersion";
import { GENERAL_FIELDS } from "@/hooks/useLeadVersions";
import type { LeadRow } from "./lead";

const pickGeneralData = (lead: any): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  GENERAL_FIELDS.forEach((k) => {
    out[k] = (lead ?? {})[k] ?? null;
  });
  return out;
};

/**
 * Server-side mirror of useCreateLeadVersion: version N+1 is a full copy of the
 * source version (general data, planner, costing, travel plan, proposal with a
 * fresh public token) and becomes the LIVE version. Nothing is overwritten.
 */
export async function createLeadVersion(
  supabase: SupabaseClient,
  lead: LeadRow,
  fromVersion: number,
): Promise<number> {
  const leadId = lead.id;
  const { data: versions } = await supabase.from("lead_versions").select("version").eq("lead_id", leadId);
  const maxExisting = ((versions ?? []) as any[]).reduce((m, r) => Math.max(m, Number(r.version)), fromVersion);
  const newVersion = maxExisting + 1;

  const [planner, costing, plans] = await Promise.all([
    supabase.from("lead_planner_data").select("*").eq("lead_id", leadId).eq("version", fromVersion),
    supabase.from("lead_costing_data").select("*").eq("lead_id", leadId).eq("version", fromVersion),
    supabase.from("travel_plans").select("*").eq("lead_id", leadId).eq("version", fromVersion),
  ]);

  const strip = (rows: any[] | null) =>
    (rows ?? []).map(({ id: _id, created_at: _c, updated_at: _u, created_by: _b, ...rest }: any) => ({
      ...rest,
      lead_id: leadId,
      version: newVersion,
    }));

  const writes = await Promise.all([
    supabase.from("lead_versions").insert({
      lead_id: leadId,
      version: newVersion,
      name: `V${newVersion}`,
      general_data: pickGeneralData(lead) as never,
    } as never),
    strip(planner.data).length
      ? supabase.from("lead_planner_data").insert(strip(planner.data) as never)
      : Promise.resolve({ error: null } as any),
    strip(costing.data).length
      ? supabase.from("lead_costing_data").insert(strip(costing.data) as never)
      : Promise.resolve({ error: null } as any),
    strip(plans.data).length
      ? supabase.from("travel_plans").insert(strip(plans.data) as never)
      : Promise.resolve({ error: null } as any),
  ]);
  const failed = writes.find((r: any) => r?.error);
  if (failed && (failed as any).error) throw new ToolError((failed as any).error.message);

  const { data: srcProposal } = await supabase
    .from("proposals")
    .select("*")
    .eq("lead_id", leadId)
    .eq("version", fromVersion)
    .maybeSingle();
  if (srcProposal) {
    const {
      id: _pid,
      created_at: _pc,
      updated_at: _pu,
      created_by: _pb,
      public_token: _pt,
      sent_at: _ps,
      approved_at: _pa,
      ...rest
    } = srcProposal as any;
    const { error: pErr } = await supabase.from("proposals").insert({
      ...rest,
      lead_id: leadId,
      version: newVersion,
      public_token: buildProposalToken((lead as any).yt_id || lead.lead_code || "ytp", newVersion),
      status: "draft",
      sent_at: null,
      approved_at: null,
    } as never);
    if (pErr) throw new ToolError(pErr.message);
  }

  const { error: upErr } = await supabase.from("leads").update({ active_version: newVersion } as never).eq("id", leadId);
  if (upErr) throw new ToolError(upErr.message);
  return newVersion;
}
