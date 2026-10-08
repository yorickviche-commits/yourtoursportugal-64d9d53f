import { auth, defineMcp, ToolError } from "@lovable.dev/mcp-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { ALL_TOOLS, INSTRUCTIONS } from "./toolset";
import { supabaseForUser } from "./supabase";
import { agentIdentity } from "./agent";
import { withUsage } from "./usage";

/**
 * Internal core behind the `mcp-agent` gateway. The gateway verifies the
 * `ytp_agent_` key (hash, revocation, expiry, scopes, daily limit) and forwards
 * with a session of the key's technical user. Same tool files as /mcp — each
 * handler additionally refuses any caller that is not an agent technical user.
 */
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

const guarded = ALL_TOOLS.map((tool) => {
  const t = tool as any;
  return {
    ...t,
    handler: async (args: unknown, ctx: ToolContext) => {
      if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
      const agent = await agentIdentity(supabaseForUser(ctx), ctx);
      if (!agent) throw new ToolError("This endpoint only accepts agent keys (ytp_agent_...)");
      if (!agent.scopes.includes(t.name)) throw new ToolError(`Tool ${t.name} is not in this agent key's scopes`);
      return t.handler(args, ctx);
    },
  };
}) as typeof ALL_TOOLS;

export default defineMcp({
  name: "your-travel-2-0-agent",
  title: "Your Travel 2.0 (agents)",
  version: "0.4.0",
  instructions: INSTRUCTIONS,
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: false,
  }),
  tools: withUsage(guarded),
});
