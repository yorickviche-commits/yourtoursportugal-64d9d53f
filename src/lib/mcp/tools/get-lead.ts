import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_lead",
  title: "Get lead detail",
  description:
    "Get a single lead with its planner and costing data. Look it up by lead id (uuid) or by lead code such as YT-2026-0001.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code, e.g. YT-2026-0001."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    if (!lead_id && !lead_code) throw new ToolError("Provide lead_id or lead_code");
    const supabase = supabaseForUser(ctx);

    let query = supabase.from("leads").select("*").limit(1);
    query = lead_id ? query.eq("id", lead_id) : query.eq("lead_code", lead_code!);

    const { data, error } = await query.maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Lead not found");

    const [planner, costing] = await Promise.all([
      supabase.from("lead_planner_data").select("*").eq("lead_id", data.id).eq("version", (data as any).active_version ?? 0).order("day_number"),
      supabase.from("lead_costing_data").select("*").eq("lead_id", data.id).eq("version", (data as any).active_version ?? 0).order("day_number"),
    ]);

    const payload = { lead: data, planner: planner.data ?? null, costing: costing.data ?? null };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
