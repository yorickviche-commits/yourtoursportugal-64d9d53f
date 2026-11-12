import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { agentIdentity, agentActor } from "../agent";
import { CHANNELS, PAY_STATUS, PAY_TYPES, leadArgs, fail } from "../finance";
export default defineTool({
  name: "register_payment",
  title: "Register payment",
  description: "Create or update one payments ledger line (never deletes, never changes the lead stage). Pass payment_id to update.",
  inputSchema: {
    payment_id: z.string().optional(), ...leadArgs,
    channel: z.enum(CHANNELS).optional(), payer_name: z.string().optional(), amount_gross: z.number().optional(), currency: z.string().optional(),
    payment_type: z.enum(PAY_TYPES).optional(), status: z.enum(PAY_STATUS).optional(),
    requested_at: z.string().optional(), paid_channel_at: z.string().optional(), bank_date: z.string().optional(), invoiced_at: z.string().optional(), receipt_at: z.string().optional(), reconciled_at: z.string().optional(),
    proforma_ref: z.string().optional(), optitravel_file: z.string().optional(), fa_number: z.string().optional(), rc_number: z.string().optional(),
    channel_evidence_url: z.string().optional(), bank_line_ref: z.string().optional(), payout_ref: z.string().optional(), notes: z.string().optional(), exception_reason: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ payment_id, lead_id, yt_ref, ...fields }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const row: Record<string, unknown> = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (lead_id || yt_ref) { const l = await resolveLead(db, { lead_id, lead_code: yt_ref }, "id,yt_id,lead_code"); row.lead_id = l.id; row.yt_ref = l.yt_id || l.lead_code; }
    if (row.status === "exception" && !row.exception_reason) throw new ToolError("exception_reason is required for status exception");
    const actor = agentActor(await agentIdentity(db, ctx));
    const r = payment_id
      ? await db.from("payments_ledger").update(row).eq("id", payment_id).select("id,status").single()
      : await db.from("payments_ledger").insert({ ...row, created_by: actor }).select("id,status").single();
    fail(r.error);
    return { content: [{ type: "text", text: `Payment ${r.data!.id} saved (${r.data!.status}). Lead stage unchanged.` }], structuredContent: { id: r.data!.id, status: r.data!.status } };
  },
});
