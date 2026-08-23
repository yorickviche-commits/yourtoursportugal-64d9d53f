// YT Brain — retrieval function.
// Body: { query, context?: 'internal' | 'client_facing', match_count? }
import { corsHeadersAuth, requireInternalUser } from "../_shared/require-auth.ts";
import { retrieveKnowledge, BRAIN_INSTRUCTION } from "../_shared/ytb-knowledge.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersAuth, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersAuth });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { query, context, match_count } = await req.json();
    if (!query || typeof query !== "string") return json({ error: "query required" }, 400);
    const ctx = context === "client_facing" ? "client_facing" : "internal";
    const chunks = await retrieveKnowledge(query, ctx, Math.min(Number(match_count) || 8, 20));
    return json({ ok: true, context: ctx, instruction: BRAIN_INSTRUCTION, chunks });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
