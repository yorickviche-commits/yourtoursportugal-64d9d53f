import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";
import { agentIdentity } from "./agent";

/** AI usage telemetry (public.ai_usage_heartbeat, service_role only). Fire-and-forget. */
type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
  EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
};
const env = (n: string) => {
  const g = globalThis as RuntimeGlobals;
  return (g.Deno?.env?.get?.(n) ?? g.process?.env?.[n])?.trim() || undefined;
};

export function heartbeat(args: Record<string, unknown>): Promise<void> {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return Promise.resolve();
  return fetch(`${url}/rest/v1/rpc/ai_usage_heartbeat`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })
    .then(async (r) => {
      if (!r.ok) console.warn("ai_usage_heartbeat", r.status, (await r.text()).slice(0, 200));
    })
    .catch((e) => console.warn("ai_usage_heartbeat", (e as Error).message));
}

function bg(p: Promise<unknown>) {
  try {
    const er = (globalThis as RuntimeGlobals).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(p);
  } catch { /* ignore */ }
}

function jwtClaims(token: string | null | undefined): Record<string, any> {
  try {
    const part = String(token).split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
  } catch {
    return {};
  }
}

/** One live session per Claude ↔ TCC connection; each tool call bumps it. */
export function trackToolCall(ctx: ToolContext, toolName: string, args: any) {
  try {
    const p = (async () => {
      const claims = jwtClaims(ctx.getToken());
      const agent = await agentIdentity(supabaseForUser(ctx), ctx).catch(() => null);
      const sid = claims.session_id ?? agent?.id ?? "nosession";
      const leadCode = args?.lead_code ?? null;
      await heartbeat({
        p_session_key: `mcp-${claims.sub ?? "anon"}-${sid}`,
        p_source: "claude_mcp",
        p_surface: "TCC MCP (Your Travel 2.0)",
        p_agent_label: agent?.agent_label ?? "Claude via MCP",
        p_status: "running",
        p_summary: leadCode ? `${toolName} · ${leadCode}` : toolName,
        p_lead_code: leadCode,
        p_model: agent?.model ?? null,
        p_actor_email: ctx.getUserEmail?.() ?? claims.email ?? null,
        p_calls_inc: 1,
        p_meta: { last_tool: toolName, ...(agent ? { agent_key_id: agent.id } : {}) },
      });
    })().catch(() => {});
    bg(p);
  } catch { /* ignore */ }
}

/** Wraps every tool handler so each call is counted. Never blocks/breaks the tool. */
export function withUsage<T extends readonly unknown[]>(tools: T): T {
  return tools.map((tool) => {
    const t = tool as any;
    return {
      ...t,
      handler: async (args: unknown, ctx: ToolContext) => {
        if (t.name !== "log_ai_session") trackToolCall(ctx, t.name, args);
        return t.handler(args, ctx);
      },
    };
  }) as unknown as T;
}
