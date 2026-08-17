export const BOOKING_OPTIONS = [
  { value: 'neutral', label: 'Neutro', className: 'bg-muted text-muted-foreground' },
  { value: 'sent', label: 'Enviado', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  { value: 'booked', label: 'Reservado', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
];

export const PAYMENT_OPTIONS = [
  { value: 'neutral', label: 'Neutro', className: 'bg-muted text-muted-foreground' },
  { value: 'paid', label: 'Pago', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
  { value: 'partially_paid', label: 'Pago Parcialmente', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  { value: 'monthly_account', label: 'Conta Mensal', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  { value: 'guide_to_pay', label: 'A Pagar pelo Guia', className: 'bg-purple-100 text-purple-700' },
  { value: 'not_paid', label: 'Não Pago', className: 'bg-destructive/15 text-destructive' },
];

export const INVOICE_OPTIONS = [
  { value: 'not_received', label: 'Não Recebida', className: 'bg-muted text-muted-foreground' },
  { value: 'guide_pickup', label: 'A Levantar pelo Guia', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  { value: 'received', label: 'Recebida', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
];

/** Converte valores antigos gravados na BD para os novos valores. */
export const normalizeBookingStatus = (status: string | null | undefined): string => {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (s === 'confirmed') return 'booked';
  if (s === 'requested') return 'sent';
  if (['declined', 'cancelled', 'waitlisted'].includes(s)) return 'neutral';
  if (BOOKING_OPTIONS.some(o => o.value === s)) return s;
  return 'neutral';
};

export const normalizePaymentStatus = (status: string | null | undefined): string => {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (s === 'refunded') return 'neutral';
  if (PAYMENT_OPTIONS.some(o => o.value === s)) return s;
  return 'neutral';
};

export const normalizeInvoiceStatus = (status: string | null | undefined): string => {
  if (!status) return 'not_received';
  const s = status.toLowerCase();
  if (['invoice_requested', 'invoice_approved', 'invoice_paid'].includes(s)) return 'received';
  if (INVOICE_OPTIONS.some(o => o.value === s)) return s;
  return 'not_received';
};

export interface OpsRow {
  itemKey: string;
  dayNumber: number;
  source: 'planner' | 'manual';
  activityTitle: string;
  supplier: string;
  pax: number;
  netValue: number;
  realCost: number | null;
  scheduleTime: string;
  bookingStatus: string;
  paymentStatus: string;
  invoiceStatus: string;
  invoiceUrl: string | null;
  invoiceName: string | null;
  opId?: string;
}
