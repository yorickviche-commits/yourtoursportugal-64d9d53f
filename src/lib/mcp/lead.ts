import { ToolError } from "@lovable.dev/mcp-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_ORIGIN = "https://yourtoursportugal.lovable.app";

export interface StageDef {
  code: string;
  label: string;
  group: "SALES" | "OPERATIONS";
  status: string;
}

/** Exact pipeline stages used by the lead header dropdown in the TCC. */
export const STAGES: StageDef[] = [
  { code: "SALES - New Lead", label: "SALES · New Lead", group: "SALES", status: "new" },
  { code: "SALES - - Budgeting & Fine-Tuning", label: "SALES · Budgeting & Fine-Tuning", group: "SALES", status: "proposal_sent" },
  { code: "SALES - Final Negotiation & Ready to Book", label: "SALES · Final Negotiation & Ready to Book", group: "SALES", status: "negotiation" },
  { code: "SALES - Archive", label: "SALES · Archive", group: "SALES", status: "lost" },
  { code: "OPERATIONS - Deposit/Payment Received", label: "OPERATIONS · Deposit/Payment Received", group: "OPERATIONS", status: "won" },
  { code: "OPERATIONS - Suppliers Bookings & Confirmations", label: "OPERATIONS · Suppliers Bookings & Confirmations", group: "OPERATIONS", status: "won" },
  { code: "OPERATIONS - Technical Briefing (Internal & Suppliers Final Validations)", label: "OPERATIONS · Technical Briefing", group: "OPERATIONS", status: "won" },
  { code: "OPERATIONS - Trip Ready / In Execution", label: "OPERATIONS · Trip Ready / In Execution", group: "OPERATIONS", status: "won" },
  { code: "OPERATIONS - Post-Trip Loop / Feedback", label: "OPERATIONS · Post-Trip Loop / Feedback", group: "OPERATIONS", status: "won" },
  { code: "OPERATIONS - Deferred / Postponed Trip", label: "OPERATIONS · Deferred / Postponed Trip", group: "OPERATIONS", status: "won" },
  { code: "OPERATIONS - Archive", label: "OPERATIONS · Archive", group: "OPERATIONS", status: "lost" },
];

const normalize = (s: string) => s.replace(/[\s·-]+/g, " ").trim().toLowerCase();

/** Accepts the exact code, the label, or a loose variant ("Budgeting & Fine-Tuning"). */
export function resolveStage(input: string): StageDef {
  const key = normalize(input);
  const hit =
    STAGES.find((s) => normalize(s.code) === key) ??
    STAGES.find((s) => normalize(s.label) === key) ??
    STAGES.find((s) => normalize(s.code).endsWith(key) || normalize(s.label).endsWith(key));
  if (!hit) {
    throw new ToolError(
      `Invalid stage "${input}". Valid stages: ${STAGES.map((s) => s.label).join(" | ")}`,
    );
  }
  return hit;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LeadRow {
  id: string;
  lead_code: string;
  yt_id: string | null;
  client_name: string;
  email: string | null;
  status: string;
  nethunt_stage: string | null;
  nethunt_record_id: string | null;
  active_version: number | null;
  assigned_agents: string[] | null;
  [key: string]: unknown;
}

/**
 * Resolves a lead from `lead_id` (uuid) or `lead_code`, accepting the day-to-day
 * format "YT5130" as well as "YT-5130", lowercase and the internal
 * "YT-2026-5130" code.
 */
export async function resolveLead(
  supabase: SupabaseClient,
  args: { lead_id?: string; lead_code?: string },
  select = "*",
): Promise<LeadRow> {
  const id = args.lead_id?.trim();
  const code = args.lead_code?.trim();
  if (!id && !code) throw new ToolError("Provide lead_id or lead_code");

  const run = async (build: (q: any) => any) => {
    const { data, error } = await build(supabase.from("leads").select(select).limit(1));
    if (error) throw new ToolError(error.message);
    return (Array.isArray(data) ? data[0] : data) as LeadRow | undefined;
  };

  if (id) {
    if (!UUID.test(id)) throw new ToolError("lead_id must be a uuid — use lead_code for codes like YT5130");
    const row = await run((q: any) => q.eq("id", id));
    if (!row) throw new ToolError(`Lead ${id} not found or not accessible`);
    return row;
  }

  const upper = code!.toUpperCase().replace(/\s+/g, "");
  const digits = upper.replace(/^YT-?/, "").replace(/^\d{4}-/, "");

  let row =
    (await run((q: any) => q.eq("yt_id", upper))) ??
    (await run((q: any) => q.eq("lead_code", upper))) ??
    (await run((q: any) => q.ilike("yt_id", upper)));

  if (!row && /^\d+$/.test(digits)) {
    row =
      (await run((q: any) => q.eq("yt_id", `YT${digits}`))) ??
      (await run((q: any) => q.ilike("lead_code", `%-${digits}`))) ??
      (await run((q: any) => q.ilike("lead_code", `%${digits}`)));
  }

  if (!row) throw new ToolError(`Lead "${code}" not found or not accessible (tried YT id and lead code)`);
  return row;
}

export const leadLabel = (lead: LeadRow) => (lead.yt_id || lead.lead_code || lead.id) as string;
export const leadUrl = (lead: LeadRow) => `${APP_ORIGIN}/leads/${lead.id}`;

/**
 * Audit trail for every MCP write: actor is always the AI agent plus the
 * authenticated user, with the changed field and previous → new value.
 */
export async function auditLead(
  supabase: SupabaseClient,
  ctx: ToolContext,
  lead: LeadRow,
  actionType: string,
  changes: Record<string, { from: unknown; to: unknown }>,
  extra?: Record<string, unknown>,
) {
  const { error } = await supabase.from("activity_logs").insert({
    action_type: actionType,
    entity_type: "lead",
    entity_id: lead.id,
    user_id: ctx.getUserId() ?? null,
    details: {
      actor: "AI agent (MCP)",
      actor_user_id: ctx.getUserId() ?? null,
      actor_email: ctx.getUserEmail() ?? null,
      lead_code: leadLabel(lead),
      changes,
      ...(extra ?? {}),
    },
  } as never);
  if (error) console.warn("audit insert failed", error.message);
}

export type SyncResult = { status: "ok" | "not_linked" | "error"; message?: string };

/** Mirrors a change to NetHunt through the same edge function the UI calls. */
export async function pushNetHunt(
  supabase: SupabaseClient,
  entity: "lead" | "comment",
  leadId: string,
  changes: Record<string, unknown>,
  linked: boolean,
): Promise<SyncResult> {
  if (!linked) return { status: "not_linked", message: "Lead has no NetHunt record" };
  try {
    const { data, error } = await supabase.functions.invoke("nethunt-push", {
      body: { entity, id: leadId, changes },
    });
    if (error) return { status: "error", message: error.message };
    const res = data as { ok?: boolean; error?: string } | null;
    if (res?.error) return { status: "error", message: res.error };
    return { status: "ok" };
  } catch (e) {
    return { status: "error", message: (e as Error).message };
  }
}

/** Live version of a lead — always `active_version`, never max(version). */
export const liveVersion = (lead: LeadRow) => Number(lead.active_version ?? 0);
