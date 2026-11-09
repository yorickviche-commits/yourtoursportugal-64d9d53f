import { describe, it, expect } from 'vitest';
import { catalogAddonRows, mergeCatalogAddons, calculateProductRow } from './productAddons';
import { executionCostingItems } from './productExecution';
import type { ImportedProduct } from '@/hooks/useMagpie';
import type { ProposalDay } from '@/components/trip/TravelPlanProposal';

const product = { magpie_id: 'test', raw_payload: { add_ons: [
  { name: 'Quinta', adult: 22.5, child: 15, price_text: '22,50€/adult · 15€/child', description: 'Visit a second wine estate and discover its wines.' },
  { name: 'Barco privado', adult: null, child: null, price_text: '250€/total' },
] } } as unknown as ImportedProduct;

describe('catalog add-ons', () => {
  it('keeps retail distinct from unknown supplier NET', () => {
    const row = catalogAddonRows(product, 2, 1)[0];
    expect(row.priceAdults).toBe(0); expect(row.netPending).toBe(true);
    expect(row.pvpTotal).toBe(60); expect(row.status).toBe('opcionais');
  });
  it('imports optional descriptions and adult/child prices for the lead without mutating the product', () => {
    const items = catalogAddonRows(product, 2, 1);
    const day = { product_ref: { execution: { items } } } as unknown as ProposalDay;
    const rows = executionCostingItems(day, { adults: 4, youths: 1, children: 2 });
    expect(rows?.[0].pvpTotal).toBe(142.5); expect(rows?.[0].status).toBe('opcionais');
    expect(rows?.[0].commercialDescription).toBe(items[0].commercialDescription);
    expect(items[0].pvpTotal).toBe(60);
  });
  it('keeps group-based add-ons at their fixed price', () => {
    const row = catalogAddonRows(product, 8, 2)[1];
    expect(row.pricingType).toBe('total'); expect(row.pvpTotal).toBe(250); expect(row.netTotal).toBe(0);
  });
  it('does not duplicate catalog add-ons when loaded twice', () => {
    const rows = catalogAddonRows(product, 2, 0);
    expect(mergeCatalogAddons(rows, catalogAddonRows(product, 2, 0))).toHaveLength(2);
  });
  it('preserves retail when supplier NET is updated and confirmation changes only status', () => {
    const row = catalogAddonRows(product, 2, 1)[0];
    const result = calculateProductRow({ ...row, priceAdults: 10, priceChildren: 5, status: 'aceite', netPending: false });
    expect(result.pvpTotal).toBe(60); expect(result.netTotal).toBe(25); expect(result.status).toBe('aceite');
  });
});