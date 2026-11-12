import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { agentIdentity, agentActor } from "../agent";
const lead = { lead_id: z.string().optional().describe("Lead uuid."), lead_code: z.string().optional().describe("Lead code such as YT5130 or YT-2026-4474.") };
const sideOf = (l: { nethunt_stage?: string | null; status?: string | null }) => (l.nethunt_stage?.startsWith("OPERATIONS") || (!l.nethunt_stage && l.status === "won") ? "ops" : "sales");
const fail = (e: { message: string } | null) => { if (e) throw new ToolError(e.message); };
export default defineTool({
  name: "open_workbench_alert",
  title: "Open YT Cockpit alert",
  description: "Open one urgent alert for a lead and reason (duplicates are ignored). A person handles it.",
  inputSchema: { ...lead, reason: z.string().min(3).max(300).describe("Why it is urgent."), next_step: z.string().max(300).optional().describe("Suggested next step.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, reason, next_step }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const l = await resolveLead(db, { lead_id, lead_code }, "id,yt_id,nethunt_stage,status");
    const r = await db.from("workbench_alerts").insert({ lead_id: l.id, side: sideOf(l), title: l.yt_id || "File", reason, next_step: next_step ?? null });
    if (r.error && r.error.code !== "23505") throw new ToolError(r.error.message);
    await db.from("workbench_auto_log").insert({ lead_id: l.id, side: sideOf(l), what: "Alerta aberto", trace: reason, created_by_agent: agentActor(await agentIdentity(db, ctx)) });
    return { content: [{ type: "text", text: r.error ? "Alert already open." : "Alert opened." }] };
  },
});
