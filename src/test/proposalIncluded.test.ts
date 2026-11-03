import { describe, expect, it } from 'vitest';
import { buildIncludedText, getIncludedDays } from '../lib/proposalIncluded';

const times = ['08:30', '10:00', '10:45', '13:00', '14:30', '15:30', '16:45', '17:45'];

describe('dynamic itinerary inclusions', () => {
  it('includes all eight YT5171 rows, including the second quinta and return', () => {
    const items = times.map(time => `${time} activity`);
    const days = [{ day_number: 1, items }];
    expect(getIncludedDays(days)[0].items).toEqual(items);
    expect(buildIncludedText(days, 'Day').split('\n').slice(1)).toHaveLength(8);
    expect(buildIncludedText(days, 'Day')).toContain('16:45 activity\n• 17:45 activity');
  });

  it('reflects edits, addition, removal and reordering without a saved copy', () => {
    const day = { bullets: ['first', 'second'] };
    expect(getIncludedDays([day])[0].items).toEqual(['first', 'second']);
    day.bullets = ['added', 'edited'];
    expect(getIncludedDays([day])[0].items).toEqual(['added', 'edited']);
    day.bullets.reverse();
    day.bullets.pop();
    expect(getIncludedDays([day])[0].items).toEqual(['edited']);
  });

  it('preserves HTML and Markdown bold in itinerary rows', () => {
    const bullets = [{ text: '**16:45** Quinta' }, { text: '<b>17:45</b> Return' }];
    expect(getIncludedDays([{ bullets }])[0].items).toEqual(bullets.map(b => b.text));
    expect(buildIncludedText([{ bullets }], 'Day')).toContain('• **16:45** Quinta\n• <b>17:45</b> Return');
  });

  it('keeps versions independent and ignores obsolete inclusions', () => {
    const v0 = [{ items: ['V0 row'], inclusionsOverride: 'stale' }];
    const v1 = [{ items: ['V1 row'] }];
    expect(buildIncludedText(v0, 'Day')).not.toContain('stale');
    expect(getIncludedDays(v1)[0].items).toEqual(['V1 row']);
    expect(v0[0].items).toEqual(['V0 row']);
  });

  it.each(['Day', 'Dia', 'Día', 'Jour', 'Giorno', 'Tag'])('keeps all rows for %s', label => {
    const text = buildIncludedText([{ items: times }], label);
    expect(text).toContain(`**${label} 1`);
    expect(text.split('\n').slice(1)).toEqual(times.map(time => `• ${time}`));
  });

  it('uses empty current rows rather than resurrecting legacy highlights', () => {
    expect(getIncludedDays([{ items: [], highlights: ['obsolete'] }])[0].items).toEqual([]);
    expect(getIncludedDays([{ highlights: ['legacy'] }])[0].items).toEqual(['legacy']);
  });
});