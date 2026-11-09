import type { TravelPlanData, ProposalDay } from '@/components/trip/TravelPlanProposal';
import type { LeadCostingDay, LeadCostItem } from '@/components/trip/LeadCostingEditor';
import { quoteProduct, type ProductPricing, type PaxMix } from './productPricing';
import { calculateProductRow } from './productAddons';
export interface ProductExecution {
  id: string; label: string; plan: TravelPlanData; costingDays: LeadCostingDay[];
  metadata?: string; pricing?: ProductPricing; adults: number; children: number; updatedAt: string;
}
export function executionLabel(index: number): string {
  let n = index + 1, label = '';
  while (n > 0) { n--; label = String.fromCharCode(65 + n % 26) + label; n = Math.floor(n / 26); }
  return label;
}
export function cloneExecution(source: ProductExecution, index: number): ProductExecution {
  return { ...structuredClone(source), id: crypto.randomUUID(), label: executionLabel(index), updatedAt: new Date().toISOString() };
}
export function executionCostingItems(day: ProposalDay, mix: PaxMix): LeadCostItem[] | null {
  const execution = day.product_ref?.execution;
  if (!execution) return null;
  return execution.items.map(item => {
    const row = structuredClone(item);
    row.id = crypto.randomUUID();
    if (row.pricingType === 'per_person') { row.numAdults = mix.adults + (mix.youths || 0); row.numChildren = mix.children || 0; }
    if (row.catalogBasePrice) {
      const pricing = day.product_ref?.pricing as ProductPricing | undefined;
      const quote = pricing ? quoteProduct(pricing, mix) : null;
      row.retailTotal = quote?.total ?? 0;
    }
    return calculateProductRow(row);
  });
}
