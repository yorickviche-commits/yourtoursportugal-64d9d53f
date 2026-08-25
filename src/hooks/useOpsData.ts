import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OpsAction, OpsBooking, DeepLink, MissingItem, OpsStage, Severity, ActionState } from '@/types/ops';
import { mockBookings, mockActions } from '@/data/mockOps';

/** Maps a DB row to the OpsBooking shape the components already consume. */
const toBooking = (r: any): OpsBooking => ({
  id: r.id,
  clientName: r.client_name ?? '',
  product: r.product ?? '',
  stage: (r.stage ?? 'deposit_received') as OpsStage,
  departureDate: r.departure_date ?? '',
  pax: r.pax ?? 0,
  language: (r.language ?? 'EN') as OpsBooking['language'],
  daysInStage: r.days_in_stage ?? 0,
  lastContactDays: r.last_contact_days ?? 0,
  missing: (r.missing ?? []) as MissingItem[],
  links: (r.links ?? []) as DeepLink[],
});

const toAction = (r: any): OpsAction => ({
  id: r.id,
  bookingId: r.booking_id,
  severity: (r.severity ?? 'medium') as Severity,
  title: r.title ?? '',
  subtitle: r.subtitle ?? '',
  stage: (r.stage ?? 'deposit_received') as OpsStage,
  deadlineLabel: r.deadline_label ?? '',
  deadlineISO: r.deadline_iso ?? '',
  state: (r.state ?? 'pending') as ActionState,
  priorityScore: r.priority_score ?? 0,
  primaryLabel: r.primary_label ?? '',
  secondaryLabel: r.secondary_label ?? '',
  draftSubject: r.draft_subject ?? '',
  draftBody: r.draft_body ?? '',
  recipient: r.recipient ?? '',
  links: (r.links ?? []) as DeepLink[],
});

export const bookingToRow = (b: OpsBooking) => ({
  id: b.id,
  client_name: b.clientName,
  product: b.product,
  stage: b.stage,
  departure_date: b.departureDate || null,
  pax: b.pax,
  language: b.language,
  days_in_stage: b.daysInStage,
  last_contact_days: b.lastContactDays,
  missing: b.missing,
  links: b.links,
});

export const actionToRow = (a: OpsAction) => ({
  id: a.id,
  booking_id: a.bookingId,
  severity: a.severity,
  title: a.title,
  subtitle: a.subtitle,
  stage: a.stage,
  deadline_label: a.deadlineLabel,
  deadline_iso: a.deadlineISO || null,
  state: a.state,
  priority_score: a.priorityScore,
  primary_label: a.primaryLabel,
  secondary_label: a.secondaryLabel,
  draft_subject: a.draftSubject,
  draft_body: a.draftBody,
  recipient: a.recipient,
  links: a.links,
});

/** Inserts the seed dataset (idempotent upsert). */
export async function seedOpsData() {
  const { error: bErr } = await supabase
    .from('ops_bookings' as any)
    .upsert(mockBookings.map(bookingToRow) as any, { onConflict: 'id' });
  if (bErr) throw bErr;
  const { error: aErr } = await supabase
    .from('ops_actions' as any)
    .upsert(mockActions.map(actionToRow) as any, { onConflict: 'id' });
  if (aErr) throw aErr;
}

export function useOpsData() {
  const query = useQuery({
    queryKey: ['ops-data'],
    queryFn: async () => {
      const [b, a] = await Promise.all([
        supabase.from('ops_bookings' as any).select('*'),
        supabase.from('ops_actions' as any).select('*'),
      ]);
      if (b.error) throw b.error;
      if (a.error) throw a.error;
      return {
        bookings: ((b.data ?? []) as any[]).map(toBooking),
        actions: ((a.data ?? []) as any[]).map(toAction),
      };
    },
    staleTime: 30_000,
  });

  const empty = !query.data || query.data.bookings.length === 0;

  return {
    // Fall back to the seed dataset while empty so the cockpit is never blank.
    bookings: empty ? mockBookings : query.data!.bookings,
    actions: empty ? mockActions : query.data!.actions,
    isSeeded: !empty,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
