import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead, type LeadRow } from "../lead";
import { enqueueAction } from "../queue";
import { agentIdentity, agentActor } from "../agent";
import { rpc, APP_URL } from "../decisions";
export default defineTool({
  name: "propose_decision",
  title: "Propose or update a decision card",
  description: "Create or update one 'Precisa de ti' card (one per lead + kind + reason). Emails and payment links also enter the approval queue; nothing is sent or created. Recently rejected cards are not recreated.",
  inputSchema: {
    lead_code: z.string().describe("Lead code such as YT5130."),
    side: z.enum(["sales", "ops"]).optional().describe("Default from kind."),
    kind: z.enum(["fse_email", "client_email", "payment_link", "alert"]),
    title: z.string().min(3).max(200),
    why: z.string().min(3).max(300).describe("One line: why this needs a human."),
    reason: z.string().max(200).optional().describe("Stable motive used for dedupe; defaults to title."),
    prepared: z.record(z.unknown()).optional().describe("Email: to, subject, body. Payment link: amount, description, trip_ref. Alert: next_step."),
    checked_note: z.string().max(300).optional().describe("What was verified, e.g. 'TCC + calendário'."),
    close_rule: z.string().max(100).optional(), close_params: z.record(z.unknown()).optional(),
    urgency: z.enum(["low", "normal", "high", "urgent"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const lead = await resolveLead(db, { lead_code: a.lead_code }, "*") as LeadRow & { nethunt_stage?: string | null };
    const found = await rpc(db, "mcp_decision_by_dedupe", { p_lead: lead.id, p_kind: a.kind, p_reason: a.reason ?? a.title });
    if (found.id && found.status === "rejected")
      return { content: [{ type: "text", text: `Rejeitado em ${String(found.decided_at).slice(0, 10)}: ${found.note ?? "sem nota"}. Not recreated.` }], structuredContent: { rejected: true, decision_id: found.id, decided_at: found.decided_at, note: found.note ?? null } };
    const meta = { p_dedupe: found.dedupe, p_why: a.why, p_prepared: a.prepared ?? null, p_checked_note: a.checked_note ?? null, p_close_rule: a.close_rule ?? null, p_close_params: a.close_params ?? null, p_urgency: a.urgency ?? null };
    if (found.id) {
      await rpc(db, "mcp_set_decision_meta", { p_id: found.id, p_source_table: null, p_source_id: null, ...meta });
      return { content: [{ type: "text", text: `Updated existing open card ${found.id}.` }], structuredContent: { decision_id: found.id, created: false } };
    }
    let table: string, sourceId: string;
    if (a.kind === "alert") {
      const side = a.side ?? (lead.nethunt_stage?.startsWith("OPERATIONS") ? "ops" : "sales");
      const r = await db.from("workbench_alerts").insert({ lead_id: lead.id, side, title: (lead as any).yt_id || "File", reason: a.why, next_step: (a.prepared?.next_step as string) ?? null } as never).select("id").maybeSingle();
      let id = (r.data as any)?.id;
      if (r.error) {
        if (r.error.code !== "23505") throw new ToolError(r.error.message);
        const ex = await db.from("workbench_alerts").select("id").eq("lead_id", lead.id).in("status", ["open", "snoozed"]).order("created_at", { ascending: false }).limit(1);
        id = (ex.data as any[])?.[0]?.id;
      }
      if (!id) throw new ToolError("Alert could not be created");
      table = "workbench_alerts"; sourceId = id;
      await db.from("workbench_auto_log").insert({ lead_id: lead.id, side, what: "Alerta aberto", trace: a.why, created_by_agent: agentActor(await agentIdentity(db, ctx)) } as never);
    } else {
      const { item } = await enqueueAction(db, ctx, lead, { type: a.kind, title: a.title, subtitle: a.why, payload: a.prepared ?? {}, idempotencyKey: `${found.dedupe.split(":").pop()}:${new Date().toISOString().slice(0, 10)}` });
      table = "ai_action_queue"; sourceId = item.id;
    }
    const out = await rpc(db, "mcp_set_decision_meta", { p_id: null, p_source_table: table, p_source_id: sourceId, ...meta });
    return { content: [{ type: "text", text: `Card ${out.id} open for human decision: ${APP_URL}/cockpit#decision-${out.id}` }], structuredContent: { decision_id: out.id, created: true } };
  },
});
