export type OpsStage =
  | 'deposit_received'
  | 'suppliers_confirmation'
  | 'technical_briefing'
  | 'clients_final_briefing'
  | 'in_execution'
  | 'post_trip'
  | 'deferred'
  | 'archived';

export type Severity = 'critical' | 'high' | 'medium';
export type ActionState = 'pending' | 'awaiting_supplier' | 'awaiting_approval' | 'done';
export type LinkType = 'nethunt' | 'gmail' | 'calendar' | 'fse' | 'internal';

export interface DeepLink {
  type: LinkType;
  label: string;
  url: string;
}

export interface MissingItem {
  field: string;
  blocking: boolean;
}

export interface OpsBooking {
  id: string;
  clientName: string;
  product: string;
  stage: OpsStage;
  departureDate: string;
  pax: number;
  language: 'EN' | 'FR' | 'PT' | 'ES';
  daysInStage: number;
  lastContactDays: number;
  missing: MissingItem[];
  links: DeepLink[];
}

export interface OpsAction {
  id: string;
  bookingId: string;
  severity: Severity;
  title: string;
  subtitle: string;
  stage: OpsStage;
  deadlineLabel: string;
  deadlineISO: string;
  state: ActionState;
  priorityScore: number;
  primaryLabel: string;
  secondaryLabel: string;
  draftSubject: string;
  draftBody: string;
  recipient: string;
  links: DeepLink[];
}

export interface ActivityEvent {
  time: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
}
