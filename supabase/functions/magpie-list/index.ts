import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternalUser } from "../_shared/require-auth.ts";
import { corsHeaders, json, magpieGet, MagpieError } from "../_shared/magpie.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const page = Math.max(1, Number(body.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(body.limit) || 50));
    const search = typeof body.search === "string" ? body.search.trim().toLowerCase() : "";

    const data = await magpieGet("/api/products", {
      page,
      limit,
      location: typeof body.location === "string" ? body.location : undefined,
      account_id: typeof body.account_id === "string" ? body.account_id : undefined,
    }, { retries: 2 });

    let products: any[] = Array.isArray(data?.products) ? data.products : [];

    if (search) {
      products = products.filter((p) =>
        [p?.name, p?.title, p?.summary, p?.category, p?.location, p?.internal_id]
          .filter(Boolean)
          .some((v: unknown) => String(v).toLowerCase().includes(search))
      );
    }

    const ids = products
      .map((p) => String(p?.id ?? p?.product_id ?? p?.magpie_id ?? ""))
      .filter(Boolean);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const imported = new Set<string>();
    if (ids.length) {
      const { data: rows } = await svc
        .from("magpie_products")
        .select("magpie_id")
        .in("magpie_id", ids);
      for (const r of rows ?? []) imported.add(r.magpie_id);
    }

    return json({
      products: products.map((p) => {
        const magpie_id = String(p?.id ?? p?.product_id ?? p?.magpie_id ?? "");
        return { ...p, magpie_id, already_imported: imported.has(magpie_id) };
      }),
      categories: Array.isArray(data?.categories) ? data.categories : [],
      locations: Array.isArray(data?.locations) ? data.locations : [],
      pagination: {
        limit_value: data?.limit_value ?? limit,
        total_pages: data?.total_pages ?? 1,
        current_page: data?.current_page ?? page,
        next_page: data?.next_page ?? null,
        prev_page: data?.prev_page ?? null,
      },
    });
  } catch (e) {
    const err = e as MagpieError;
    const status = err instanceof MagpieError ? err.status : 500;
    return json({ error: err.message || "Unexpected error listing the Magpie catalog." }, status >= 400 && status < 600 ? status : 500);
  }
});
