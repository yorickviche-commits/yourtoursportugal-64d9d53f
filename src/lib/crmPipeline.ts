import { NETHUNT_STAGES } from "@/hooks/useNetHunt";
export const CRM_LIMITS = {
  stageWarningDays: 14,
  emailWarningDays: 7,
  cardsPerPage: 30,
} as const;
export type Pipeline = "sales" | "operations" | "all";
export type CrmSort = {
  key: "trip_start" | "created_at" | "days" | "last_email";
  direction: "asc" | "desc";
};
export type CrmFilters = {
  search: string;
  owner: string;
  client_type: string;
  source: string;
  from: string;
  to: string;
};
export const EMPTY_CRM_FILTERS: CrmFilters = {
  search: "",
  owner: "",
  client_type: "",
  source: "",
  from: "",
  to: "",
};
export function matchesCrmFilters(
  l: {
    id: string;
    yt_id: string | null;
    lead_code: string;
    client_name: string;
    program: string;
    owner_id: string | null;
    sales_owner: string | null;
    client_type: string | null;
    source: string | null;
    trip_start: string | null;
  },
  f: CrmFilters,
) {
  return (
    `${l.yt_id ?? l.lead_code} ${l.client_name} ${l.program}`
      .toLowerCase()
      .includes(f.search.toLowerCase()) &&
    (!f.owner || (l.owner_id || l.sales_owner) === f.owner) &&
    (!f.client_type || l.client_type === f.client_type) &&
    (!f.source || l.source === f.source) &&
    (!f.from || (!!l.trip_start && l.trip_start >= f.from)) &&
    (!f.to || (!!l.trip_start && l.trip_start <= f.to))
  );
}
export function pipelineStages(pipeline: Pipeline): readonly string[] {
  return pipeline === "sales"
    ? NETHUNT_STAGES.SALES
    : pipeline === "operations"
      ? NETHUNT_STAGES.OPERATIONS
      : [...NETHUNT_STAGES.SALES, ...NETHUNT_STAGES.OPERATIONS];
}
export function crmStage(lead: {
  nethunt_stage: string | null;
  status: string;
  source: string | null;
  created_via?: string | null;
}): string | null {
  if (lead.nethunt_stage)
    return pipelineStages("all").includes(lead.nethunt_stage)
      ? lead.nethunt_stage
      : null;
  // Never infer a live OPS stage from a historical won import.
  if (lead.status === "won") return null;
  return lead.status === "lost"
    ? NETHUNT_STAGES.SALES[3]
    : lead.status === "negotiation"
      ? NETHUNT_STAGES.SALES[2]
      : ["qualified", "proposal_sent"].includes(lead.status)
        ? NETHUNT_STAGES.SALES[1]
        : NETHUNT_STAGES.SALES[0];
}
export function ageDays(
  value: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? Math.max(0, Math.floor((now - time) / 86400000))
    : null;
}
export function crmPvp(
  override: number | null,
  items: { status?: string; pvpTotal?: number }[],
): number | null {
  if (override !== null) return override;
  const included = items.filter(
    (i) => !["opcionais", "eliminar"].includes(i.status ?? ""),
  );
  return included.length
    ? included.reduce((sum, i) => sum + (Number(i.pvpTotal) || 0), 0)
    : null;
}
