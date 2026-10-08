import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { heartbeat } from "../usage";

export default defineTool({
  name: "log_ai_session",
  title: "Log AI session (telemetry)",
  description:
    "Report usage of a Claude session running outside the TCC (Chrome extension, scheduled task, chat, cowork). Call it at start, periodically while working (status 'running') and at the end ('ok' / 'error'). Tokens and cost are added to the session totals. Telemetry only — no approval needed, no business data changes.",
  inputSchema: {
    session_key: z.string().trim().min(3).max(200).describe("Stable id for this session; reuse it on every report."),
    source: z.enum(["claude_scheduled", "claude_chrome", "claude_chat", "claude_cowork", "claude_mcp", "other"]).optional(),
    surface: z.string().max(200).optional().describe("Where it runs, e.g. 'Chrome extension'."),
    status: z.enum(["running", "ok", "error", "abandoned"]).optional(),
    summary: z.string().max(1000).optional(),
    lead_code: z.string().max(50).optional(),
    model: z.string().max(100).optional(),
    input_tokens: z.number().int().min(0).optional(),
    output_tokens: z.number().int().min(0).optional(),
    cost_usd: z.number().min(0).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    await heartbeat({
      p_session_key: a.session_key,
      p_source: a.source ?? "other",
      p_surface: a.surface ?? null,
      p_agent_label: "Claude",
      p_status: a.status ?? "running",
      p_summary: a.summary ?? null,
      p_lead_code: a.lead_code ?? null,
      p_provider: "anthropic",
      p_model: a.model ?? null,
      p_actor_email: ctx.getUserEmail?.() ?? null,
      p_calls_inc: 1,
      p_input_tokens: a.input_tokens ?? null,
      p_output_tokens: a.output_tokens ?? null,
      p_cost_usd: a.cost_usd ?? null,
      p_meta: {},
    });
    const payload = { logged: true, session_key: a.session_key, status: a.status ?? "running" };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
