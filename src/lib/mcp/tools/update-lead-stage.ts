import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, pushNetHunt, resolveLead, resolveStage, STAGES } from "../lead";

export default defineTool({
  name: "update_lead_stage",
  title: "Update lead stage",
  description:
    "Move a lead to another pipeline stage, exactly like the stage dropdown in the lead header. Mirrors the stage to NetHunt when the lead is linked and records the change in the lead history. Use list_lead_stages for valid values.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    stage: z.string().describe("Target stage code or label, e.g. 'SALES · Final Negotiation & Ready to Book'."),
    note: z.string().optional().describe("Optional reason stored with the history entry."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, lead_code, stage, note }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });
    const target = resolveStage(stage);

    const previous = {
      stage: lead.nethunt_stage ?? null,
      status: lead.status,
      label: STAGES.find((s) => s.code === lead.nethunt_stage)?.label ?? null,
    };

    const alreadyThere = lead.nethunt_stage === target.code && lead.status === target.status;

    if (!alreadyThere) {
      const { error } = await supabase
        .from("leads")
        .update({ status: target.status, nethunt_stage: target.code } as never)
        .eq("id", lead.id);
      if (error) throw new ToolError(error.message);

      await supabase.from("lead_stage_history").insert({
        lead_id: lead.id,
        stage_code: target.code,
        stage_label: target.label,
        source: "mcp",
      } as never);

      await auditLead(supabase, ctx, lead, "lead_status_changed", {
        nethunt_stage: { from: previous.stage, to: target.code },
        status: { from: previous.status, to: target.status },
      }, note ? { note } : undefined);
    }

    const sync = await pushNetHunt(
      supabase,
      "lead",
      lead.id,
      { nethunt_stage: target.code, status: target.status },
      Boolean(lead.nethunt_record_id),
    );

    const payload = {
      lead: leadLabel(lead),
      lead_id: lead.id,
      previous_stage: previous.label ?? previous.stage,
      new_stage: target.label,
      new_status: target.status,
      already_in_stage: alreadyThere,
      nethunt_sync: sync,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
