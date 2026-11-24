import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { rpc } from "../decisions";
export default defineTool({
  name: "touch_decision",
  title: "Re-check a decision card",
  description: "Record that you re-verified an open card, or propose closing it with a reason. A proposed close is only a candidate for a human; it never closes the card.",
  inputSchema: {
    decision_id: z.string().uuid(),
    checked_note: z.string().min(3).max(300).describe("What you verified and against what."),
    propose_close_reason: z.string().min(3).max(300).optional().describe("e.g. 'obsoleto: cliente já pagou por transferência'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const r = await rpc(supabaseForUser(ctx), "mcp_touch_decision", { p_id: a.decision_id, p_checked_note: a.checked_note, p_close_reason: a.propose_close_reason ?? null });
    return { content: [{ type: "text", text: r.close_proposed ? "Checked; close proposed as a candidate for human review." : "Checked." }], structuredContent: r };
  },
});
