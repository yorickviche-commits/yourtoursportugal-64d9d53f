import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";
import {
  corsHeaders,
  json,
  fetchProductDetails,
  normalizeProduct,
  MagpieError,
} from "../_shared/magpie.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const started = new Date().toISOString();
  let ids: string[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    ids = Array.isArray(body?.magpie_ids)
      ? [...new Set(body.magpie_ids.map((v: unknown) => String(v)).filter(Boolean))]
      : [];

    if (!ids.length) return json({ error: "magpie_ids must be a non-empty array." }, 400);
    if (ids.length > 200) return json({ error: "Import at most 200 products per run." }, 400);

    const details = await fetchProductDetails(ids);
    const results: { magpie_id: string; ok: boolean; error?: string }[] = [];

    for (const id of ids) {
      const raw = details.get(id);
      if (!raw) {
        results.push({ magpie_id: id, ok: false, error: "Not returned by Magpie (missing or inactive)." });
        continue;
      }
      const row = normalizeProduct(raw);
      if (!row) {
        results.push({ magpie_id: id, ok: false, error: "Could not normalize the Magpie payload." });
        continue;
      }

      const { error: upErr } = await svc
        .from("magpie_products")
        .upsert({ ...row, last_synced_at: new Date().toISOString() }, { onConflict: "magpie_id" });

      if (upErr) {
        results.push({ magpie_id: id, ok: false, error: upErr.message });
        continue;
      }

      // Never overwrite our editorial row.
      const { data: existing } = await svc
        .from("product_local")
        .select("id")
        .eq("magpie_id", id)
        .maybeSingle();
      if (!existing) {
        await svc.from("product_local").insert({ magpie_id: id });
      }

      results.push({ magpie_id: id, ok: true });
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    await svc.from("magpie_sync_log").insert({
      run_type: "import",
      started_at: started,
      finished_at: new Date().toISOString(),
      products_requested: ids.length,
      products_succeeded: succeeded,
      products_failed: failed,
      http_status: 200,
      error_message: failed ? `${failed} product(s) failed to import.` : null,
      details: { results },
    });

    return json({ requested: ids.length, succeeded, failed, results });
  } catch (e) {
    const err = e as MagpieError;
    const status = err instanceof MagpieError ? err.status : 500;
    const message = err.message || "Unexpected error importing products.";
    await svc.from("magpie_sync_log").insert({
      run_type: "import",
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
