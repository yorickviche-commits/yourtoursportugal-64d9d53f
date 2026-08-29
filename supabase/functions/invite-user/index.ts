// Cria/reenvia um convite de utilizador e envia o email pelo conector Gmail.
// Apenas Super Admin / Admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser, corsHeadersAuth as corsHeaders } from "../_shared/require-auth.ts";

const GATEWAY_SEND = "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send";

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);
const b64url = (s: string) => b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function inviteHtml(loginUrl: string, roleLabel: string, inviterName: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0a2540">Your Tours Portugal — acesso à plataforma</h1>
      <p style="font-size:14px;color:#334155;line-height:1.6">
        Olá,<br><br>
        ${inviterName} convidou-te para a plataforma interna da Your Tours Portugal com o perfil
        <strong>${roleLabel}</strong>.
      </p>
      <p style="font-size:14px;color:#334155;line-height:1.6">
        Clica no botão abaixo e entra com a tua conta Google. Depois define a tua password e confirma os teus dados.
      </p>
      <p style="margin:28px 0">
        <a href="${loginUrl}" style="background:#0a2540;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;display:inline-block">
          Entrar na plataforma
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;line-height:1.6">
        Este convite é válido por 14 dias. Se não conseguires clicar no botão, abre este endereço: <br>${loginUrl}
      </p>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireInternalUser(req, { adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const roleCode = typeof body?.role === "string" && body.role.trim() ? body.role.trim() : "viewer";
    const appUrl = typeof body?.appUrl === "string" && /^https?:\/\//.test(body.appUrl)
      ? body.appUrl.replace(/\/$/, "")
      : "https://yourtourportugal.lovable.app";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Email inválido" }, 400);
    }

    const { data: role } = await svc.from("app_roles").select("code, label").eq("code", roleCode).maybeSingle();
    if (!role) return json({ error: "Role desconhecida" }, 400);

    const { data: existingProfile } = await svc.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (existingProfile) return json({ error: "Já existe um utilizador com este email" }, 409);

    // Cria ou reutiliza o convite pendente
    const { data: pending } = await svc
      .from("user_invites")
      .select("*")
      .ilike("email", email)
      .eq("status", "pending")
      .maybeSingle();

    let invite = pending;
    if (invite) {
      const { data: updated, error } = await svc
        .from("user_invites")
        .update({
          role_code: roleCode,
          last_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
          invited_by: auth.userId,
        })
        .eq("id", invite.id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      invite = updated;
    } else {
      const { data: created, error } = await svc
        .from("user_invites")
        .insert({ email, role_code: roleCode, invited_by: auth.userId })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      invite = created;
    }

    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      return json({ invite, emailSent: false, warning: "Conector Gmail não configurado — convite criado sem email." });
    }

    const { data: inviter } = await svc.from("profiles").select("full_name, email").eq("id", auth.userId).maybeSingle();
    const inviterName = inviter?.full_name || inviter?.email || "A equipa Your Tours";
    const loginUrl = `${appUrl}/login?invite=${invite.token}`;
    const subject = "Convite — Plataforma Your Tours Portugal";
    const html = inviteHtml(loginUrl, role.label, inviterName);

    const mime = [
      `To: ${email}`,
      `From: ${header("Your Tours Portugal")} <me>`,
      `Subject: ${header(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      html,
    ].join("\r\n");

    const res = await fetch(GATEWAY_SEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: b64url(mime) }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error("Gmail send failed", res.status, details);
      return json({ invite, emailSent: false, error: `Gmail ${res.status}`, details }, 502);
    }

    return json({ invite, emailSent: true });
  } catch (e) {
    console.error("invite-user error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
