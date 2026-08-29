import { LeadStatus } from '@/types/leads';

/** Estágios do YT Pipeline (NetHunt) — fonte única de verdade para estados de leads. */
export interface LeadStage {
  /** Valor guardado em leads.nethunt_stage */
  stage: string;
  /** Etiqueta curta para badges */
  label: string;
  group: 'SALES' | 'OPERATIONS';
  className: string;
  /** Status interno equivalente (compatibilidade com lógica existente) */
  status: LeadStatus;
}

export const LEAD_STAGES: LeadStage[] = [
  { stage: 'SALES - New Lead', label: 'New Lead', group: 'SALES', status: 'new', className: 'bg-[hsl(var(--stage-new))] text-white font-semibold ring-2 ring-[hsl(var(--stage-new))]/30' },
  { stage: 'SALES - - Budgeting & Fine-Tuning', label: 'Budgeting & Fine-Tuning', group: 'SALES', status: 'proposal_sent', className: 'bg-[hsl(var(--stage-budget))]/15 text-[hsl(var(--stage-budget))] ring-1 ring-[hsl(var(--stage-budget))]/30' },
  { stage: 'SALES - Final Negotiation & Ready to Book', label: 'Final Negotiation & Ready to Book', group: 'SALES', status: 'negotiation', className: 'bg-[hsl(var(--stage-nego))]/15 text-[hsl(var(--stage-nego))] ring-1 ring-[hsl(var(--stage-nego))]/30' },
  { stage: 'SALES - Archive', label: 'Archive (Sales)', group: 'SALES', status: 'lost', className: 'bg-[hsl(var(--stage-archive-sales))]/15 text-[hsl(var(--stage-archive-sales))] ring-1 ring-[hsl(var(--stage-archive-sales))]/30' },
  { stage: 'OPERATIONS - Deposit/Payment Received', label: 'Deposit/Payment Received', group: 'OPERATIONS', status: 'won', className: 'bg-[hsl(var(--stage-deposit))] text-white font-semibold' },
  { stage: 'OPERATIONS - Suppliers Bookings & Confirmations', label: 'Suppliers Bookings & Confirmations', group: 'OPERATIONS', status: 'won', className: 'bg-[hsl(var(--stage-suppliers))]/15 text-[hsl(var(--stage-suppliers))] ring-1 ring-[hsl(var(--stage-suppliers))]/30' },
  { stage: 'OPERATIONS - Technical Briefing (Internal & Suppliers Final Validations)', label: 'Technical Briefing', group: 'OPERATIONS', status: 'won', className: 'bg-[hsl(var(--stage-briefing))]/15 text-[hsl(var(--stage-briefing))] ring-1 ring-[hsl(var(--stage-briefing))]/30' },
  { stage: 'OPERATIONS - Trip Ready / In Execution', label: 'Trip Ready / In Execution', group: 'OPERATIONS', status: 'won', className: 'bg-[hsl(var(--stage-ready))] text-white font-semibold' },
  { stage: 'OPERATIONS - Post-Trip Loop / Feedback', label: 'Post-Trip Loop / Feedback', group: 'OPERATIONS', status: 'won', className: 'bg-[hsl(var(--stage-posttrip))]/15 text-[hsl(var(--stage-posttrip))] ring-1 ring-[hsl(var(--stage-posttrip))]/30' },
  { stage: 'OPERATIONS - Deferred / Postponed Trip', label: 'Deferred / Postponed Trip', group: 'OPERATIONS', status: 'won', className: 'bg-[hsl(var(--stage-deferred))]/15 text-[hsl(var(--stage-deferred))] ring-1 ring-[hsl(var(--stage-deferred))]/30' },
  { stage: 'OPERATIONS - Archive', label: 'Archive (Ops)', group: 'OPERATIONS', status: 'lost', className: 'bg-[hsl(var(--stage-archive-ops))] text-white font-semibold' },
];

/** Fallback: leads sem nethunt_stage usam o stage equivalente ao status interno. */
export const STATUS_TO_STAGE: Record<string, string> = {
  new: 'SALES - New Lead',
  contacted: 'SALES - New Lead',
  qualified: 'SALES - - Budgeting & Fine-Tuning',
  proposal_sent: 'SALES - - Budgeting & Fine-Tuning',
  negotiation: 'SALES - Final Negotiation & Ready to Book',
  won: 'OPERATIONS - Deposit/Payment Received',
  lost: 'SALES - Archive',
};

export const normStage = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export const resolveStage = (lead: { nethunt_stage?: string | null; status?: string | null }): LeadStage => {
  const raw = (lead as any).nethunt_stage || STATUS_TO_STAGE[lead.status || 'new'] || 'SALES - New Lead';
  const key = normStage(raw);
  return LEAD_STAGES.find(s => normStage(s.stage) === key) || LEAD_STAGES[0];
};
