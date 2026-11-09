/**
 * Tier pricing for catalog products (PDF tables, 1–8 pax).
 * Prices are client PVP (VAT included). Group size = paying pax (adults + youths + children);
 * infants (0–3) are free and don't count toward the tier.
 */
export interface ProductPricing {
  adult_per_person_by_group_size?: Record<string, number>;
  youth?: number | null;
  child_4_11?: number | null;
  infant_0_3?: number | null;
  currency?: string;
}

export interface PaxMix { adults: number; youths?: number; children?: number; infants?: number }

export interface TierQuote {
  groupSize: number;
  adultPrice: number;
  youthPrice: number;
  childPrice: number;
  infantPrice: number;
  total: number;
}

export function adultTierPrice(p: ProductPricing, groupSize: number): number | null {
  const tiers = p.adult_per_person_by_group_size || {};
  const sizes = Object.keys(tiers).map(k => parseInt(k, 10)).filter(n => n > 0).sort((a, b) => a - b);
  if (!sizes.length || groupSize <= 0) return null;
  const size = sizes.includes(groupSize) ? groupSize : groupSize > sizes[sizes.length - 1] ? sizes[sizes.length - 1] : sizes.find(s => s >= groupSize)!;
  return Number(tiers[`${size}_pax`]);
}

export function quoteProduct(p: ProductPricing, mix: PaxMix): TierQuote | null {
  const adults = mix.adults || 0, youths = mix.youths || 0, children = mix.children || 0, infants = mix.infants || 0;
  const groupSize = adults + youths + children;
  const adultPrice = adultTierPrice(p, groupSize);
  if (adultPrice == null) return null;
  // Youth (12–17) pays the youth rate when the table has one, otherwise the adult tier.
  const youthPrice = p.youth != null ? Number(p.youth) : adultPrice;
  const childPrice = p.child_4_11 != null ? Number(p.child_4_11) : adultPrice;
  const infantPrice = Number(p.infant_0_3 ?? 0);
  const total = Math.round((adults * adultPrice + youths * youthPrice + children * childPrice + infants * infantPrice) * 100) / 100;
  return { groupSize, adultPrice, youthPrice, childPrice, infantPrice, total };
}
