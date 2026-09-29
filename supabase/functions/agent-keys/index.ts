/**
 * Admin-only management of agent API keys: create, revoke, rotate.
 * The plain key is returned exactly once on create/rotate; only its SHA-256 is stored.
 * Each key gets its own technical internal user (no password, never logs in).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(80),
    agent_label: z.string().trim().min(1).max(80),
    model: z.string().trim().max(80).optional().nullable(),
    scopes: z.array(z.string().min(1)).min(1),
    daily_call_limit: z.number().int().min(1).max(100000).default(500),
    valid_days: z.number().int().min(1).max(365).default(90),
  }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }),
  z.object({ action: z.literal("rotate"), id: z.string().uuid() }),
]);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  return "ytp_agent_" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";

async function createKey(def: {
  name: string; agent_label: string; model?: string | null; scopes: string[];
  daily_call_limit: number; valid_days: number; rotated_from?: string;
}, createdBy: string) {
  const plain = randomKey();
  const email = `agent-${slug(def.name)}-${crypto.randomUUID().slice(0, 6)}@yourtours.pt`;
  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { is_agent: true },
    user_metadata: { full_name: def.agent_label, is_agent: true },
  });
  if (ue || !u.user) throw new Error(ue?.message ?? "Could not create technical user");
  const { data, error } = await admin.from("agent_api_keys").insert({
    name: def.name,
    agent_label: def.agent_label,
    model: def.model ?? null,
    key_prefix: plain.slice(0, 12),
    key_hash: await sha256(plain),
    scopes: def.scopes,
    daily_call_limit: def.daily_call_limit,
    expires_at: new Date(Date.now() + def.valid_days * 86400000).toISOString(),
    agent_user_id: u.user.id,
    rotated_from: def.rotated_from ?? null,
    created_by: createdBy,
  }).select().single();
  if (error) {
    await admin.auth.admin.deleteUser(u.user.id);
    throw new Error(error.message);
  }
  return { key: data, plain_key: plain };
}

async function revoke(id: string) {
  const { data: k } = await admin.from("agent_api_keys").update({ revoked_at: new Date().toISOString() })
    .eq("id", id).is("revoked_at", null).select().maybeSingle();
  const { data: row } = await admin.from("agent_api_keys").select("*").eq("id", id).maybeSingle();
  if (row?.agent_user_id) await admin.auth.admin.updateUserById(row.agent_user_id, { ban_duration: "876000h" });
  return k ?? row;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who } = await admin.auth.getUser(token);
  const uid = who?.user?.id;
  if (!uid) return json({ error: "Not authenticated" }, 401);
  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: uid });
  if (!isAdmin) return json({ error: "Admins only" }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;

  try {
    if (b.action === "create") return json(await createKey(b, uid));
    if (b.action === "revoke") return json({ key: await revoke(b.id) });
    const { data: old } = await admin.from("agent_api_keys").select("*").eq("id", b.id).maybeSingle();
    if (!old) return json({ error: "Key not found" }, 404);
    const days = Math.max(1, Math.round((new Date(old.expires_at).getTime() - new Date(old.created_at).getTime()) / 86400000));
    await revoke(old.id);
    return json(await createKey({
      name: old.name, agent_label: old.agent_label, model: old.model, scopes: old.scopes,
      daily_call_limit: old.daily_call_limit, valid_days: Math.min(days, 365), rotated_from: old.id,
    }, uid));
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
