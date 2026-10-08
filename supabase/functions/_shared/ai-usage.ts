// AI usage telemetry for edge functions → public.ai_usage_events (via ai_usage_heartbeat).
// Everything here is fire-and-forget: logging never delays or breaks the AI call.
import { AsyncLocalStorage } from "node:async_hooks";

type Provider = "lovable" | "gemini" | "openai" | "anthropic" | string;
interface Ctx { fn?: string; actor_email?: string | null; lead_code?: string | null }

const store = new AsyncLocalStorage<Ctx>();

/** Called by requireInternalUser: binds function name + user email to this request. */
export function bindAiRequest(req: Request, actorEmail?: string | null) {
  try {
    const segs = new URL(req.url).pathname.split("/").filter(Boolean).filter((s) => s !== "functions" && s !== "v1");
    store.enterWith({ fn: segs[0], actor_email: actorEmail ?? null });
  } catch { /* ignore */ }
}
/** Attach the lead code once the function knows it. */
export function setAiLeadCode(code?: string | null) {
  try { const s = store.getStore(); if (s && code) s.lead_code = String(code); } catch { /* ignore */ }
}

// USD per 1M tokens [input, output]. Longest key wins (prefix match).
const PRICES: Record<string, [number, number]> = {
  "gemini-2.5-flash-lite": [0.10, 0.40],
  "gemini-2.0-flash": [0.10, 0.40],
  "gemini-2.5-flash": [0.30, 2.50],
  "gemini-2.5-pro": [1.25, 10],
  "gpt-4o-mini": [0.15, 0.60],
  "gpt-4o": [2.50, 10],
  "claude-sonnet-4-5": [3, 15],
  "claude-3-5-sonnet": [3, 15],
  "claude-3-5-haiku": [0.80, 4],
  "text-embedding-3-small": [0.02, 0],
};
const PRICE_KEYS = Object.keys(PRICES).sort((a, b) => b.length - a.length);

const isImageModel = (model?: string | null) => !!model && /image/i.test(model);

export function estimateCost(model: string | null | undefined, inTok?: number | null, outTok?: number | null): number | null {
  if (!model || isImageModel(model) || (inTok == null && outTok == null)) return null;
  const m = model.toLowerCase().replace(/^[a-z]+\//, "");
  const key = PRICE_KEYS.find((k) => m.startsWith(k));
  if (!key) return null;
  const [pi, po] = PRICES[key];
  return Number((((inTok ?? 0) * pi + (outTok ?? 0) * po) / 1_000_000).toFixed(6));
}

export interface Usage { input_tokens: number | null; output_tokens: number | null }

/** OpenAI/Lovable gateway, Gemini direct, Anthropic and OpenAI embeddings formats. */
export function extractUsage(body: any): Usage {
  const u = body?.usage;
  if (u && (u.prompt_tokens != null || u.completion_tokens != null)) {
    return { input_tokens: u.prompt_tokens ?? null, output_tokens: u.completion_tokens ?? (u.total_tokens != null && u.prompt_tokens != null ? 0 : null) };
  }
  if (u && (u.input_tokens != null || u.output_tokens != null)) {
    return { input_tokens: u.input_tokens ?? null, output_tokens: u.output_tokens ?? null };
  }
  const g = body?.usageMetadata;
  if (g) return { input_tokens: g.promptTokenCount ?? null, output_tokens: g.candidatesTokenCount ?? null };
  return { input_tokens: null, output_tokens: null };
}

function bg(p: Promise<unknown>) {
  try {
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(p.catch(() => {}));
    else p.catch(() => {});
  } catch { /* ignore */ }
}

async function heartbeat(args: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const res = await fetch(`${url}/rest/v1/rpc/ai_usage_heartbeat`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) console.warn("ai_usage_heartbeat failed", res.status, (await res.text()).slice(0, 200));
}

const pending = new Map<string, Promise<unknown>>();

export function startAiCall(opts: {
  fn?: string; provider: Provider; model?: string | null; lead_code?: string | null;
  actor_email?: string | null; meta?: Record<string, unknown>;
}): string {
  const key = crypto.randomUUID();
  try {
    const s = store.getStore() ?? {};
    const fn = opts.fn ?? s.fn ?? "edge";
    const meta = { ...(opts.meta ?? {}), ...(isImageModel(opts.model) ? { kind: "image" } : {}) };
    const p = heartbeat({
      p_session_key: key, p_source: "tcc_edge", p_surface: fn, p_status: "running",
      p_provider: opts.provider, p_model: opts.model ?? null,
      p_lead_code: opts.lead_code ?? s.lead_code ?? null, p_actor_email: opts.actor_email ?? s.actor_email ?? null,
      p_calls_inc: 1, p_meta: meta,
    }).catch((e) => console.warn("startAiCall", (e as Error).message));
    pending.set(key, p);
    bg(p);
  } catch (e) { console.warn("startAiCall", (e as Error).message); }
  return key;
}

export function finishAiCall(key: string, opts: {
  status: "ok" | "error"; provider?: Provider; model?: string | null; usage?: Partial<Usage> | null;
  error?: string | null; meta?: Record<string, unknown>;
}) {
  try {
    const before = pending.get(key) ?? Promise.resolve();
    pending.delete(key);
    const inTok = opts.usage?.input_tokens ?? null;
    const outTok = opts.usage?.output_tokens ?? null;
    const s = store.getStore() ?? {};
    const meta: Record<string, unknown> = { ...(opts.meta ?? {}) };
    if (opts.error) meta.error = String(opts.error).slice(0, 500);
    if (isImageModel(opts.model)) meta.kind = "image";
    bg(before.then(() => heartbeat({
      p_session_key: key, p_source: "tcc_edge", p_status: opts.status,
      p_provider: opts.provider ?? null, p_model: opts.model ?? null, p_lead_code: s.lead_code ?? null,
      p_calls_inc: 0, p_input_tokens: inTok, p_output_tokens: outTok,
      p_cost_usd: estimateCost(opts.model, inTok, outTok), p_meta: meta,
    })).catch((e) => console.warn("finishAiCall", (e as Error).message)));
  } catch (e) { console.warn("finishAiCall", (e as Error).message); }
}

function detect(url: string, init?: RequestInit): { provider: Provider; model: string | null; image: boolean } {
  let model: string | null = null;
  try {
    if (typeof init?.body === "string") model = JSON.parse(init.body)?.model ?? null;
  } catch { /* ignore */ }
  const gm = url.match(/\/models\/([^:/?]+):/);
  if (!model && gm) model = gm[1];
  const provider = url.includes("ai.gateway.lovable.dev") ? "lovable"
    : url.includes("generativelanguage.googleapis.com") ? "gemini"
    : url.includes("api.openai.com") ? "openai"
    : url.includes("api.anthropic.com") ? "anthropic" : "other";
  return { provider, model, image: url.includes("/images/") || isImageModel(model) };
}

/**
 * Drop-in replacement for fetch() on AI provider calls. Logs one row per attempt
 * (provider/model/status/tokens/cost). Never throws because of telemetry.
 */
export async function aiFetch(input: string | URL, init?: RequestInit, extra?: { model?: string; meta?: Record<string, unknown> }): Promise<Response> {
  const url = String(input);
  let key: string | null = null;
  let info = { provider: "other" as Provider, model: null as string | null, image: false };
  try {
    info = detect(url, init);
    if (extra?.model) info.model = extra.model;
    key = startAiCall({ provider: info.provider, model: info.model, meta: { ...(extra?.meta ?? {}), ...(info.image ? { kind: "image" } : {}) } });
  } catch { /* ignore */ }

  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    if (key) finishAiCall(key, { status: "error", provider: info.provider, model: info.model, error: (e as Error).message });
    throw e;
  }

  if (key) {
    try {
      const k = key;
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const clone = res.clone();
        bg(clone.text().then((t) => finishAiCall(k, { status: "error", provider: info.provider, model: info.model, error: `HTTP ${res.status}: ${t.slice(0, 300)}` }))
          .catch(() => finishAiCall(k, { status: "error", provider: info.provider, model: info.model, error: `HTTP ${res.status}` })));
      } else if (ct.includes("application/json")) {
        const clone = res.clone();
        bg(clone.json().then((j) => finishAiCall(k, { status: "ok", provider: info.provider, model: j?.model ?? info.model, usage: extractUsage(j) }))
          .catch(() => finishAiCall(k, { status: "ok", provider: info.provider, model: info.model })));
      } else {
        finishAiCall(k, { status: "ok", provider: info.provider, model: info.model, meta: { streamed: true } });
      }
    } catch { /* ignore */ }
  }
  return res;
}
