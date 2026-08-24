import type { OpsAction, OpsBooking } from '@/types/ops';

const SEVERITY_BASE: Record<OpsAction['severity'], number> = {
  critical: 7,
  high: 5,
  medium: 3,
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Deterministic 0-10 priority score (one decimal) for an action + its booking. */
export function priorityScore(a: OpsAction, b: OpsBooking): number {
  let score = SEVERITY_BASE[a.severity] ?? 3;

  const now = Date.now();
  const deadline = new Date(a.deadlineISO).getTime();
  if (!Number.isNaN(deadline) && deadline - now <= DAY) score += 2;

  if (b) {
    const departure = new Date(b.departureDate).getTime();
    if (!Number.isNaN(departure) && departure - now <= 7 * DAY) score += 1;
    if (b.missing?.some((m) => m.blocking)) score += 1.5;
    if (b.lastContactDays > 45) score += 1;
  }

  return Math.round(Math.min(score, 10) * 10) / 10;
}
