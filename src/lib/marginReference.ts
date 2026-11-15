import { BUSINESS_CONFIG } from './businessConfig';

/** The legacy setting key stays stable; its value is advisory only. */
export function marginReferenceValue(value: unknown): number {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : BUSINESS_CONFIG.MIN_MARGIN_PERCENT;
}

export function lowMarginWarning(net: number, pvp: number, reference: number): string | null {
  const margin = pvp > 0 ? (pvp - net) / pvp * 100 : 0;
  if (pvp <= 0 || margin >= reference) return null;
  return `Margem total ${margin.toFixed(1)}% abaixo da referência de ${reference}% — verificar (normal se houver hotéis a 10–15%).`;
}

type MarginDay = { day?: number; day_number?: number; items: { netTotal: number; pvpTotal: number; status: string; costLayer?: string }[] };

export function marginBreakdown(days: MarginDay[]) {
  const hotel = { net: 0, pvp: 0 };
  const other = { net: 0, pvp: 0 };
  for (const day of days) for (const item of day.items) {
    if (item.status === 'opcionais' || item.status === 'eliminar') continue;
    const bucket = (day.day ?? day.day_number) === 0 || item.costLayer === 'accommodation' ? hotel : other;
    bucket.net += item.netTotal;
    bucket.pvp += item.pvpTotal;
  }
  const percent = (bucket: typeof hotel) => bucket.pvp > 0 ? (bucket.pvp - bucket.net) / bucket.pvp * 100 : null;
  return { accommodation_percent: percent(hotel), other_services_percent: percent(other) };
}