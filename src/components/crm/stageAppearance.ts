import { NETHUNT_STAGES } from "@/hooks/useNetHunt";

const tokens = [
  "new",
  "budget",
  "nego",
  "archive-sales",
  "deposit",
  "suppliers",
  "briefing",
  "ready",
  "posttrip",
  "deferred",
  "archive-ops",
];
export const ALL_CRM_STAGES = [
  ...NETHUNT_STAGES.SALES,
  ...NETHUNT_STAGES.OPERATIONS,
];
export function getStageColor(stage: string) {
  const index = ALL_CRM_STAGES.findIndex((s) => s === stage);
  return index < 0
    ? "crm-stage crm-stage-unknown"
    : `crm-stage crm-stage-${tokens[index]}`;
}
export function stageLabel(stage: string) {
  return stage
    .replace(/^(SALES|OPERATIONS)\s*-\s*(-\s*)?/, "")
    .replace(" (Internal & Suppliers Final Validations)", "")
    .replace("Deferred / Postponed Trip", "Deferred / Postponed");
}
