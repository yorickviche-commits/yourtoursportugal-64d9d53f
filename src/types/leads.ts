export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
export type LeadSource = 'website' | 'referral' | 'social_media' | 'partner' | 'direct' | 'ai_simulation';

export interface Lead {
  id: string;
  clientName: string;
  email: string;
  phone?: string;
  destination: string;
  travelDates: string;
  pax: number;
  status: LeadStatus;
  source: LeadSource;
  budgetLevel: string;
  salesOwner: string;
  createdAt: string;
  lastContact?: string;
  notes?: string;
  travelStyle?: string[];
  comfortLevel?: string;
  magicQuestion?: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'image' | 'spreadsheet' | 'other';
  tripId?: string;
  leadId?: string;
  tags: string[];
  uploadedAt: string;
  uploadedBy: string;
  size: string;
  driveUrl?: string;
}

export interface SimulationFormData {
  name: string;
  email: string;
  travelDates: string;
  pax: number;
  destination: string;
  travelStyles: string[];
  comfortLevel: string;
  budget: string;
  magicQuestion: string;
}
