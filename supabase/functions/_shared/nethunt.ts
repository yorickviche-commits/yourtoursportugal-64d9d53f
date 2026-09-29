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

// NetHunt expects fieldActions as an object keyed by field name: { Field: { overwrite: true, add: value } }
// (the previous array shape returned HTTP 500 for every update).
export const updateRecord = (recordId: string, fieldActions: FieldAction[]) =>
  nh(`/actions/update-record/${recordId}?overwrite=true`, {
    method: "POST",
    body: {
      fieldActions: Object.fromEntries(fieldActions.map((f) => [f.field, { overwrite: true, add: f.value }])),
    },
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

// ── Field-level bidirectional sync (baseline per field in nethunt_field_state) ──
/** Potential Booking Value (id 84, EUR). Old name kept as read fallback. */
export const F_VALUE = ["Potential Booking Value", "`Potential Booking Value", "84"] as const;

export const PRIORITY_OUT: Record<string, string> = { high: "High", urgent: "High", medium: "Medium", low: "Low" };
export const PRIORITY_IN: Record<string, string> = { High: "high", Medium: "medium", Low: "low" };

export type Vals = Record<string, unknown>;

const normVal = (v: unknown): unknown => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Math.round(v * 100) / 100;
  if (Array.isArray(v)) return v.length ? [...v].map(String).sort() : null;
  return v;
};
export const same = (a: unknown, b: unknown) => JSON.stringify(normVal(a)) === JSON.stringify(normVal(b));

const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** NetHunt deal → TCC-shaped values. `undefined` = not comparable (skip). */
export function dealValues(r: NHRecord): Vals {
  const nameRaw = field(r, F.name);
  return {
    stage: canonicalStage(field(r, F.stage) as string | null),
    trip_start: toDate(field(r, F.tripStart)),
    trip_finish: toDate(field(r, F.tripFinish)),
    close_date: toDate(field(r, F.closeDate)),
    client_type: toClientType(field(r, F.clientType)) ?? undefined,
    source: toSource(field(r, F.source)) ?? undefined,
    name: nameRaw == null || nameRaw === "" ? undefined : String(nameRaw),
    value: toNum(field(r, F_VALUE)),
  };
}

export type LeadForSync = {
  id: string; status: string | null; nethunt_stage: string | null; trip_start: string | null; trip_finish: string | null;
  close_date: string | null; client_type: string | null; source: string | null; client_name: string | null;
  estimated_value: number | null;
};
export const LEAD_SYNC_COLS =
  "id, status, nethunt_stage, trip_start, trip_finish, close_date, client_type, source, client_name, estimated_value, nethunt_record_id, updated_at, yt_id";

/** Current TCC values of a lead. Value = live PVP when there is costing, else estimated_value. */
export async function leadValues(sb: SupabaseClient, lead: LeadForSync): Promise<{ vals: Vals; hasCosting: boolean }> {
  const { data: pvp } = await sb.rpc("lead_live_pvp", { p_lead_id: lead.id } as never);
  const hasCosting = pvp != null;
  return {
    hasCosting,
    vals: {
      stage: statusToStage(lead.status, lead.nethunt_stage) ?? lead.nethunt_stage,
      trip_start: lead.trip_start,
      trip_finish: lead.trip_finish,
      close_date: lead.close_date,
      client_type: fromClientType(lead.client_type) ? lead.client_type : undefined,
      source: fromSource(lead.source) ? lead.source : undefined,
      name: lead.client_name || undefined,
      value: hasCosting ? Number(pvp) : (lead.estimated_value == null ? null : Number(lead.estimated_value)),
    },
  };
}

export function leadAction(f: string, v: unknown): FieldAction | null {
  switch (f) {
    case "stage": return v ? { field: wkey(F.stage), value: rawStage(String(v)) } : null;
    case "trip_start": return { field: wkey(F.tripStart), value: fromDate(v as string) };
    case "trip_finish": return { field: wkey(F.tripFinish), value: fromDate(v as string) };
    case "close_date": return { field: wkey(F.closeDate), value: fromDate(v as string) };
    case "client_type": { const o = fromClientType(v as string); return { field: wkey(F.clientType), value: o ? [o] : [] }; }
    case "source": { const o = fromSource(v as string); return { field: wkey(F.source), value: o ? [o] : [] }; }
    case "name": return v ? { field: wkey(F.name), value: String(v) } : null;
    case "value": return { field: F_VALUE[0], value: v == null ? null : Number(v) };
  }
  return null;
}

/** NetHunt task → TCC-shaped values. */
export function taskNhValues(r: NHRecord): Vals {
  const assignee = field(r, TF.assignee);
  return {
    title: String(field(r, TF.name) ?? "(sem título)"),
    description: field(r, TF.description) ? String(field(r, TF.description)) : "",
    priority: PRIORITY_IN[String(field(r, TF.priority) ?? "")] ?? "medium",
    completed: Boolean(field(r, TF.completed)),
    due_at: toIso(field(r, TF.dueDate)),
    all_day: Boolean(field(r, TF.allDay)),
    assignee_emails: Array.isArray(assignee) ? assignee.map(String) : assignee ? [String(assignee)] : [],
  };
}
export const taskRowValues = (t: Record<string, any>): Vals => ({
  title: t.title ?? "", description: t.description ?? "", priority: t.priority ?? "medium",
  completed: Boolean(t.completed), due_at: t.due_at ? new Date(t.due_at).toISOString() : null,
  all_day: Boolean(t.all_day), assignee_emails: t.assignee_emails ?? [],
});
export function taskAction(f: string, v: unknown): FieldAction | null {
  switch (f) {
    case "title": return { field: wkey(TF.name), value: v };
    case "description": return { field: wkey(TF.description), value: v ?? "" };
    case "priority": return { field: wkey(TF.priority), value: PRIORITY_OUT[String(v)] ?? "Medium" };
    case "completed": return { field: wkey(TF.completed), value: Boolean(v) };
    case "due_at": return { field: wkey(TF.dueDate), value: fromDateTime(v as string) };
    case "all_day": return { field: wkey(TF.allDay), value: Boolean(v) };
    case "assignee_emails": return { field: wkey(TF.assignee), value: v ?? [] };
  }
  return null;
}

/** Baseline the TCC value is compared against (separate for 'name'). */
export const tccBaseline = (base: Map<string, unknown>, f: string) =>
  base.has(`${f}@tcc`) ? base.get(`${f}@tcc`) : base.get(f);

export async function getBaselines(sb: SupabaseClient, entity: "lead" | "task", id: string) {
  const { data } = await sb.from("nethunt_field_state").select("field, value").eq("entity", entity).eq("entity_id", id);
  return new Map(((data as { field: string; value: unknown }[] | null) ?? []).map((r) => [r.field, r.value]));
}

export async function setBaselines(sb: SupabaseClient, entity: "lead" | "task", id: string, vals: Vals) {
  const now = new Date().toISOString();
  // 'name' keeps a separate TCC-side baseline (deal names ≠ client names): mirror it unless given explicitly.
  if (vals.name !== undefined && !("name@tcc" in vals)) vals = { ...vals, "name@tcc": vals.name };
  const rows = Object.entries(vals).filter(([, v]) => v !== undefined)
    .map(([f, v]) => ({ entity, entity_id: id, field: f, value: normVal(v) ?? null, synced_at: now }));
  if (!rows.length) return;
  const { error } = await sb.from("nethunt_field_state").upsert(rows as never, { onConflict: "entity,entity_id,field" });
  if (error) throw new Error(`baseline save failed: ${error.message}`);
}

/** Pushes TCC fields that differ from the baseline (worker path). Returns fields sent. */
export async function pushDiff(
  sb: SupabaseClient, entity: "lead" | "task", id: string, recordId: string, vals: Vals,
): Promise<string[]> {
  const base = await getBaselines(sb, entity, id);
  const actions: FieldAction[] = [];
  const sent: Vals = {};
  for (const [f, v] of Object.entries(vals)) {
    if (v === undefined) continue;
    const tb = base.has(`${f}@tcc`) ? base.get(`${f}@tcc`) : base.get(f);
    if ((base.has(f) || base.has(`${f}@tcc`)) && same(v, tb)) continue;
    const a = entity === "lead" ? leadAction(f, v) : taskAction(f, v);
    if (!a) continue;
    actions.push(a); sent[f] = v;
  }
  if (!actions.length) return [];
  try {
    await updateRecord(recordId, actions);
  } catch (e) {
    // One bad field must not block the others: retry field by field and report the failing ones.
    if (actions.length === 1) throw e;
    const failed: string[] = [];
    for (const [f] of Object.entries(sent)) {
      const a = actions.find((x) => x.field === (entity === "lead" ? leadAction(f, sent[f]) : taskAction(f, sent[f]))?.field);
      try { if (a) await updateRecord(recordId, [a]); } catch (err) { failed.push(`${f}: ${(err as Error).message}`); delete sent[f]; }
    }
    await setBaselines(sb, entity, id, sent);
    if (failed.length) throw new Error(failed.join(" | "));
    return Object.keys(sent);
  }
  await setBaselines(sb, entity, id, sent);
  const fresh = await fetchRecord(entity === "lead" ? DEALS_FOLDER : TASKS_FOLDER, recordId);
  await sb.from(entity === "lead" ? "leads" : "tasks").update({
    nethunt_updated_at: fresh ? recUpdatedAt(fresh) : new Date().toISOString(),
    nethunt_synced_at: new Date().toISOString(),
  } as never).eq("id", id);
  await logSync(sb, [{ direction: "push", entity, entity_id: id, nethunt_record_id: recordId, action: "update", detail: { fields: Object.keys(sent), via: "sync-worker" } }]);
  return Object.keys(sent);
}
