import type { OpsBooking } from '@/types/ops';

export type PillarKey = 'payment' | 'suppliers' | 'guide_transport' | 'briefing';
export type PillarStatus = 'ok' | 'warn' | 'blocked';

interface Pillar {
  key: PillarKey;
  label: string;
  short: string;
  keywords: string[];
}

/** The four operational pillars the wizard always watches for every lead. */
export const PILLARS: Pillar[] = [
  { key: 'payment', label: 'Client payments received', short: 'PAYMENTS', keywords: ['payment', 'deposit', 'balance', 'invoice', 'pago'] },
  { key: 'suppliers', label: 'Suppliers booked & paid', short: 'SUPPLIERS', keywords: ['supplier', 'fse', 'hotel', 'restaurant', 'booking confirm', 'reservation'] },
  { key: 'guide_transport', label: 'Guide & transport assigned', short: 'GUIDE / TRANSPORT', keywords: ['guide', 'transport', 'vehicle', 'driver', 'van', 'pickup point'] },
  { key: 'briefing', label: 'Final briefings sent', short: 'BRIEFINGS', keywords: ['briefing', 'brief', 'itinerary final', 'final doc', 'voucher'] },
];

const matches = (field: string, keywords: string[]) => {
  const f = field.toLowerCase();
  return keywords.some((k) => f.includes(k));
};

export function pillarStatus(booking: OpsBooking): Record<PillarKey, PillarStatus> {
  const out = {} as Record<PillarKey, PillarStatus>;
  for (const p of PILLARS) {
    const hits = booking.missing.filter((m) => matches(m.field, p.keywords));
    out[p.key] = hits.length === 0 ? 'ok' : hits.some((m) => m.blocking) ? 'blocked' : 'warn';
  }
  return out;
}

export function blockingMissing(booking: OpsBooking) {
  return booking.missing.filter((m) => m.blocking);
}

export function readinessPercent(booking: OpsBooking) {
  const st = pillarStatus(booking);
  const score = PILLARS.reduce((n, p) => n + (st[p.key] === 'ok' ? 1 : st[p.key] === 'warn' ? 0.5 : 0), 0);
  return Math.round((score / PILLARS.length) * 100);
}
