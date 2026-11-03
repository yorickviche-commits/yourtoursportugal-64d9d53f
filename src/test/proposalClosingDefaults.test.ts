import { describe, expect, it } from 'vitest';
import { cancellationDeadlineDays, proposalTourDayCount, resolveClosingText, getClosingDefaults } from '../lib/closingTermsI18n';

describe('proposal cancellation deadlines', () => {
  it('defaults one-day tours to 7 days', () => {
    expect(cancellationDeadlineDays(1)).toBe(7);
  });

  it('defaults multi-day tours to 30 days', () => {
    expect(cancellationDeadlineDays(2)).toBe(30);
    expect(cancellationDeadlineDays(10)).toBe(30);
  });

  it('does not count accommodation day zero as a tour day', () => {
    expect(cancellationDeadlineDays(proposalTourDayCount([{ day_number: 0 }, { day_number: 1 }]))).toBe(7);
  });

  it('uses the same deadline in both clauses for every language', () => {
    for (const language of ['en', 'pt', 'es', 'fr', 'it', 'de']) {
      for (const [days, deadline] of [[1, 7], [2, 30]]) {
        const numbers = getClosingDefaults(language, days).cancellation.match(/\b(?:7|30)\b/g)?.map(Number);
        expect(numbers).toEqual([deadline, deadline]);
      }
    }
  });

  it('preserves manual exceptions when duration changes', () => {
    const customised = 'Cancellation permitted until 14 days before departure.';
    expect(resolveClosingText('cancellation', customised, 'en', 2)).toBe(customised);
  });

  it('replaces the inconsistent historical default without changing payment terms', () => {
    const legacy = '• Free cancellation with 100% refund up to 7 days prior to the tour date.\n• For cancellations made less than 30 days before the tour date, the total amount is non-refundable.';
    expect(resolveClosingText('cancellation', legacy, 'en', 2).match(/\b(?:7|30)\b/g)?.map(Number)).toEqual([30, 30]);
    expect(getClosingDefaults('en', 1).payment).toBe(getClosingDefaults('en', 2).payment);
  });
});