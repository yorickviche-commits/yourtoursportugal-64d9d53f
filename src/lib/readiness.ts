import type { OpsBooking } from '@/types/ops';

export type PillarKey = 'payment' | 'fse_bookings' | 'briefing_fse' | 'briefing_client';
export type PillarStatus = 'ok' | 'warn' | 'blocked';

interface Pillar {
  key: PillarKey;
  label: string;
  short: string;
  keywords: string[];
}

/** The four operational states the wizard always watches for every lead. */
export const PILLARS: Pillar[] = [
  {
    key: 'payment',
    label: 'Client payments received (deposit / balance)',
    short: 'PAYMENTS',
    keywords: ['payment', 'deposit', 'balance', 'invoice', 'pago', 'pagamento', 'wetravel'],
  },
  {
    key: 'fse_bookings',
    label: 'FSE & bookings complete (suppliers, guide, transport)',
    short: 'FSE & BOOKINGS',
    keywords: [
      'supplier', 'fse', 'hotel', 'restaurant', 'booking', 'reservation', 'reserva',
      'guide', 'transport', 'vehicle', 'driver', 'van', 'pickup',
    ],
  },
  {
    key: 'briefing_fse',
    label: 'Final briefing sent to FSEs / guide / transport',
    short: 'BRIEFING FSE',
    keywords: ['technical briefing', 'supplier briefing', 'guide briefing', 'briefing fse', 'operational briefing'],
  },
  {
    key: 'briefing_client',
    label: 'Final briefing & documents sent to client',
    short: 'BRIEFING CLIENTE',
    keywords: ['client briefing', 'final briefing', 'briefing cliente', 'voucher', 'final doc', 'itinerary final', 'welcome pack'],
  },
];

const matches = (field: string, keywords: string[]) => {
  const f = field.toLowerCase();
  return keywords.some((k) => f.includes(k));
};

/** Generic briefing wording that does not say FSE or client explicitly → applies to both. */
const isGenericBriefing = (field: string) => {
  const f = field.toLowerCase();
  return (f.includes('briefing') || f.includes('brief'))
    && !f.includes('fse') && !f.includes('supplier') && !f.includes('guide')
    && !f.includes('client') && !f.includes('cliente');
};

export function pillarStatus(booking: OpsBooking): Record<PillarKey, PillarStatus> {
  const out = {} as Record<PillarKey, PillarStatus>;
  for (const p of PILLARS) {
    const hits = booking.missing.filter((m) => {
      if (matches(m.field, p.keywords)) return true;
      if ((p.key === 'briefing_fse' || p.key === 'briefing_client') && isGenericBriefing(m.field)) return true;
      return false;
    });
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

export const PILLAR_TONE: Record<PillarStatus, { fg: string; bg: string; border: string; word: string }> = {
  ok: { fg: '#0a6b4c', bg: 'rgba(15,157,107,0.16)', border: 'rgba(15,157,107,0.55)', word: 'OK' },
  warn: { fg: '#8a5600', bg: 'rgba(196,122,0,0.18)', border: 'rgba(196,122,0,0.55)', word: 'PARTIAL' },
  blocked: { fg: '#a81026', bg: 'rgba(217,45,67,0.16)', border: 'rgba(217,45,67,0.55)', word: 'MISSING' },
};
