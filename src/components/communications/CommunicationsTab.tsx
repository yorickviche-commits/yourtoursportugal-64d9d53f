/**
 * Communications tab — thin wrapper around the AI-first email workspace.
 * Kept as the same component/API so LeadDetailPage, TripDetailPage and the
 * mobile page continue to work unchanged.
 */
import CommunicationsWorkspace from './CommunicationsWorkspace';
import type { TemplateContext } from '@/data/emailTemplates';

interface LeadContext {
  clientName: string;
  email: string;
  phone?: string;
  destination: string;
  travelDates: string;
  pax: number;
  status: string;
  budgetLevel: string;
  travelStyle?: string[];
  comfortLevel?: string;
  magicQuestion?: string;
  notes?: string;
  leadId?: string;
  language?: string;
}

interface Props {
  scope: 'lead' | 'trip';
  entityId: string;
  recipientEmail?: string;
  context: TemplateContext;
  leadContext?: LeadContext;
}

const CommunicationsTab = ({ scope, entityId, recipientEmail, context, leadContext }: Props) => (
  <CommunicationsWorkspace
    scope={scope}
    entityId={entityId}
    recipientEmail={recipientEmail || leadContext?.email || ''}
    clientName={leadContext?.clientName || context.client_name || ''}
    salesOwner={context.sales_owner || ''}
    language={leadContext?.language || 'EN'}
  />
);

export default CommunicationsTab;
