import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { agentIdentity, agentActor } from "../agent";
const lead = { lead_id: z.string().optional().describe("Lead uuid."), lead_code: z.string().optional().describe("Lead code such as YT5130 or YT-2026-4474.") };
const sideOf = (l: { nethunt_stage?: string | null; status?: string | null }) => (l.nethunt_stage?.startsWith("OPERATIONS") || (!l.nethunt_stage && l.status === "won") ? "ops" : "sales");
const fail = (e: { message: string } | null) => { if (e) throw new ToolError(e.message); };
export default defineTool({
  name: "add_auto_log_entry",
  title: "Add Workbench auto-log entry",
  description: "Record something the agent did for a lead in the Workbench daily log.",
  inputSchema: { ...lead, what: z.string().min(1).max(300).describe("What was done."), trace: z.string().max(1000).optional().describe("Where it can be checked."), reversible: z.boolean().optional().describe("Can be undone.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ lead_id, lead_code, what, trace, reversible }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const l = await resolveLead(db, { lead_id, lead_code }, "id,nethunt_stage,status");
    fail((await db.from("workbench_auto_log").insert({ lead_id: l.id, side: sideOf(l), what, trace: trace ?? null, reversible: reversible ?? false, created_by_agent: agentActor(await agentIdentity(db, ctx)) })).error);
    return { content: [{ type: "text", text: "Logged." }] };
  },
});
