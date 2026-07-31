export const BOOKING_OPTIONS = [
  { value: 'not_requested', label: 'Não Pedido', className: 'bg-muted text-muted-foreground' },
  { value: 'requested', label: 'Pedido', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  { value: 'confirmed', label: 'Confirmado', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
  { value: 'declined', label: 'Recusado', className: 'bg-destructive/15 text-destructive' },
  { value: 'cancelled', label: 'Cancelado', className: 'bg-destructive/15 text-destructive' },
  { value: 'waitlisted', label: 'Em Espera', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
];

export const PAYMENT_OPTIONS = [
  { value: 'not_paid', label: 'Não Pago', className: 'bg-destructive/15 text-destructive' },
  { value: 'partially_paid', label: 'Parcialmente Pago', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  { value: 'paid', label: 'Pago', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
  { value: 'refunded', label: 'Reembolsado', className: 'bg-purple-100 text-purple-700' },
];

export const INVOICE_OPTIONS = [
  { value: 'no_invoice', label: 'Sem Fatura', className: 'bg-muted text-muted-foreground' },
  { value: 'invoice_requested', label: 'Pedida', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  { value: 'invoice_received', label: 'Recebida', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  { value: 'invoice_approved', label: 'Aprovada', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
  { value: 'invoice_paid', label: 'Paga', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
];

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
