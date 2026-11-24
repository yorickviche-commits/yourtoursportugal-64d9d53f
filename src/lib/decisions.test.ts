import { describe, expect, it } from 'vitest';
import { decisionAge, decisionTripStart, groupDecisions, snoozeDate, type Decision } from './decisions';

const row = (id: string, lead: string, trip: string | null, created: string) => ({ id, lead_id: lead, created_at: created, leads: { trip_start: trip } } as Decision);
describe('decision queue rules', () => {
  it('marks ages greater than three days urgent, not exactly three', () => {
    const now = Date.parse('2026-11-24T10:00:00Z');
    expect(decisionAge('2026-11-21T10:00:00Z', now).urgent).toBe(false);
    expect(decisionAge('2026-11-21T09:59:00Z', now).urgent).toBe(true);
    expect(decisionAge('2026-11-20T10:00:00Z', now).urgent).toBe(true);
  });
  it('groups the same file into one group', () => {
    expect(groupDecisions([row('a', 'YT5020', '2027-04-01', '2026-11-14'), row('b', 'YT5020', '2027-04-01', '2026-11-15')]).map(g => g.map(d => d.id))).toEqual([['a', 'b']]);
  });
  it('prioritizes nearer travel before card age', () => {
    expect(groupDecisions([row('old', 'a', '2027-04-01', '2026-09-01'), row('near', 'b', '2026-11-25', '2026-11-23')]).map(g => g[0]?.id)).toEqual(['near', 'old']);
  });
  it('uses oldest card to break equal travel dates', () => {
    expect(groupDecisions([row('new', 'a', '2027-01-01', '2026-11-23'), row('old', 'b', '2027-01-01', '2026-11-14')]).map(g => g[0]?.id)).toEqual(['old', 'new']);
  });
  it('snoozes a chosen date until the morning, not yesterday', () => {
    expect(snoozeDate('2026-11-25')).toBe('2026-11-25T09:00:00Z');
  });
  it('does not hide a travel date already present in Dados Gerais', () => {
    const d = row('legacy', 'YT7652', null, '2026-11-09');
    if (d.leads) d.leads.travel_dates = '2026-11-19';
    expect(decisionTripStart(d)).toBe('2026-11-19');
  });
});