import type { ImportedProduct } from '@/hooks/useMagpie';
import type { LeadCostItem } from '@/components/trip/LeadCostingEditor';

export function calculateProductRow(row: LeadCostItem): LeadCostItem {
  const netTotal = Math.round((row.pricingType === 'total' ? row.priceAdults : row.pricingType === 'per_night'
    ? row.priceAdults * row.numAdults : row.priceAdults * row.numAdults + row.priceChildren * row.numChildren) * 100) / 100;
  const retail = row.retailTotal != null ? row.retailTotal : row.retailAdult != null
    ? row.retailAdult * row.numAdults + (row.retailChild ?? row.retailAdult) * row.numChildren : null;
  const pvpTotal = Math.round((retail ?? netTotal * (1 + row.marginPercent / 100)) * 100) / 100;
  return { ...row, netTotal, pvpTotal, profit: Math.round((pvpTotal - netTotal) * 100) / 100 };
}

/** PDF add-on rates are retail prices, never supplier NET. */
export function catalogAddonRows(product: ImportedProduct, adults: number, children: number): LeadCostItem[] {
  const payload = product.raw_payload as { add_ons?: Record<string, unknown>[] } | null;
  return (payload?.add_ons || []).map((addon, index) => {
    const name = String(addon.name || '');
    const priceText = String(addon.price_text || '');
    const isTotal = /total/i.test(priceText);
    const totalMatch = priceText.match(/([\d.,]+)\s*€/);
    const retailTotal = isTotal && totalMatch ? Number(totalMatch[1].replace(',', '.')) : undefined;
    return calculateProductRow({
      id: crypto.randomUUID(), addonId: `${product.magpie_id}-addon-${index}`, description: name,
      commercialDescription: String(addon.description || name), addonGroup: String(addon.group || ''),
      supplier: '', pricingType: isTotal ? 'total' : 'per_person', numAdults: adults, numChildren: children,
      priceAdults: 0, priceChildren: 0, netTotal: 0, marginPercent: 0, pvpTotal: 0, profit: 0,
      retailAdult: !isTotal && addon.adult != null ? Number(addon.adult) : undefined,
      retailChild: !isTotal && addon.child != null ? Number(addon.child) : undefined,
      retailTotal, netPending: true, status: 'opcionais', notes: [], costLayer: /lunch|almoço/i.test(name) ? 'meal' : 'experience',
    });
  }).filter(row => row.description);
}

export function mergeCatalogAddons(items: LeadCostItem[], addons: LeadCostItem[]): LeadCostItem[] {
  const ids = new Set(items.map(row => row.addonId));
  return [...items, ...addons.filter(row => !ids.has(row.addonId))];
}