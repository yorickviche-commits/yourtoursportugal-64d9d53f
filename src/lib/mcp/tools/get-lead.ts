import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { leadUrl, liveVersion, resolveLead, STAGES } from "../lead";

export default defineTool({
  name: "get_lead",
  title: "Get lead detail",
  description:
    "Get a single lead with its planner and costing data. Look it up by lead id (uuid) or by lead code — 'YT5130', 'YT-5130' and the internal 'YT-2026-5130' all work.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code, e.g. YT5130."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const version = liveVersion(lead);

    const [planner, costing] = await Promise.all([
      supabase.from("lead_planner_data").select("*").eq("lead_id", lead.id).eq("version", version).order("day_number"),
      supabase.from("lead_costing_data").select("*").eq("lead_id", lead.id).eq("version", version).order("day_number"),
    ]);

    const payload = {
      lead: {
        ...lead,
        stage_label: STAGES.find((s) => s.code === lead.nethunt_stage)?.label ?? lead.nethunt_stage ?? lead.status,
        tcc_url: leadUrl(lead),
      },
      version,
      planner: planner.data ?? null,
      costing: costing.data ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as never,
    };
  },
});
