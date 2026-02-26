export type TripStatus = 'draft' | 'proposal_sent' | 'approved' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type UrgencyLevel = 'D-1' | 'D-3' | 'D-7' | 'future';
export type ApprovalType = 'itinerary' | 'pricing' | 'change_request';
export type UserRole = 'sales' | 'operations';

export interface Trip {
  id: string;
  clientName: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  salesOwner: string;
  budgetLevel: 'budget' | 'mid-range' | 'luxury' | 'ultra-luxury';
  pax: number;
  urgency: UrgencyLevel;
  totalValue: number;
  notes: string;
  hasBlocker: boolean;
  blockerNote?: string;
}

export interface ApprovalItem {
  id: string;
  tripId: string;
  clientName: string;
  type: ApprovalType;
  title: string;
  submittedBy: string;
  submittedAt: string;
  priority: 'low' | 'medium' | 'high';
  summary: string;
}

export interface DashboardStats {
  tripsNext7Days: number;
  pendingApprovals: number;
  pendingReservations: number;
  blockedItems: number;
  newLeads: number;
  qualifiedLeads: number;
  proposalsSent: number;
}
