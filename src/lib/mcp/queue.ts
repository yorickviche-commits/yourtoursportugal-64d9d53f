import { ToolError } from "@lovable.dev/mcp-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { leadLabel, type LeadRow } from "./lead";

/**
 * Human approval gate. AI agents never execute actions with an external effect
 * (client emails, supplier emails, payment links) — they only propose them here.
 * A human approves, edits or rejects in the "Aprovações AI" page and the existing
 * UI logic performs the real action at that point.
 */
export type QueueType = "client_email" | "fse_email" | "payment_link";

export interface QueueRow {
  id: string;
  type: QueueType;
  lead_id: string | null;
  lead_code: string | null;
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  created_at: string;
  reviewed_at: string | null;
  executed_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface EnqueueArgs {
  type: QueueType;
  title: string;
  subtitle?: string | null;
  payload: Record<string, unknown>;
  /** Stable per-proposal key so repeating a tool call never duplicates an item. */
  idempotencyKey: string;
}

export async function enqueueAction(
  supabase: SupabaseClient,
  ctx: ToolContext,
  lead: LeadRow,
  args: EnqueueArgs,
): Promise<{ item: QueueRow; created: boolean }> {
  const key = `${args.type}:${lead.id}:${args.idempotencyKey}`;

  const find = async () => {
    const { data } = await supabase
      .from("ai_action_queue")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle();
    return (data as QueueRow | null) ?? null;
  };

  const existing = await find();
  if (existing) return { item: existing, created: false };

  const { data, error } = await supabase
    .from("ai_action_queue")
    .insert({
      type: args.type,
      lead_id: lead.id,
      lead_code: leadLabel(lead),
      title: args.title,
      subtitle: args.subtitle ?? null,
      payload: args.payload as never,
      idempotency_key: key,
      created_by: ctx.getUserId() ?? null,
      created_by_label: "AI agent (MCP)",
    } as never)
    .select()
    .single();

  if (error) {
    const again = await find();
    if (again) return { item: again, created: false };
    throw new ToolError(error.message);
  }
  return { item: data as unknown as QueueRow, created: true };
}

export const queueSummary = (row: QueueRow) => ({
  approval_id: row.id,
  type: row.type,
  status: row.status,
  lead: row.lead_code,
  lead_id: row.lead_id,
  title: row.title,
  subtitle: row.subtitle,
  created_at: row.created_at,
  reviewed_at: row.reviewed_at,
  executed_at: row.executed_at,
  error: row.error,
});
