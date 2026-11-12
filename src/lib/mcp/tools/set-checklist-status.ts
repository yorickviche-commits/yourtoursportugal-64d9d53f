import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { agentIdentity, agentActor } from "../agent";
const lead = { lead_id: z.string().optional().describe("Lead uuid."), lead_code: z.string().optional().describe("Lead code such as YT5130 or YT-2026-4474.") };
const sideOf = (l: { nethunt_stage?: string | null; status?: string | null }) => (l.nethunt_stage?.startsWith("OPERATIONS") || (!l.nethunt_stage && l.status === "won") ? "ops" : "sales");
const fail = (e: { message: string } | null) => { if (e) throw new ToolError(e.message); };
export default defineTool({
  name: "set_checklist_status",
  title: "Set Workbench checklist status",
  description: "Set an automatic checklist status for a lead. Values set manually by a person are never overwritten.",
  inputSchema: { ...lead, item_key: z.enum(["guide","transport","pickup","contact","suppliers","payment","briefing","file","plan","costing","proposal","followup","payment_link"]).describe("Checklist item."), status: z.enum(["ok","pending","missing","na"]).describe("Status."), note: z.string().max(500).optional().describe("Short note.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, item_key, status, note }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const l = await resolveLead(db, { lead_id, lead_code }, "id,nethunt_stage,status");
    const cur = await db.from("workbench_checklist").select("source,label").eq("lead_id", l.id).eq("item_key", item_key).maybeSingle(); fail(cur.error);
    if (cur.data?.source === "manual") return { content: [{ type: "text", text: "Skipped: this item was set manually by a person." }] };
    fail((await db.rpc("workbench_set_auto_checklist", { p_lead_id: l.id, p_item_key: item_key, p_label: cur.data?.label ?? item_key, p_status: status, p_note: note ?? null })).error);
    await db.from("workbench_auto_log").insert({ lead_id: l.id, side: sideOf(l), what: `Checklist ${item_key}: ${status}`, trace: note ?? null, created_by_agent: agentActor(await agentIdentity(db, ctx)) });
    return { content: [{ type: "text", text: "Checklist updated." }] };
  },
});
