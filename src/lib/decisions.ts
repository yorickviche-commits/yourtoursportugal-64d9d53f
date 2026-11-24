import type { Tables } from '@/integrations/supabase/types';
import { withDerivedDates } from '../../supabase/functions/_shared/workbenchScope';

export type Decision = Tables<'decisions'> & {
  leads: { client_name: string; trip_start: string | null; trip_finish: string | null; nethunt_stage: string | null; travel_dates?: string | null; travel_end_date?: string | null } | null;
};
export const DECISION_SIDES = { all: 'Tudo', sales: 'Vendas', ops: 'Operações', finance: 'Finanças', management: 'Gerência' } as const;
export type DecisionFilter = keyof typeof DECISION_SIDES;
export function decisionTripStart(d: Decision) {
  return d.leads ? withDerivedDates(d.leads).trip_start : null;
}
export function preparedObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
export function decisionAge(created: string, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(created));
  const days = Math.floor(elapsed / 86400000);
  return { days, urgent: elapsed > 3 * 86400000, label: days ? `há ${days} ${days === 1 ? 'dia' : 'dias'}` : 'hoje' };
}
export function groupDecisions(items: Decision[]) {
  const groups = new Map<string, Decision[]>();
  for (const item of items) {
    const key = item.lead_id || item.yt_ref || `sem-file:${item.id}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups.values()].map(rows => rows.sort((a, b) => a.created_at.localeCompare(b.created_at)))
    .sort((a, b) => (a[0] && decisionTripStart(a[0]) || '9999').localeCompare(b[0] && decisionTripStart(b[0]) || '9999') ||
      (a[0]?.created_at || '').localeCompare(b[0]?.created_at || ''));
}
export function snoozeDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Escolhe uma data');
  const timestamp = `${date}T09:00:00Z`;
  if (Number.isNaN(Date.parse(timestamp))) throw new Error('Data inválida');
  return timestamp;
}