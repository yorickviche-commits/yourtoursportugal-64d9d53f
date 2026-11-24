import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, supabaseProjectUrl, supabasePublishableKey } from "../supabase";
import { rpc, APP_URL } from "../decisions";
export default defineTool({
  name: "apply_human_decision",
  title: "Relay Yorick's chat decision",
  description: "Relay a decision Yorick wrote in chat (e.g. 'ok 1, não 2') for supplier emails, alerts and tasks only. Client emails, payment links and finance items are refused: Cockpit only. Orquestrador key or interactive claude.ai session only.",
  inputSchema: {
    decision_id: z.string().uuid(),
    action: z.enum(["approve", "reject", "snooze"]),
    human_quote: z.string().min(1).max(1000).describe("Yorick's literal words."),
    note: z.string().max(300).optional(),
    snooze_until: z.string().optional().describe("ISO date/time, required for snooze."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const r = await rpc(db, "mcp_apply_human_decision", { p_id: a.decision_id, p_action: a.action, p_quote: a.human_quote, p_note: a.note ?? null, p_until: a.snooze_until ?? null });
    let execution: unknown = null;
    if (r.needs_execution) {
      const res = await fetch(`${supabaseProjectUrl()}/functions/v1/execute-decision`, { method: "POST", signal: ctx.signal, headers: { Authorization: `Bearer ${ctx.getToken()}`, apikey: supabasePublishableKey(), "Content-Type": "application/json" }, body: JSON.stringify({ decision_id: a.decision_id }) });
      execution = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    }
    return { content: [{ type: "text", text: `${a.action} recorded via chat. ${execution ? JSON.stringify(execution) : ""} ${APP_URL}/cockpit#decision-${a.decision_id}` }], structuredContent: { ...r, execution: execution as any } };
  },
});
