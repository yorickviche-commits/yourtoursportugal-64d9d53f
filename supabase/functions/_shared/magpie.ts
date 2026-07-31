// Shared Magpie Travel API helpers. Server-side only — never import in client code.
export const MAGPIE_BASE_URL = "https://magpie.travel";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export class MagpieError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function humanError(status: number): string {
  switch (status) {
    case 400:
      return "Magpie rejected the request parameters (400).";
    case 401:
      return "Magpie authentication failed — the API key is invalid or expired (401).";
    case 404:
      return "The requested Magpie resource was not found (404).";
    case 429:
      return "Magpie rate limit reached (429). Try again shortly.";
    default:
      return status >= 500
        ? `Magpie server error (${status}).`
        : `Unexpected Magpie response (${status}).`;
  }
}

/** Performs a GET against Magpie with the secret header. Never logs the key. */
export async function magpieGet(
  path: string,
  params: Record<string, string | number | undefined>,
  opts: { retries?: number } = {},
): Promise<any> {
  const apiKey = Deno.env.get("MAGPIE_API_KEY");
  if (!apiKey) throw new MagpieError(500, "MAGPIE_API_KEY is not configured.");

  const url = new URL(path, MAGPIE_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}` !== "") url.searchParams.set(k, `${v}`);
  }

  const retries = opts.retries ?? 0;
  let lastErr: MagpieError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const err = new MagpieError(res.status, humanError(res.status));
        // Only 5xx are worth retrying
        if (res.status >= 500 && attempt < retries) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      return await res.json();
    } catch (e) {
      if (e instanceof MagpieError) throw e;
      const err = new MagpieError(504, `Magpie request failed: ${(e as Error).message}`);
      if (attempt < retries) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new MagpieError(500, "Magpie request failed.");
}

const first = (...vals: unknown[]) =>
  vals.find((v) => v !== undefined && v !== null && v !== "") ?? null;

const asText = (v: unknown): string | null => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
};

const asNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const asInt = (v: unknown): number | null => {
  const n = asNum(v);
  return n === null ? null : Math.round(n);
};

const asBool = (v: unknown): boolean | null => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (["true", "yes", "1", "y"].includes(s)) return true;
  if (["false", "no", "0", "n"].includes(s)) return false;
  return null;
};

const asDate = (v: unknown): string | null => {
  const s = asText(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const asArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null || v === "") return [];
  if (typeof v === "string") {
    return v
      .split(/\r?\n|•/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof v === "object") return Object.values(v as Record<string, unknown>);
  return [];
};

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function rateFor(p: any, keys: string[]): number | null {
  for (const k of keys) {
    const direct = asNum(p?.[k]);
    if (direct !== null) return direct;
  }
  const buckets = [p?.retail_rates, p?.rates, p?.pricing, p?.prices];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      for (const row of bucket) {
        const label = String(
          row?.pax_type ?? row?.type ?? row?.name ?? row?.category ?? "",
        ).toLowerCase();
        if (keys.some((k) => label.includes(k.replace("retail_rate_", "")))) {
          const val = asNum(row?.retail_rate ?? row?.rate ?? row?.price ?? row?.amount);
          if (val !== null) return val;
        }
      }
    } else if (bucket && typeof bucket === "object") {
      for (const k of keys) {
        const short = k.replace("retail_rate_", "");
        const val = asNum((bucket as any)[short] ?? (bucket as any)[k]);
        if (val !== null) return val;
      }
    }
  }
  return null;
}

function normalizeImages(p: any): unknown[] {
  const out: { url: string; ttd_url?: string; caption?: string | null }[] = [];
  const push = (url: unknown, ttd?: unknown, caption?: unknown) => {
    const u = asText(url);
    const t = asText(ttd);
    if (!u && !t) return;
    const key = (u ?? t) as string;
    if (out.some((i) => i.url === key)) return;
    out.push({ url: key, ttd_url: t ?? undefined, caption: asText(caption) });
  };

  push(p?.image_url, p?.image_ttd_url);
  for (const img of asArray(p?.images)) {
    if (typeof img === "string") push(img);
    else {
      const o = asObject(img);
      push(o.image_url ?? o.url ?? o.src, o.image_ttd_url ?? o.ttd_url, o.caption ?? o.title);
    }
  }
  for (const img of asArray(p?.photos)) {
    if (typeof img === "string") push(img);
    else {
      const o = asObject(img);
      push(o.image_url ?? o.url, o.image_ttd_url, o.caption);
    }
  }
  return out;
}

/** Maps a raw Magpie product into our magpie_products row shape. */
export function normalizeProduct(p: any) {
  const magpieId = asText(first(p?.id, p?.product_id, p?.magpie_id, p?.uuid));
  if (!magpieId) return null;

  const duration = asObject(p?.duration);

  return {
    magpie_id: magpieId,
    version_id: asText(first(p?.version_id, p?.version, p?.updated_at, p?.last_modified)),
    internal_id: asText(first(p?.internal_id, p?.short_code, p?.code, p?.reference)),
    name: asText(first(p?.name, p?.title, p?.product_name)) ?? `Magpie ${magpieId}`,
    account_id: asText(first(p?.account_id, p?.account?.id, p?.supplier_id)),
    account_name: asText(first(p?.account_name, p?.account?.name, p?.supplier_name)),
    summary: asText(first(p?.summary, p?.short_description)),
    description: asText(first(p?.description, p?.body)),
    long_description: asText(first(p?.long_description, p?.full_description)),
    additional_info: asText(first(p?.additional_info, p?.additional_information)),
    category: asText(first(p?.category, p?.category_name, p?.categories?.[0])),
    location: asText(first(p?.location, p?.location_name, p?.city, p?.destination)),
    currency: asText(first(p?.currency, p?.currency_code)),
    language: asText(first(p?.language, p?.languages?.[0])),
    timezone: asText(first(p?.timezone, p?.time_zone)),
    duration_text: asText(first(p?.duration_text, duration.text, typeof p?.duration === "string" ? p.duration : null)),
    duration_type: asText(first(p?.duration_type, duration.type)),
    duration_from: asNum(first(p?.duration_from, duration.from, duration.min)),
    duration_to: asNum(first(p?.duration_to, duration.to, duration.max)),
    duration_unit: asText(first(p?.duration_unit, duration.unit)),
    min_pax: asInt(first(p?.min_pax, p?.minimum_pax, p?.min_travellers)),
    max_pax: asInt(first(p?.max_pax, p?.maximum_pax, p?.max_travellers)),
    max_group_size: asInt(first(p?.max_group_size, p?.group_size_max)),
    multiday: asBool(first(p?.multiday, p?.multi_day, p?.is_multiday)),
    private: asBool(first(p?.private, p?.is_private)),
    confirmation_required: asBool(first(p?.confirmation_required, p?.requires_confirmation)),
    redemption_type: asText(first(p?.redemption_type, p?.redemption)),
    guide_type: asText(first(p?.guide_type, p?.guide)),
    trip_difficulty: asText(first(p?.trip_difficulty, p?.difficulty)),
    cancellation_policy: asText(first(p?.cancellation_policy, p?.cancellation)),
    cancellation_cutoff: asText(first(p?.cancellation_cutoff, p?.cancellation_cut_off)),
    cancellation_notes: asText(first(p?.cancellation_notes, p?.cancellation_note)),
    terms_and_conditions: asText(first(p?.terms_and_conditions, p?.terms)),
    voucher_info: asText(first(p?.voucher_info, p?.voucher_information)),
    booking_cutoff: asText(first(p?.booking_cutoff, p?.booking_cut_off)),
    valid_for: asText(first(p?.valid_for, p?.validity)),
    start_date: asDate(first(p?.start_date, p?.valid_from)),
    end_date: asDate(first(p?.end_date, p?.valid_to)),
    retail_rate_adult: rateFor(p, ["retail_rate_adult", "adult"]),
    retail_rate_youth: rateFor(p, ["retail_rate_youth", "youth"]),
    retail_rate_child: rateFor(p, ["retail_rate_child", "child"]),
    retail_rate_infant: rateFor(p, ["retail_rate_infant", "infant"]),
    retail_rate_senior: rateFor(p, ["retail_rate_senior", "senior"]),
    highlights: asArray(first(p?.highlights, p?.highlight)),
    included: asArray(first(p?.included, p?.inclusions, p?.includes)),
    excluded: asArray(first(p?.excluded, p?.exclusions, p?.excludes)),
    before_booking: asArray(first(p?.before_booking, p?.know_before_booking)),
    before_arrival: asArray(first(p?.before_arrival, p?.know_before_arrival)),
    restrictions: asArray(p?.restrictions),
    addresses: asArray(first(p?.addresses, p?.address)),
    commentaries: asArray(first(p?.commentaries, p?.comments)),
    opening_hours: asObject(first(p?.opening_hours, p?.hours)),
    health_items: asArray(first(p?.health_items, p?.health_and_safety)),
    images: normalizeImages(p),
    accessibility: asObject(p?.accessibility),
    raw_payload: p,
    availability_status: "available",
    sync_status: "ok",
    sync_error: null,
  };
}

/** Fetches product details in batches of max 20 ids. */
export async function fetchProductDetails(ids: string[]): Promise<Map<string, any>> {
  const found = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const data = await magpieGet(
      "/api/products/get_products",
      { product_ids: batch.join(","), format: "json" },
      { retries: 3 },
    );
    for (const account of asArray(data?.accounts)) {
      const acc = asObject(account);
      for (const product of asArray(acc.products)) {
        const p = asObject(product) as any;
        const id = asText(first(p.id, p.product_id, p.magpie_id));
        if (!id) continue;
        if (!p.account_id && acc.id) p.account_id = acc.id;
        if (!p.account_name && acc.name) p.account_name = acc.name;
        found.set(id, p);
      }
    }
  }
  return found;
}
