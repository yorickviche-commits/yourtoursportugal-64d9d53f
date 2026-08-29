import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OpsAction, OpsBooking, DeepLink, MissingItem, OpsStage, Severity, ActivityEvent } from '@/types/ops';
import { gmailLink, calendarLink } from '@/lib/links';

const DAY = 86400000;

/** NetHunt stage → operational stage of the wizard. */
function toStage(nethuntStage: string | null, status: string | null): OpsStage {
  const s = (nethuntStage ?? '').toLowerCase();
  if (s.includes('deposit') || s.includes('payment received')) return 'deposit_received';
  if (s.includes('suppliers')) return 'suppliers_confirmation';
  if (s.includes('technical')) return 'technical_briefing';
  if (s.includes('in execution') || s.includes('trip ready')) return 'in_execution';
  if (s.includes('post-trip') || s.includes('post trip')) return 'post_trip';
  if (s.includes('deferred') || s.includes('postponed')) return 'deferred';
  if (s.includes('archive')) return 'archived';
  return status === 'won' ? 'deposit_received' : 'deposit_received';
}

const daysSince = (iso?: string | null) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / DAY)) : 0;

const daysUntil = (date?: string | null) => {
  if (!date) return Number.POSITIVE_INFINITY;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : Math.round((t - Date.now()) / DAY);
};

const nethuntUrl = (recordId?: string | null) =>
  recordId ? `https://nethunt.com/web/#nethunt/record/${recordId}` : null;

type LeadRow = {
  id: string;
  yt_id: string | null;
  lead_code: string | null;
  client_name: string | null;
  email: string | null;
  destination: string | null;
  pax: number | null;
  status: string | null;
  nethunt_stage: string | null;
  nethunt_record_id: string | null;
  trip_start: string | null;
  travel_dates: string | null;
  updated_at: string | null;
};

/** Builds bookings + actions from the real lead / payments / operations / briefing data. */
function build(
  leads: LeadRow[],
  payments: { lead_id: string; kind: string | null; amount: number | null }[],
  links: { lead_id: string | null; status: string | null }[],
  operations: { lead_id: string; booking_status: string | null; supplier: string | null; activity_title: string | null; net_value: number | null }[],
  emails: { lead_id: string | null; email_category: string | null; sent_at: string | null }[],
) {
  const byLead = <T extends { lead_id: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      if (!r.lead_id) continue;
      const list = m.get(r.lead_id) ?? [];
      list.push(r);
      m.set(r.lead_id, list);
    }
    return m;
  };

  const paysByLead = byLead(payments as { lead_id: string | null; kind: string | null; amount: number | null }[]);
  const linksByLead = byLead(links);
  const opsByLead = byLead(operations as { lead_id: string | null; booking_status: string | null; supplier: string | null; activity_title: string | null; net_value: number | null }[]);
  const mailsByLead = byLead(emails);

  const bookings: OpsBooking[] = [];
  const actions: OpsAction[] = [];

  for (const l of leads) {
    const ref = l.yt_id || l.lead_code || l.id.slice(0, 8);
    const departure = l.trip_start || (l.travel_dates && /^\d{4}-\d{2}-\d{2}/.test(l.travel_dates) ? l.travel_dates.slice(0, 10) : '') || '';
    const dUntil = daysUntil(departure);
    const stage = toStage(l.nethunt_stage, l.status);

    const pays = paysByLead.get(l.id) ?? [];
    const paid = pays.reduce((n, p) => n + Number(p.amount ?? 0), 0);
    const hasLink = (linksByLead.get(l.id) ?? []).length > 0;

    const ops = opsByLead.get(l.id) ?? [];
    const unconfirmed = ops.filter((o) => (o.booking_status ?? 'pending').toLowerCase() !== 'confirmed');

    const mails = mailsByLead.get(l.id) ?? [];
    const clientBriefing = mails.some((m) => (m.email_category ?? '').toLowerCase().includes('client'));
    const fseBriefing = mails.some((m) => !(m.email_category ?? '').toLowerCase().includes('client'));

    const missing: MissingItem[] = [];
    // Pillar 1 — client payments
    if (paid <= 0) {
      missing.push({ field: hasLink ? 'Payment pending (link sent)' : 'Deposit / payment not received', blocking: true });
    }
    // Pillar 2 — FSE & bookings (suppliers, guide, transport)
    if (ops.length === 0) {
      missing.push({ field: 'FSE supplier bookings not started', blocking: true });
    } else if (unconfirmed.length) {
      missing.push({
        field: `FSE supplier bookings pending (${unconfirmed.length})`,
        blocking: dUntil <= 7,
      });
    }
    // Pillar 3 — briefing to FSEs / guide / transport
    if (!fseBriefing) missing.push({ field: 'Supplier briefing FSE not sent', blocking: dUntil <= 3 });
    // Pillar 4 — briefing & documents to client
    if (!clientBriefing) missing.push({ field: 'Client briefing not sent', blocking: dUntil <= 3 });

    const deepLinks: DeepLink[] = [
      { type: 'internal', label: 'Lead', url: `/leads/${l.id}` },
      ...(nethuntUrl(l.nethunt_record_id) ? [{ type: 'nethunt' as const, label: 'CRM', url: nethuntUrl(l.nethunt_record_id)! }] : []),
      { type: 'gmail', label: 'Email', url: gmailLink(l.email || l.client_name || ref) },
      ...(departure ? [{ type: 'calendar' as const, label: 'Calendar', url: calendarLink(departure) }] : []),
    ];

    const booking: OpsBooking = {
      id: l.id,
      ref,
      clientName: l.client_name ?? '(sem nome)',
      product: l.destination ?? '',
      stage,
      departureDate: departure,
      pax: l.pax ?? 0,
      language: 'EN',
      daysInStage: daysSince(l.updated_at),
      lastContactDays: daysSince(l.updated_at),
      missing,
      links: deepLinks,
    };
    bookings.push(booking);

    // One action per blocking/warning gap, prioritised by departure proximity.
    for (const m of missing) {
      const severity: Severity = m.blocking && dUntil <= 3 ? 'critical' : m.blocking ? 'high' : 'medium';
      const deadlineLabel = !departure
        ? 'sem data'
        : dUntil < 0 ? 'partiu' : dUntil === 0 ? 'hoje' : `D-${dUntil}`;
      actions.push({
        id: `${l.id}:${m.field}`,
        bookingId: l.id,
        severity,
        title: `${ref} · ${m.field}`,
        subtitle: `${booking.clientName}${booking.product ? ` — ${booking.product}` : ''}${departure ? ` · partida ${departure}` : ''}`,
        stage,
        deadlineLabel,
        deadlineISO: departure ? new Date(departure).toISOString() : '',
        state: m.blocking ? 'pending' : 'awaiting_supplier',
        priorityScore: 0,
        primaryLabel: 'ABRIR LEAD',
        secondaryLabel: 'CRM',
        draftSubject: `${ref} — ${m.field}`,
        draftBody: '',
        recipient: booking.clientName,
        links: deepLinks,
      });
    }
  }

  return { bookings, actions };
}

export function useOpsData() {
  const query = useQuery({
    queryKey: ['ops-data-real'],
    queryFn: async () => {
      const { data: leadRows, error } = await supabase
        .from('leads')
        .select('id, yt_id, lead_code, client_name, email, destination, pax, status, nethunt_stage, nethunt_record_id, trip_start, travel_dates, updated_at')
        .or('status.eq.won,nethunt_stage.ilike.OPERATIONS%')
        .order('trip_start', { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;

      const leads = ((leadRows ?? []) as LeadRow[]).filter(
        (l) => !/archive/i.test(l.nethunt_stage ?? ''),
      );
      const ids = leads.map((l) => l.id);
      if (!ids.length) return { bookings: [], actions: [] };

      const [pay, plink, ops, mails] = await Promise.all([
        supabase.from('lead_payments').select('lead_id, kind, amount').in('lead_id', ids),
        supabase.from('payment_links').select('lead_id, status').in('lead_id', ids),
        supabase.from('lead_operations').select('lead_id, booking_status, supplier, activity_title, net_value').in('lead_id', ids),
        supabase.from('booking_emails_log').select('lead_id, email_category, sent_at').in('lead_id', ids),
      ]);

      return build(
        leads,
        (pay.data ?? []) as any[],
        (plink.data ?? []) as any[],
        (ops.data ?? []) as any[],
        (mails.data ?? []) as any[],
      );
    },
    staleTime: 60_000,
  });

  return {
    bookings: query.data?.bookings ?? [],
    actions: query.data?.actions ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Recent real operational activity (audit log + CRM timeline). */
export function useOpsActivity() {
  return useQuery({
    queryKey: ['ops-activity'],
    queryFn: async (): Promise<ActivityEvent[]> => {
      const [logs, timeline] = await Promise.all([
        supabase.from('activity_logs').select('action_type, entity_type, entity_id, created_at').order('created_at', { ascending: false }).limit(15),
        supabase.from('nethunt_timeline').select('event_type, subject, snippet, event_time').order('event_time', { ascending: false }).limit(15),
      ]);

      const fmt = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

      const a: ActivityEvent[] = ((logs.data ?? []) as any[]).map((r) => ({
        time: fmt(r.created_at),
        label: String(r.action_type ?? 'evento'),
        sub: `${r.entity_type ?? ''} ${r.entity_id ?? ''}`.trim(),
        icon: 'check',
        color: '#0a6b4c',
      }));
      const b: ActivityEvent[] = ((timeline.data ?? []) as any[]).map((r) => ({
        time: fmt(r.event_time),
        label: String(r.subject ?? r.event_type ?? 'evento CRM'),
        sub: String(r.snippet ?? '').slice(0, 120),
        icon: r.event_type === 'email' ? 'mail' : r.event_type === 'calendar' ? 'clock' : 'check',
        color: r.event_type === 'email' ? '#0f3fb8' : '#4b32b0',
      }));

      return [...a, ...b]
        .sort((x, y) => y.time.localeCompare(x.time))
        .slice(0, 20);
    },
    staleTime: 60_000,
  });
}
