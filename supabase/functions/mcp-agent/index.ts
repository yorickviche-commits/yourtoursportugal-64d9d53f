/**
 * Public MCP endpoint for scheduled AI agents (Grok Worker, Claude Supervisor…).
 * Accepts only `Authorization: Bearer ytp_agent_...` keys. Verifies hash,
 * revocation, expiry, daily limit and tool scope, then forwards the MCP request
 * to the internal `mcp-agent-core` function (same tool files as /mcp) with a
 * short-lived session of the key's technical user, so RLS runs as that user.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const sessions = new Map<string, { token: string; exp: number }>();

const rpcError = (id: unknown, message: string, status = 200) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code: -32001, message } }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sessionFor(keyId: string, userId: string) {
  const c = sessions.get(keyId);
  if (c && c.exp - 120 > Date.now() / 1000) return c.token;
  const { data: u, error: ue } = await admin.auth.admin.getUserById(userId);
  if (ue || !u?.user?.email) throw new Error("Agent technical user missing");
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (le) throw new Error(le.message);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: se } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (se || !s.session) throw new Error(se?.message ?? "Could not start agent session");
  sessions.set(keyId, { token: s.session.access_token, exp: s.session.expires_at ?? Date.now() / 1000 + 3000 });
  return s.session.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer.startsWith("ytp_agent_")) {
    return rpcError(null, "This endpoint requires an agent key: Authorization: Bearer ytp_agent_...", 401);
  }

  const raw = req.method === "POST" ? await req.text() : "";
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* forwarded as-is */ }
  const msgs = Array.isArray(body) ? body : body ? [body] : [];
  const firstId = msgs[0]?.id;

  const { data: key } = await admin.from("agent_api_keys").select("*").eq("key_hash", await sha256(bearer)).maybeSingle();
  if (!key) return rpcError(firstId, "Invalid agent key", 401);
  if (key.revoked_at) return rpcError(firstId, "Agent key revoked", 401);
  if (new Date(key.expires_at).getTime() < Date.now()) return rpcError(firstId, "Agent key expired — rotate it in Configurações › Agentes AI", 401);
  if (!key.agent_user_id) return rpcError(firstId, "Agent key has no technical user", 500);

  const calls = msgs.filter((m) => m?.method === "tools/call");
  for (const c of calls) {
    const tool = c?.params?.name;
    if (!key.scopes.includes(tool)) return rpcError(c.id, `Tool '${tool}' is not allowed for key '${key.name}' (scopes: ${key.scopes.join(", ")})`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const used = key.calls_day === today ? key.calls_today : 0;
  if (calls.length && used + calls.length > key.daily_call_limit) {
    return rpcError(firstId, `Daily call limit reached (${key.daily_call_limit}) for key '${key.name}'`);
  }
  await admin.from("agent_api_keys").update({
    last_used_at: new Date().toISOString(),
    calls_today: used + calls.length,
    calls_day: today,
  }).eq("id", key.id);

  let token: string;
  try {
    token = await sessionFor(key.id, key.agent_user_id);
  } catch (e) {
    return rpcError(firstId, `Agent session failed: ${(e as Error).message}`, 500);
  }

  const headers = new Headers();
  for (const h of ["content-type", "accept", "mcp-session-id", "mcp-protocol-version"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("authorization", `Bearer ${token}`);
  headers.set("apikey", ANON);

  const res = await fetch(`${URL_}/functions/v1/mcp-agent-core`, {
    method: req.method,
    headers,
    body: req.method === "POST" ? raw : undefined,
  });
  const out = new Headers(res.headers);
  Object.entries(cors).forEach(([k, v]) => out.set(k, v));
  out.delete("www-authenticate");
  return new Response(res.body, { status: res.status, headers: out });
});
