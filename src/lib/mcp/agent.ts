import { ToolError } from "@lovable.dev/mcp-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { liveVersion, type LeadRow } from "./lead";
import { createLeadVersion } from "./versions";

/**
 * Agent identity: when the caller is the technical user behind a `ytp_agent_`
 * key (via /functions/v1/mcp-agent) this resolves the key's label/model.
 * OAuth callers (humans, Claude connector) resolve to null — behaviour unchanged.
 */
export interface AgentKey {
  id: string;
  name: string;
  agent_label: string;
  model: string | null;
  scopes: string[];
}

const cache = new WeakMap<ToolContext, Promise<AgentKey | null>>();

export function agentIdentity(supabase: SupabaseClient, ctx: ToolContext): Promise<AgentKey | null> {
  let hit = cache.get(ctx);
  if (!hit) {
    hit = (async () => {
      const { data, error } = await supabase.rpc("current_agent_key" as never);
      if (error) return null;
      const row = (Array.isArray(data) ? data[0] : data) as AgentKey | undefined;
      return row ?? null;
    })();
    cache.set(ctx, hit);
  }
  return hit;
}

export const agentActor = (a: AgentKey | null) =>
  a ? `${a.agent_label}${a.model ? ` · ${a.model}` : ""}` : "AI agent (MCP)";

/**
 * Version a write should land on. Humans: explicit version or LIVE.
 * Agents (proposal mode): never LIVE — their latest "Proposta AI" for the lead,
 * or a new one copied from LIVE.
 */
export async function resolveWriteVersion(
  supabase: SupabaseClient,
  ctx: ToolContext,
  lead: LeadRow,
  explicit: number | undefined,
): Promise<number> {
  const agent = await agentIdentity(supabase, ctx);
  const live = liveVersion(lead);
  if (!agent) return explicit ?? live;

  if (explicit !== undefined) {
    if (explicit === live) {
      throw new ToolError(
        `V${live} is the LIVE version — AI agents cannot edit it. Omit 'version' to write on your AI proposal.`,
      );
    }
    const { data } = await supabase
      .from("lead_versions")
      .select("is_ai_proposal")
      .eq("lead_id", lead.id)
      .eq("version", explicit)
      .maybeSingle();
    if (!(data as any)?.is_ai_proposal) {
      throw new ToolError(`V${explicit} is not an AI proposal — AI agents can only edit their own AI proposals.`);
    }
    return explicit;
  }

  const { data } = await supabase
    .from("lead_versions")
    .select("version")
    .eq("lead_id", lead.id)
    .eq("is_ai_proposal", true)
    .eq("proposed_by_key_id", agent.id)
    .order("version", { ascending: false })
    .limit(1);
  const existing = (data as any[] | null)?.[0]?.version;
  if (existing !== undefined && existing !== null) return Number(existing);

  return createLeadVersion(supabase, lead, live, { agent });
}
