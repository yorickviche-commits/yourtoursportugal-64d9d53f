import { describe, it, expect } from 'vitest';
import { quoteProduct } from './productPricing';

const porto = { adult_per_person_by_group_size: { '1_pax': 300, '2_pax': 150, '3_pax': 100, '4_pax': 90, '5_pax': 75, '6_pax': 66, '7_pax': 57, '8_pax': 50 }, child_4_11: 80, infant_0_3: 0 };

describe('quoteProduct', () => {
  it('4 adults use the 4-pax tier', () => {
    expect(quoteProduct(porto, { adults: 4 })!.total).toBe(360);
  });
  it('2 adults + 2 children use the 4-pax tier for adults and child rate', () => {
    const q = quoteProduct(porto, { adults: 2, children: 2 })!;
    expect(q.adultPrice).toBe(90);
    expect(q.total).toBe(2 * 90 + 2 * 80);
  });
  it('infants are free and do not count for the tier', () => {
    expect(quoteProduct(porto, { adults: 2, infants: 1 })!.total).toBe(300);
  });
  it('youths count for the tier and pay adult tier when no youth rate', () => {
    expect(quoteProduct(porto, { adults: 2, youths: 1 })!.total).toBe(300);
  });
});
