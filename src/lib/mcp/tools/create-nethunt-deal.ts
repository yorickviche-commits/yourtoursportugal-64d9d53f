import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { resolveLead, auditLead } from "../lead";

export default defineTool({
  name: "create_nethunt_deal",
  title: "Create the NetHunt file for a lead",
  description:
    "Creates the deal in NetHunt CRM for a TCC lead that has no NetHunt record yet, and stores the returned record id and YT ID on the lead. Never runs automatically; idempotent (returns the existing link if already linked).",
  inputSchema: {
    lead: z.string().min(1).describe("Lead uuid or code, e.g. YT5130 / YT-5130."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async ({ lead }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const row = await resolveLead(supabase, lead);
    const { data, error } = await supabase.functions.invoke("nethunt-push", {
      body: { entity: "lead_create_deal", id: row.id },
    });
    if (error) throw new ToolError(`NetHunt: ${error.message}`);
    if ((data as any)?.ok === false) throw new ToolError(`NetHunt: ${(data as any).error}`);
    await auditLead(supabase, ctx, row, "nethunt_deal_created", {
      nethunt_record_id: { from: null, to: (data as any)?.nethunt_record_id ?? null },
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data as any };
  },
});
