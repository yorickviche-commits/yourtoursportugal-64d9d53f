import { TripStatus, UrgencyLevel, ApprovalType } from '@/types';

export const statusConfig: Record<TripStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  proposal_sent: { label: 'Proposal Sent', className: 'bg-info-muted text-info' },
  approved: { label: 'Approved', className: 'bg-success-muted text-success' },
  confirmed: { label: 'Confirmed', className: 'bg-success-muted text-success' },
  in_progress: { label: 'In Progress', className: 'bg-urgent-muted text-urgent' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive' },
};

export const urgencyConfig: Record<UrgencyLevel, { label: string; className: string }> = {
  'D-1': { label: 'D-1', className: 'bg-destructive text-destructive-foreground urgency-pulse' },
  'D-3': { label: 'D-3', className: 'bg-urgent text-urgent-foreground' },
  'D-7': { label: 'D-7', className: 'bg-warning text-warning-foreground' },
  'future': { label: 'Future', className: 'bg-muted text-muted-foreground' },
};

export const approvalTypeConfig: Record<ApprovalType, { label: string; className: string }> = {
  itinerary: { label: 'Itinerary', className: 'bg-info-muted text-info' },
  pricing: { label: 'Pricing', className: 'bg-warning-muted text-warning' },
  change_request: { label: 'Change Request', className: 'bg-urgent-muted text-urgent' },
};

export const budgetLabels: Record<string, string> = {
  budget: 'Budget',
  'mid-range': 'Mid-Range',
  luxury: 'Luxury',
  'ultra-luxury': 'Ultra-Luxury',
};
