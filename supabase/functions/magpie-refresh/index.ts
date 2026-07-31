import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";
import {
  corsHeaders,
  json,
  fetchProductDetails,
  normalizeProduct,
  MagpieError,
} from "../_shared/magpie.ts";

const isCron = (req: Request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const header = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  return Boolean(serviceKey) && header === `Bearer ${serviceKey}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isCron(req)) {
    const auth = await requireInternalUser(req);
    if (!auth.ok) return auth.response;
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const started = new Date().toISOString();
  let ids: string[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.magpie_ids) && body.magpie_ids.length) {
      ids = [...new Set(body.magpie_ids.map((v: unknown) => String(v)).filter(Boolean))];
    } else {
      const { data: rows, error } = await svc
        .from("magpie_products")
        .select("magpie_id")
        .order("last_synced_at", { ascending: true, nullsFirst: true })
        .limit(500);
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((r) => r.magpie_id);
    }

    if (!ids.length) return json({ requested: 0, succeeded: 0, failed: 0, results: [] });

    const { data: currentRows } = await svc
      .from("magpie_products")
      .select("magpie_id, version_id")
      .in("magpie_id", ids);
    const currentVersions = new Map((currentRows ?? []).map((r) => [r.magpie_id, r.version_id]));

    const details = await fetchProductDetails(ids);
    const now = new Date().toISOString();
    const results: { magpie_id: string; ok: boolean; action: string; error?: string }[] = [];

    for (const id of ids) {
      const raw = details.get(id);

      if (!raw) {
        const { error } = await svc
          .from("magpie_products")
          .update({
            availability_status: "unavailable",
            last_synced_at: now,
            sync_status: "stale",
            sync_error: "Not returned by Magpie — marked unavailable.",
          })
          .eq("magpie_id", id);
        results.push({
          magpie_id: id,
          ok: !error,
          action: "marked_unavailable",
          error: error?.message,
        });
        continue;
      }

      const row = normalizeProduct(raw);
      if (!row) {
        results.push({ magpie_id: id, ok: false, action: "skipped", error: "Could not normalize payload." });
        continue;
      }

      const prevVersion = currentVersions.get(id) ?? null;
      const unchanged = Boolean(row.version_id) && row.version_id === prevVersion;

      const payload = unchanged
        ? {
            last_synced_at: now,
            availability_status: "available",
            sync_status: "ok",
            sync_error: null,
          }
        : { ...row, last_synced_at: now };

      const { error } = await svc
        .from("magpie_products")
        .update(payload)
        .eq("magpie_id", id);

      results.push({
        magpie_id: id,
        ok: !error,
        action: unchanged ? "touched" : "updated",
        error: error?.message,
      });
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    await svc.from("magpie_sync_log").insert({
      run_type: "refresh",
      started_at: started,
      finished_at: new Date().toISOString(),
      products_requested: ids.length,
      products_succeeded: succeeded,
      products_failed: failed,
      http_status: 200,
      error_message: failed ? `${failed} product(s) failed to refresh.` : null,
      details: { results },
    });

    return json({ requested: ids.length, succeeded, failed, results });
  } catch (e) {
    const err = e as MagpieError;
    const status = err instanceof MagpieError ? err.status : 500;
    const message = err.message || "Unexpected error refreshing products.";
    await svc.from("magpie_sync_log").insert({
      run_type: "refresh",
      started_at: started,
      finished_at: new Date().toISOString(),
      products_requested: ids.length,
      products_succeeded: 0,
      products_failed: ids.length,
      http_status: status,
      error_message: message,
      details: { magpie_ids: ids },
    });
    return json({ error: message }, status >= 400 && status < 600 ? status : 500);
  }
});
