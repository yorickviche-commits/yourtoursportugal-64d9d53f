import { describe, it, expect } from 'vitest';
import { cloneExecution, executionCostingItems, executionLabel, type ProductExecution } from './productExecution';
import { productToProposalDays } from './productToDay';
import type { ImportedProduct } from '@/hooks/useMagpie';

const source: ProductExecution = {
  id: 'a', label: 'A', adults: 2, children: 1, updatedAt: '',
  plan: { trip_title: 'Douro', narrative: '', days: [{ day_number: 1, title: 'Quintas', date: '', subtitle: '', overnight: '', bullets: [{ text: '**Visita**', startTime: '10:00' }] }] },
  costingDays: [{ day: 1, title: 'Quintas', items: [{ id: 'row', description: 'Visita', supplier: 'Quinta A', pricingType: 'per_person', numAdults: 2, priceAdults: 22.5, numChildren: 1, priceChildren: 15, netTotal: 60, marginPercent: 30, pvpTotal: 78, profit: 18, status: 'opcionais', notes: [{ id: 'n', text: 'Reservar', createdAt: '' }], startTime: '10:00', endTime: '11:00' }] }],
};
const product = { magpie_id: 'douro', name: 'Douro', product_local: { execution_versions: [source], default_execution_id: 'a' } } as unknown as ImportedProduct;

describe('catalog execution versions', () => {
  it('creates independent A/B/C execution combinations', () => {
    const b = cloneExecution(source, 1); b.costingDays[0].items[0].supplier = 'Quinta B'; b.plan.days[0].title = 'B';
    expect(b.label).toBe('B'); expect(executionLabel(2)).toBe('C');
    expect(source.costingDays[0].items[0].supplier).toBe('Quinta A'); expect(source.plan.days[0].title).toBe('Quintas');
  });
  it('imports all saved itinerary lines with bold, schedules and independent snapshots', () => {
    const copy = structuredClone(product);
    const v = copy.product_local as { execution_versions: ProductExecution[] };
    v.execution_versions[0].plan.days[0].bullets = Array.from({ length: 8 }, (_, i) => ({ text: `**${i}**` }));
    const days = productToProposalDays(copy, { dayNumber: 3 });
    expect(days[0].bullets).toHaveLength(8); expect(days[0].day_number).toBe(3);
    expect(days[0].bullets[7]).toEqual({ text: '**7**' });
    v.execution_versions[0].costingDays[0].items[0].supplier = 'Changed';
    expect(days[0].product_ref?.execution?.items[0].supplier).toBe('Quinta A');
  });
  it('uses exact FSE NET adult/child rates, status, notes and schedule for lead pax', () => {
    const day = productToProposalDays(product, { dayNumber: 1 })[0];
    const rows = executionCostingItems(day, { adults: 4, children: 2 });
    expect(rows?.[0].netTotal).toBe(120); expect(rows?.[0].priceAdults).toBe(22.5); expect(rows?.[0].priceChildren).toBe(15);
    expect(rows?.[0].status).toBe('opcionais'); expect(rows?.[0].startTime).toBe('10:00'); expect(rows?.[0].notes[0].text).toBe('Reservar');
  });
  it('never substitutes invented NET or generic transport rows for an execution without costs', () => {
    const day = productToProposalDays(product, { dayNumber: 1 })[0];
    if (day.product_ref?.execution) day.product_ref.execution.items = [];
    expect(executionCostingItems(day, { adults: 4 })).toEqual([]);
  });
});