import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { auditLead, leadLabel, pushNetHunt, resolveLead } from "../lead";

export default defineTool({
  name: "add_lead_note",
  title: "Add internal lead note",
  description:
    "Add an internal note to a lead. The note shows in the lead history/timeline and is replicated as a NetHunt comment when the lead is linked. Notes are internal — nothing is sent to the client.",
  inputSchema: {
    lead_id: z.string().optional().describe("Lead uuid."),
    lead_code: z.string().optional().describe("Lead code such as YT5130."),
    text: z.string().trim().min(1).describe("Note body."),
    pin: z.boolean().optional().describe("Pin the note at the top of the lead notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ lead_id, lead_code, text, pin }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const lead = await resolveLead(supabase, { lead_id, lead_code });

    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const author = ctx.getUserEmail() ?? "AI agent (MCP)";
    const entry = `[${stamp}] ${author} (AI agent via MCP): ${text}`;
    const existing = String((lead as any).notes || "").trim();

    // Idempotent: the exact same note text is not appended twice.
    if (existing.includes(text.trim())) {
      const payload = { lead: leadLabel(lead), lead_id: lead.id, added: false, reason: "Identical note already present" };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
    }

    const notes = pin ? [entry, existing].filter(Boolean).join("\n\n") : [existing, entry].filter(Boolean).join("\n\n");
    const { error } = await supabase.from("leads").update({ notes } as never).eq("id", lead.id);
    if (error) throw new ToolError(error.message);

    await auditLead(supabase, ctx, lead, "lead_note_added", { notes: { from: existing || null, to: entry } }, { pinned: Boolean(pin) });

    const sync = await pushNetHunt(supabase, "comment", lead.id, { text: entry }, Boolean(lead.nethunt_record_id));

    const payload = { lead: leadLabel(lead), lead_id: lead.id, added: true, pinned: Boolean(pin), note: entry, nethunt_sync: sync };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  },
});
