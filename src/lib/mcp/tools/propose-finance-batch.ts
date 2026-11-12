import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { agentIdentity, agentActor } from "../agent";
import { ACTIONS, fail } from "../finance";
export default defineTool({
  name: "propose_finance_batch",
  title: "Propose finance batch",
  description: "Add items to the daily finance batch as pending; a person validates them in YT Cockpit → Finanças. Nothing is executed.",
  inputSchema: {
    batch_date: z.string().optional().describe("YYYY-MM-DD, default today (Lisbon)."),
    items: z.array(z.object({
      action: z.enum(ACTIONS), yt_ref: z.string().optional(), lead_id: z.string().optional(), payment_id: z.string().optional(),
      proposed_payload: z.record(z.unknown()).describe("Client/NIF, amount, proposed document date and rule, channel, evidence; standard=true for routine items."),
      evidence_urls: z.array(z.string()).optional(),
    })).min(1).max(100),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ batch_date, items }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const actor = agentActor(await agentIdentity(db, ctx));
    const rows = [];
    for (const it of items) {
      let lead_id = it.lead_id ?? null, yt_ref = it.yt_ref ?? null;
      if (lead_id || yt_ref) { const l = await resolveLead(db, { lead_id: lead_id ?? undefined, lead_code: yt_ref ?? undefined }, "id,yt_id,lead_code"); lead_id = l.id; yt_ref = l.yt_id || l.lead_code; }
      rows.push({ ...(batch_date ? { batch_date } : {}), action: it.action, lead_id, yt_ref, payment_id: it.payment_id ?? null, proposed_payload: it.proposed_payload, evidence_urls: it.evidence_urls ?? [], validation_status: "pending", created_by: actor });
    }
    const { data, error } = await db.from("finance_batch_items").insert(rows).select("id"); fail(error);
    return { content: [{ type: "text", text: `${data!.length} item(s) pending human validation.` }], structuredContent: { ids: data!.map((d) => d.id) } };
  },
});
