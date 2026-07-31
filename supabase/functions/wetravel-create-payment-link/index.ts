import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";
import { WETRAVEL, toWeTravelPayload, fromWeTravelResponse } from "../_shared/wetravel-schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── access token cache (in-memory, TTL) ─────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(refreshToken: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const res = await fetch(`${WETRAVEL.baseUrl}${WETRAVEL.tokenPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new HttpError(res.status, `WeTravel auth failed: ${await res.text()}`);
  const data = await res.json();
  const token = data.access_token || data.token;
  if (!token) throw new HttpError(502, "WeTravel auth: no access token in response");
  cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Retry only on 5xx / network errors, never on 4xx.
async function wtFetch(url: string, init: RequestInit, attempts = 3): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
      if (res.ok) return parsed;
      if (res.status >= 400 && res.status < 500) {
        throw new HttpError(res.status, `WeTravel [${res.status}]: ${text.slice(0, 500)}`);
      }
      lastErr = new HttpError(res.status, `WeTravel [${res.status}]: ${text.slice(0, 500)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status < 500) throw e;
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("WeTravel request failed");
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  const refreshToken = Deno.env.get("WETRAVEL_REFRESH_TOKEN");
  if (!refreshToken) return json({ error: "WeTravel refresh token não configurado" }, 500);

  const supabase: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const action: string = body.action ?? "create";

    // ── Resume publication of an existing draft ───────────────────
    if (action === "publish") {
      const { payment_link_id } = body;
      if (!payment_link_id) return json({ error: "payment_link_id obrigatório" }, 422);
      const { data: row, error } = await supabase
        .from("payment_links").select("*").eq("id", payment_link_id).maybeSingle();
      if (error || !row) return json({ error: "Link não encontrado" }, 404);
      if (row.status === "published" && row.url) return json({ payment_link: row, skipped: true });
      if (!row.wetravel_uuid) return json({ error: "Link sem UUID WeTravel — cria um novo" }, 422);

      const token = await getAccessToken(refreshToken);
      return await publish(supabase, row, token);
    }

    // ── Create ───────────────────────────────────────────────────
    const {
      lead_id, proposal_id = null, title, trip_ref = null,
      start_date = null, end_date = null,
      amount_cents, currency = "EUR", expires_at = null,
      payment_fees_paid_by = "participant",
      wetravel_fee_paid_by = "participant",
    } = body;

    if (!lead_id) return json({ error: "lead_id obrigatório" }, 422);
    if (!title || typeof title !== "string" || !title.trim()) {
      return json({ error: "Título é obrigatório" }, 422);
    }
    if (title.trim().length > 70) {
      return json({ error: "O título não pode exceder 70 caracteres" }, 422);
    }
    const cents = Number(amount_cents);
    if (!Number.isInteger(cents) || cents <= 0) {
      return json({ error: "Montante inválido — deve ser maior que zero" }, 422);
    }

    const idempotency_key = await sha256(`${lead_id}|${cents}|${title.trim()}`);

    const { data: existing } = await supabase
      .from("payment_links").select("*").eq("idempotency_key", idempotency_key).maybeSingle();

    if (existing?.status === "published" && existing.url) {
      return json({ payment_link: existing, skipped: true });
    }

    let row = existing;
    if (!row) {
      const { data: inserted, error: insErr } = await supabase
        .from("payment_links")
        .insert({
          lead_id, proposal_id, title: title.trim(), trip_ref,
          start_date, end_date, amount_cents: cents, currency,
          expires_at, payment_fees_paid_by, wetravel_fee_paid_by,
          status: "draft", idempotency_key, created_by: auth.userId,
        })
        .select("*").single();
      if (insErr) throw new Error(insErr.message);
      row = inserted;
    }

    const token = await getAccessToken(refreshToken);

    // Step 1 — create draft on WeTravel (skip if we already have a uuid)
    if (!row.wetravel_uuid) {
      try {
        const created = await wtFetch(`${WETRAVEL.baseUrl}${WETRAVEL.paymentLinksPath}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(toWeTravelPayload({
            title: row.title,
            tripRef: row.trip_ref,
            startDate: row.start_date,
            endDate: row.end_date,
            amountCents: row.amount_cents,
            currency: row.currency,
            expiresAt: row.expires_at,
            paymentFeesPaidBy: row.payment_fees_paid_by,
            wetravelFeePaidBy: row.wetravel_fee_paid_by,
          })),
        });
        const parsed = fromWeTravelResponse(created);
        if (!parsed.uuid) throw new Error("WeTravel não devolveu identificador do link");
        const { data: upd } = await supabase
          .from("payment_links")
          .update({ wetravel_uuid: parsed.uuid, url: parsed.url ?? null, last_error: null })
          .eq("id", row.id).select("*").single();
        row = upd ?? { ...row, wetravel_uuid: parsed.uuid, url: parsed.url ?? null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido";
        await supabase.from("payment_links")
          .update({ status: "failed", last_error: msg }).eq("id", row.id);
        return json({ error: msg, payment_link_id: row.id }, 502);
      }
    }

    // Step 2 — publish
    return await publish(supabase, row, token);
  } catch (e) {
    console.error("wetravel-create-payment-link error:", e);
    const status = e instanceof HttpError ? (e.status >= 400 ? 502 : 500) : 500;
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, status);
  }
});

async function publish(supabase: SupabaseClient, row: any, token: string) {
  try {
    const published = await wtFetch(`${WETRAVEL.baseUrl}${WETRAVEL.publishPath(row.wetravel_uuid)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    });
    const parsed = fromWeTravelResponse(published);
    const url = parsed.url ?? row.url;
    if (!url) throw new Error("WeTravel não devolveu o URL do link publicado");
    const { data: upd } = await supabase
      .from("payment_links")
      .update({ url, status: "published", last_error: null })
      .eq("id", row.id).select("*").single();
    return json({ payment_link: upd });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    // keep draft + uuid so publication can be resumed without recreating
    await supabase.from("payment_links")
      .update({ status: "draft", last_error: msg }).eq("id", row.id);
    return json({ error: msg, payment_link_id: row.id, resumable: true }, 502);
  }
}
