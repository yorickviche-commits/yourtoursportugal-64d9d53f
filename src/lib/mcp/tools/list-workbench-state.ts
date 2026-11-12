import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { agentIdentity, agentActor } from "../agent";
const lead = { lead_id: z.string().optional().describe("Lead uuid."), lead_code: z.string().optional().describe("Lead code such as YT5130 or YT-2026-4474.") };
const sideOf = (l: { nethunt_stage?: string | null; status?: string | null }) => (l.nethunt_stage?.startsWith("OPERATIONS") || (!l.nethunt_stage && l.status === "won") ? "ops" : "sales");
const fail = (e: { message: string } | null) => { if (e) throw new ToolError(e.message); };
export default defineTool({
  name: "list_workbench_state",
  title: "List Workbench state",
  description: "Read the Workbench: inbox threads, open alerts and checklist for one side (sales/ops) or one lead. Read-only.",
  inputSchema: { side: z.enum(["sales", "ops"]).optional().describe("Mailbox side."), ...lead, limit: z.number().int().min(1).max(200).optional().describe("Max threads (default 50).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ side, lead_id, lead_code, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const l = lead_id || lead_code ? await resolveLead(db, { lead_id, lead_code }, "id,yt_id,nethunt_stage,status") : null;
    let t = db.from("workbench_threads").select("id,mailbox,subject,from_email,last_message_at,yt_ref,lead_id,ball,urgency,urgency_reason,ai_reading,ai_checked").eq("in_inbox", true).order("last_message_at", { ascending: true }).limit(limit ?? 50);
    let a = db.from("workbench_alerts").select("id,lead_id,side,title,reason,next_step,status,created_at").neq("status", "handled");
    if (side) { t = t.eq("mailbox", side); a = a.eq("side", side); }
    if (l) { t = t.eq("lead_id", l.id); a = a.eq("lead_id", l.id); }
    const [tr, ar, cr] = await Promise.all([t, a, l ? db.from("workbench_checklist").select("item_key,label,status,source,note").eq("lead_id", l.id) : Promise.resolve({ data: [], error: null })]);
    fail(tr.error); fail(ar.error); fail(cr.error);
    const result = { threads: tr.data ?? [], alerts: ar.data ?? [], checklist: cr.data ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
