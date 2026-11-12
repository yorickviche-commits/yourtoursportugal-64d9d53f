import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead } from "../lead";
import { workbenchScope, workbenchSide, activeWorkbenchThread, lisbonToday } from "../../../../supabase/functions/_shared/workbenchScope";
const lead = { lead_id: z.string().optional().describe("Lead uuid."), lead_code: z.string().optional().describe("Lead code such as YT5130 or YT-2026-4474.") };
async function all(q: any) { const out: any[]=[]; for(let from=0;;from+=1000){const r=await q.range(from,from+999);fail(r.error);out.push(...(r.data||[]));if((r.data||[]).length<1000)break;}return out;}
const fail = (e: { message: string } | null) => { if (e) throw new ToolError(e.message); };
export default defineTool({
  name: "list_workbench_state",
  title: "List Workbench state",
  description: "Read the Workbench: inbox threads, open alerts and checklist for one side (sales/ops) or one lead. Read-only.",
  inputSchema: { include_archived: z.boolean().optional().describe("Include all files and archived inbox threads (default false)."), side: z.enum(["sales", "ops"]).optional().describe("Mailbox side."), ...lead, limit: z.number().int().min(1).max(200).optional().describe("Max threads (default 50).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ side, lead_id, lead_code, limit, include_archived }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const db = supabaseForUser(ctx);
    const today=lisbonToday();
    const cols="id,yt_id,nethunt_stage,status,trip_start,trip_finish,updated_at,nethunt_updated_at";
    const l = lead_id || lead_code ? await resolveLead(db, { lead_id, lead_code }, cols) : null;
    const leads=l?[l]:await all(db.from("leads").select(cols).order("id"));
    const scoped=leads.filter(x=>(!side||workbenchSide(x)===side)&&(include_archived||workbenchScope(x,today).active));
    const ids=new Set(scoped.map(x=>x.id));
    let t=db.from("workbench_threads").select("id,mailbox,subject,from_email,last_message_at,yt_ref,lead_id,ball,urgency,urgency_reason,ai_reading,ai_checked,in_inbox").order("last_message_at",{ascending:true});
    let a=db.from("workbench_alerts").select("id,lead_id,side,title,reason,next_step,status,created_at").neq("status","handled").order("id");
    if(side){t=t.eq("mailbox",side);a=a.eq("side",side);}
    if(l){t=t.eq("lead_id",l.id);a=a.eq("lead_id",l.id);}
    const [tr,ar,cr]=await Promise.all([all(t),all(a),l&&ids.has(l.id)?all(db.from("workbench_checklist").select("item_key,label,status,source,note").eq("lead_id",l.id).order("item_key")):Promise.resolve([])]);
    const threads=tr.filter(x=>include_archived?(!x.lead_id||ids.has(x.lead_id)):x.in_inbox&&activeWorkbenchThread(x,leads.find(y=>y.id===x.lead_id),today)).slice(0,limit??50);
    const result={files:scoped.map(x=>({id:x.id,yt_id:x.yt_id,...workbenchScope(x,today)})),threads,alerts:ar.filter(x=>ids.has(x.lead_id)&&workbenchScope(leads.find(y=>y.id===x.lead_id)||{},today).active),checklist:cr};
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
