import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { ALL_TOOLS, INSTRUCTIONS } from "./toolset";
import { withUsage } from "./usage";

// Issuer must be the direct Supabase host, built from the project ref literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "your-travel-2-0",
  title: "Your Travel 2.0",
  version: "0.4.0",
  instructions: INSTRUCTIONS,
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: withUsage(ALL_TOOLS),
});
