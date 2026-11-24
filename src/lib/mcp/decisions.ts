import { ToolError } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_URL = "https://yourtoursportugal.lovable.app";
export const SIDES = ["sales", "ops", "finance", "management"] as const;
export const KINDS = ["client_email", "fse_email", "payment_link", "finance_item", "alert", "task"] as const;
export const HUMAN_ONLY = ["client_email", "payment_link", "finance_item"];

export async function rpc(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<any> {
  const { data, error } = await db.rpc(fn as never, args as never);
  if (error) throw new ToolError(error.message);
  return data;
}

export const withLink = <T extends { lead_path?: string | null; id?: string }>(d: T) => ({
  ...d,
  lead_url: d.lead_path ? `${APP_URL}${d.lead_path}` : null,
  cockpit_url: d.id ? `${APP_URL}/cockpit#decision-${d.id}` : null,
});
