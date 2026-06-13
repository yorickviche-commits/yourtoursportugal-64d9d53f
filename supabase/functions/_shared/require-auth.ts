// Shared auth helpers for edge functions.
// Verifies the caller is an internal user (has a role in user_roles) and optionally an admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeadersAuth = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type AuthResult =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; response: Response };

function unauthorized(message: string, status = 401, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeadersAuth, "Content-Type": "application/json", ...extraHeaders },
  });
}

export async function requireInternalUser(
  req: Request,
  opts: { adminOnly?: boolean } = {},
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: unauthorized("Missing bearer token") };
  }
  const jwt = authHeader.slice(7);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

  const { data: claims, error: claimsErr } = await sb.auth.getClaims(jwt);
  if (claimsErr || !claims?.claims?.sub) {
    return { ok: false, response: unauthorized("Invalid or expired token") };
  }
  const userId = claims.claims.sub as string;

  // Role check uses service role to bypass any RLS on user_roles
  const svc = createClient(url, service);
  const { data: roles, error: rolesErr } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesErr) {
    return { ok: false, response: unauthorized("Role lookup failed", 500) };
  }
  if (!roles || roles.length === 0) {
    return { ok: false, response: unauthorized("Forbidden — not an internal user", 403) };
  }
  const isAdmin = roles.some((r: any) => r.role === "admin" || r.role === "super_admin");
  if (opts.adminOnly && !isAdmin) {
    return { ok: false, response: unauthorized("Forbidden — admin only", 403) };
  }
  return { ok: true, userId, isAdmin };
}
