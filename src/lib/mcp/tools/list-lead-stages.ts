import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { STAGES } from "../lead";

export default defineTool({
  name: "list_lead_stages",
  title: "List lead stages",
  description:
    "List the exact pipeline stages a lead can be set to (code + label + group). Call this before update_lead_stage or before filtering list_leads by stage, so stage strings are never guessed.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const stages = STAGES.map((s) => ({ code: s.code, label: s.label, group: s.group, status: s.status }));
    return {
      content: [{ type: "text", text: JSON.stringify({ total: stages.length, stages }, null, 2) }],
      structuredContent: { total: stages.length, stages },
    };
  },
});
