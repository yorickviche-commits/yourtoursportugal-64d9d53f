import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { agentIdentity, agentActor } from "../agent";
const lead = { lead_id: z.string().optional().describe("Lead uuid."), lead_code: z.string().optional().describe("Lead code such as YT5130 or YT-2026-4474.") };
const sideOf = (l: { nethunt_stage?: string | null; status?: string | null }) => (l.nethunt_stage?.startsWith("OPERATIONS") || (!l.nethunt_stage && l.status === "won") ? "ops" : "sales");
const fail = (e: { message: string } | null) => { if (e) throw new ToolError(e.message); };
export default defineTool({
  name: "upsert_workbench_thread_reading",
  title: "Record YT Cockpit thread reading",
  description: "Store the agent reading of an inbox thread (meaning, what was checked, whose turn, urgency). Never sends email.",
  inputSchema: { thread_id: z.string().describe("YT Cockpit thread id."), ai_reading: z.string().max(2000).optional().describe("What the email means."), ai_checked: z.string().max(2000).optional().describe("What it was verified against."), ball: z.enum(["ours", "client", "supplier"]).optional().describe("Whose turn."), urgency: z.enum(["urgent", "today", "week"]).optional().describe("Urgency."), urgency_reason: z.string().max(500).optional().describe("Why.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ thread_id, ...fields }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const r = await db.from("workbench_threads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", thread_id).select("id,lead_id,mailbox").maybeSingle();
    fail(r.error); if (!r.data) throw new ToolError("Thread not found");
    if (r.data.lead_id) await db.from("workbench_auto_log").insert({ lead_id: r.data.lead_id, side: r.data.mailbox, what: "Leitura de email registada", trace: Object.keys(patch).join(", "), created_by_agent: agentActor(await agentIdentity(db, ctx)) });
    return { content: [{ type: "text", text: "Reading saved." }] };
  },
});
