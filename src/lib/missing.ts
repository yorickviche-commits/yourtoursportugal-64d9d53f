import type { OpsStage } from '@/types/ops';

const REQUIRED: Record<OpsStage, string[]> = {
  deposit_received: ['Payment verified in system', 'Calendar event created'],
  suppliers_confirmation: ['All FSE suppliers confirmed', 'Supplier payments scheduled'],
  technical_briefing: ['Guide assigned', 'Transport confirmed', 'Itinerary final'],
  clients_final_briefing: ['Client briefing sent', 'Pickup point confirmed'],
  in_execution: [],
  post_trip: ['Feedback requested'],
  deferred: ['New date proposed'],
  archived: [],
};

export function requiredFields(stage: OpsStage): string[] {
  return REQUIRED[stage] ?? [];
}
