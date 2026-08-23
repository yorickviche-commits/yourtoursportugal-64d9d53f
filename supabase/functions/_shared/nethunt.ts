// Shared NetHunt CRM helpers: API client, folder/field constants and bidirectional mappings.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-nethunt-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BASE = "https://nethunt.com/api/v1/zapier";

export const DEALS_FOLDER = "67bf55d488a689554e6a1c22";
export const TASKS_FOLDER = "67bf55d488a689554e6a1c24";
export const WORKSPACE_ID = "67bf55d388a689554e6a1c1b";

/** Builds the NetHunt deep link for a record (same scheme the API returns). */
export function recordLink(recordId: string, folderId = DEALS_FOLDER) {
  const payload = JSON.stringify({
    workspaceId: WORKSPACE_ID,
    folderId,
    recordId,
    recordPage: { recordId },
  });
  return `https://nethunt.com/web/#nethunt/${btoa(payload)}`;
}

// The NetHunt Zapier API addresses fields by NAME; ids are kept as read fallbacks.
export const F = {
  name: ["Name", "name"],
  ytId: ["YT ID/Referencia", "79"],
  stage: ["Stage", "2"],
  tripStart: ["Trip Start", "82"],
  tripFinish: ["Trip Finish", "83"],
  closeDate: ["Close date", "10"],
  clientType: ["B2B / B2C", "72"],
  source: ["Source (Site, OTA, Direct)", "73"],
} as const;

export const TF = {
  name: ["Name", "name"],
  completed: ["Completed", "13"],
  dueDate: ["Due date", "14"],
  priority: ["Priority", "3"],
  description: ["Description", "18"],
  assignee: ["Assignee", "11"],
  recordLinks: ["Record links", "10"],
  creator: ["Creator", "16"],
  allDay: ["All day", "12"],
} as const;

export const STAGES = [
  "SALES - New Lead",
  "SALES - - Budgeting & Fine-Tuning",
  "SALES - Final Negotiation & Ready to Book",
  "OPERATIONS - Deposit/Payment Received",
  "OPERATIONS - Suppliers Bookings & Confirmations",
  "OPERATIONS - Technical Briefing (Internal & Suppliers Final Validations)",
  "OPERATIONS - Trip Ready / In Execution",
  "OPERATIONS - Post-Trip Loop / Feedback",
  "OPERATIONS - Deferred / Postponed Trip",
  "OPERATIONS - Archive",
  "SALES - Archive",
];

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** NetHunt option strings sometimes carry extra spaces — snap them to our canonical list. */
export function canonicalStage(raw?: string | null): string | null {
  if (!raw) return null;
  const n = norm(raw);
  return STAGES.find((s) => norm(s) === n) ?? raw.replace(/\s+/g, " ").trim();
}

/** Raw option strings as they exist in NetHunt (used when writing back). */
const RAW_STAGE: Record<string, string> = {
  "SALES - - Budgeting & Fine-Tuning": "SALES -  -  Budgeting & Fine-Tuning",
};
export const rawStage = (canonical: string) => RAW_STAGE[canonical] ?? canonical;

/** "YT5054" / 5054 / "yt-5054" → "5054" so leads.yt_id can be matched. */
export const ytKey = (v: unknown): string | null => {
  if (v == null) return null;
  const digits = String(v).replace(/\D+/g, "");
  return digits || null;
};

export function stageToStatus(rawStageValue?: string | null): string | null {
  const stage = canonicalStage(rawStageValue);
  if (!stage) return null;
  if (stage === "SALES - New Lead") return "new";
  if (stage === "SALES - - Budgeting & Fine-Tuning") return "qualified";
  if (stage === "SALES - Final Negotiation & Ready to Book") return "negotiation";
  if (stage === "OPERATIONS - Archive" || stage === "SALES - Archive") return "lost";
  if (stage.startsWith("OPERATIONS - ")) return "won";
  return null;
}

const STATUS_DEFAULT_STAGE: Record<string, string> = {
  new: "SALES - New Lead",
  qualified: "SALES - - Budgeting & Fine-Tuning",
  negotiation: "SALES - Final Negotiation & Ready to Book",
  won: "OPERATIONS - Deposit/Payment Received",
  lost: "SALES - Archive",
};

/** Keeps the current NetHunt stage when it already maps to the same lead status. */
export function statusToStage(status?: string | null, currentStage?: string | null): string | null {
  if (!status) return null;
  if (currentStage && stageToStatus(currentStage) === status) return currentStage;
  return STATUS_DEFAULT_STAGE[status] ?? null;
}

const CLIENT_TYPE_IN: Record<string, string> = { "B2B Client": "B2B", "B2C Client": "B2C" };
const CLIENT_TYPE_OUT: Record<string, string> = { B2B: "B2B Client", B2C: "B2C Client" };
const SOURCE_IN: Record<string, string> = {
  "YT Website": "website",
  "OTA's": "ota",
  "Direct (Email/Phone/Sms)": "direct",
  "Partners & Resellers (Hotels, Travel Agency)": "partner",
};
const SOURCE_OUT: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCE_IN).map(([k, v]) => [v, k]),
);

const firstTag = (v: unknown): string | null => {
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  return v == null || v === "" ? null : String(v);
};

export const toClientType = (v: unknown) => {
  const t = firstTag(v);
  return t ? CLIENT_TYPE_IN[t] ?? null : null;
};
export const fromClientType = (v?: string | null) => (v ? CLIENT_TYPE_OUT[v] ?? null : null);
export const toSource = (v: unknown) => {
  const t = firstTag(v);
  return t ? SOURCE_IN[t] ?? null : null;
};
export const fromSource = (v?: string | null) => (v ? SOURCE_OUT[v] ?? null : null);

/** NetHunt date fields arrive as ISO strings or epoch ms → yyyy-mm-dd. */
export function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  const d = Number.isFinite(n) && typeof v !== "string" ? new Date(n) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
export function toIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  const d = Number.isFinite(n) && typeof v !== "string" ? new Date(n) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
/** Writes use the same shape NetHunt returns: yyyy-mm-dd for dates. */
export const fromDate = (v?: string | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
/** Writes for dateTime fields (task due date). */
export const fromDateTime = (v?: string | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};


export type NHRecord = {
  id: string;
  recordId?: string;
  folderId?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  deleted?: boolean;
  fields?: Record<string, unknown>;
};

export const recId = (r: NHRecord) => String(r.recordId ?? r.id);
export const recUpdatedAt = (r: NHRecord) =>
  toIso(r.updatedAt) ?? toIso(r.createdAt) ?? new Date().toISOString();
/** Reads a field by any of its known keys (name first, id as fallback). */
export const field = (r: NHRecord, keys: readonly string[] | string) => {
  const f = r.fields ?? {};
  for (const k of typeof keys === "string" ? [keys] : keys) {
    if (f[k] !== undefined) return f[k];
  }
  return undefined;
};
/** Field key used when writing (the NetHunt API addresses fields by name). */
export const wkey = (keys: readonly string[] | string) =>
  typeof keys === "string" ? keys : keys[0];

// ── HTTP client ──────────────────────────────────────────────────────────────
function authHeader() {
  const email = Deno.env.get("NETHUNT_EMAIL");
  const key = Deno.env.get("NETHUNT_API_KEY");
  if (!email || !key) throw new Error("NetHunt credentials not configured");
  return `Basic ${btoa(`${email}:${key}`)}`;
}

export async function nh<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`NetHunt [${res.status}] ${path}: ${text.slice(0, 300)}`);
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/** Soft GET: returns [] instead of throwing (some triggers 404 when disabled). */
export async function nhSoft<T>(path: string, fallback: T): Promise<T> {
  try {
    return await nh<T>(path);
  } catch (e) {
    console.warn("nethunt soft fail:", (e as Error).message);
    return fallback;
  }
}

const PAGE = 500;

/** Pages a trigger endpoint using its `since` cursor until exhausted. */
export async function pageRecords(
  endpoint: string,
  folderId: string,
  since: string,
  maxPages = 30,
): Promise<NHRecord[]> {
  const out: NHRecord[] = [];
  let cursor = since;
  const seen = new Set<string>();
  for (let i = 0; i < maxPages; i++) {
    const batch = await nhSoft<NHRecord[]>(
      `/triggers/${endpoint}/${folderId}?since=${encodeURIComponent(cursor)}&limit=${PAGE}`,
      [],
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    let advanced = false;
    for (const r of batch) {
      const k = recId(r);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
      advanced = true;
    }
    const last = batch.reduce((m, r) => {
      const t = recUpdatedAt(r);
      return t > m ? t : m;
    }, cursor);
    if (!advanced || batch.length < PAGE || last <= cursor) break;
    cursor = last;
  }
  return out;
}

export async function fetchRecord(folderId: string, recordId: string): Promise<NHRecord | null> {
  const res = await nhSoft<NHRecord[]>(
    `/searches/find-record/${folderId}?recordId=${encodeURIComponent(recordId)}&limit=1`,
    [],
  );
  return Array.isArray(res) && res.length ? res[0] : null;
}

export type FieldAction = { field: string; value: unknown; action?: string };

export const updateRecord = (recordId: string, fieldActions: FieldAction[]) =>
  nh(`/actions/update-record/${recordId}?overwrite=true`, {
    method: "POST",
    body: { fieldActions: fieldActions.map((f) => ({ action: "set", ...f })) },
  });

export const createRecord = (folderId: string, fields: Record<string, unknown>) =>
  nh<NHRecord>(`/actions/create-record/${folderId}`, {
    method: "POST",
    body: { timeZone: "Europe/Lisbon", fields },
  });

export const createComment = (recordId: string, text: string) =>
  nh(`/actions/create-comment/${recordId}`, { method: "POST", body: { text } });

// ── Supabase helpers ─────────────────────────────────────────────────────────
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export type LogRow = {
  direction: "pull" | "push";
  entity: string;
  entity_id?: string | null;
  nethunt_record_id?: string | null;
  action: string;
  status?: string;
  detail?: unknown;
};

export async function logSync(sb: SupabaseClient, rows: LogRow[]) {
  if (!rows.length) return;
  const { error } = await sb.from("nethunt_sync_log").insert(
    rows.map((r) => ({
      direction: r.direction,
      entity: r.entity,
      entity_id: r.entity_id ?? null,
      nethunt_record_id: r.nethunt_record_id ?? null,
      action: r.action,
      status: r.status ?? "ok",
      detail: r.detail ?? null,
    })) as never,
  );
  if (error) console.warn("sync log failed:", error.message);
}

export async function getState(sb: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await sb.from("nethunt_sync_state").select("value").eq("key", key).maybeSingle();
  const v = (data as { value?: unknown } | null)?.value;
  if (v == null) return null;
  if (typeof v === "string") return v;
  const o = v as { since?: string };
  return o.since ?? null;
}

export async function setState(sb: SupabaseClient, key: string, since: string) {
  await sb
    .from("nethunt_sync_state")
    .upsert({ key, value: { since }, updated_at: new Date().toISOString() } as never, {
      onConflict: "key",
    });
}

export const EPOCH = "2020-01-01T00:00:00Z";
