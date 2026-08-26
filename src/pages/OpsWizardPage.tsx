import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Euro, Plane, Sparkles, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink, CalendarClock, MessageSquare,
  CalendarDays, LayoutList, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { mockActivity } from '@/data/mockOps';
import { useOpsData, seedOpsData } from '@/hooks/useOpsData';
import type { ActionState, OpsAction, OpsBooking, OpsStage, Severity } from '@/types/ops';
import { priorityScore } from '@/lib/priority';
import { openDeepLink } from '@/lib/links';
import { PILLARS, PILLAR_TONE, pillarStatus, readinessPercent } from '@/lib/readiness';


/* ── tokens ───────────────────────────────────────────────────────────── */
const C = {
  bg: '#eef3fb',
  panel: '#ffffff',
  border: 'rgba(28,79,216,0.28)',
  text: '#04182c',
  muted: 'rgba(4,24,44,0.78)',
  accent: '#0f3fb8',
  accentLight: '#1c4fd8',
  critical: '#b3122c',
  high: '#8a5600',
  medium: '#0f3fb8',
  success: '#0a6b4c',
  purple: '#4b32b0',
  soft: '#e3ecfb',
};

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const UI = "'Instrument Sans', system-ui, sans-serif";

const STAGE_ORDER: OpsStage[] = [
  'deposit_received',
  'suppliers_confirmation',
  'technical_briefing',
  'clients_final_briefing',
  'in_execution',
  'post_trip',
  'deferred',
  'archived',
];

const STAGE_LABEL: Record<OpsStage, string> = {
  deposit_received: 'Deposit / Payment Received',
  suppliers_confirmation: 'Suppliers Confirmation / Payments',
  technical_briefing: 'Technical Briefing',
  clients_final_briefing: 'Clients Final Briefing',
  in_execution: 'Trip Ready / In Execution',
  post_trip: 'Post-Trip',
  deferred: 'Deferred / Postponed',
  archived: 'Archive',
};

const SEV_COLOR: Record<Severity, string> = {
  critical: C.critical,
  high: C.high,
  medium: C.medium,
};

const STATE_LABEL: Record<ActionState, string> = {
  pending: 'PENDING',
  awaiting_supplier: 'AWAITING SUPPLIER',
  awaiting_approval: 'AWAITING APPROVAL',
  done: 'DONE',
};

const ACTIVITY_ICON: Record<string, any> = {
  euro: Euro,
  check: CheckCircle2,
  plane: Plane,
  clock: Clock,
  mail: MessageSquare,
};

type KpiFilter = null | 'critical' | 'approvals' | 'blocked' | 'departures';
type SevFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM';
type StageFilter = 'ALL' | 'SOON' | 'BLOCKED';


const DAY = 86400000;
const isSoon = (iso: string, days: number) => {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t - Date.now() <= days * DAY;
};

const panelStyle: React.CSSProperties = {
  background: C.panel,
  border: `1.5px solid ${C.border}`,
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(10,37,64,0.06), 0 10px 26px -18px rgba(10,37,64,0.28)',
};

const Label = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.13em', color: C.muted, textTransform: 'uppercase', ...style }}>
    {children}
  </div>
);

/* ── horizontal collapsible board card ────────────────────────────────── */
type CardKey = 'queue' | 'pipeline' | 'review' | 'activity';

function BoardCard({
  id, title, subtitle, count, open, onToggle, headerRight, children, grow,
}: {
  id: CardKey;
  title: string;
  subtitle?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  grow?: number;
}) {
  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="flex w-[46px] shrink-0 flex-col items-center gap-3 overflow-hidden py-3"
        style={{ ...panelStyle, background: C.soft }}
        title={`Expand ${title}`}
      >
        <ChevronRight size={15} style={{ color: C.accent }} />
        {typeof count === 'number' && (
          <span
            className="rounded-full px-1.5"
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: '#fff', background: C.accent }}
          >
            {count}
          </span>
        )}
        <span
          style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em',
            color: C.text, writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </button>
    );
  }
  return (
    <section
      className="flex min-w-[320px] flex-col overflow-hidden"
      style={{ ...panelStyle, flex: `${grow ?? 1} 1 0%` }}
      data-card={id}
    >
      <div
        className="flex shrink-0 items-start justify-between gap-3 px-4 pt-3 pb-2.5"
        style={{ borderBottom: `1.5px solid ${C.border}`, background: 'rgba(28,79,216,0.06)' }}
      >
        <button onClick={onToggle} className="flex min-w-0 items-start gap-2 text-left">
          <ChevronDown size={15} style={{ color: C.accent, marginTop: 1 }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: C.text }}>
                {title}
              </span>
              {typeof count === 'number' && (
                <span
                  className="rounded-full px-1.5"
                  style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: '#fff', background: C.accent }}
                >
                  {count}
                </span>
              )}
            </div>
            {subtitle && <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
          </div>
        </button>
        {headerRight && <div className="flex shrink-0 items-center gap-1.5">{headerRight}</div>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */
export default function OpsWizardPage() {
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [sevFilter, setSevFilter] = useState<SevFilter>('ALL');
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [selectedStage, setSelectedStage] = useState<OpsStage>('deposit_received');
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [stageAfterSend, setStageAfterSend] = useState<OpsStage>('deposit_received');
  const [askOpen, setAskOpen] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [view, setView] = useState<'pipeline' | 'calendar'>('pipeline');
  const [monthOffset, setMonthOffset] = useState(0);
  const [missingOpen, setMissingOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [openCards, setOpenCards] = useState<Record<CardKey, boolean>>({
    queue: true, pipeline: true, review: true, activity: false,
  });
  const [peek, setPeek] = useState<OpsBooking | null>(null);

  const { bookings, actions, isLoading, isSeeded, refetch } = useOpsData();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedOpsData();
      await refetch();
      toast.success('Dados operacionais importados para a base de dados');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao importar dados operacionais');
    } finally {
      setSeeding(false);
    }
  };

  const toggleCard = (k: CardKey) => setOpenCards((p) => ({ ...p, [k]: !p[k] }));
  const setAllCards = (v: boolean) => setOpenCards({ queue: v, pipeline: v, review: v, activity: v });
  const openCount = Object.values(openCards).filter(Boolean).length;



  const bookingById = useMemo(() => {
    const m = new Map<string, OpsBooking>();
    bookings.forEach((b) => m.set(b.id, b));
    return m;
  }, [bookings]);

  const scored = useMemo(
    () =>
      actions
        .filter((a) => !doneIds.includes(a.id) && a.state !== 'done')
        .map((a) => ({ action: a, score: priorityScore(a, bookingById.get(a.bookingId) as OpsBooking) }))
        .sort((x, y) => y.score - x.score || x.action.deadlineISO.localeCompare(y.action.deadlineISO)),
    [doneIds, bookingById, actions],
  );

  const kpis = useMemo(() => {
    const live = actions.filter((a) => !doneIds.includes(a.id) && a.state !== 'done');
    return {
      critical: live.filter((a) => a.severity === 'critical').length,
      approvals: live.filter((a) => a.state === 'awaiting_approval').length,
      blocked: bookings.filter((b) => b.missing.some((m) => m.blocking)).length,
      departures: bookings.filter((b) => isSoon(b.departureDate, 7)).length,
    };
  }, [doneIds, actions, bookings]);

  const queue = useMemo(() => {
    return scored.filter(({ action }) => {
      if (sevFilter !== 'ALL' && action.severity !== sevFilter.toLowerCase()) return false;
      const b = bookingById.get(action.bookingId);
      if (kpiFilter === 'critical' && action.severity !== 'critical') return false;
      if (kpiFilter === 'approvals' && action.state !== 'awaiting_approval') return false;
      if (kpiFilter === 'blocked' && !b?.missing.some((m) => m.blocking)) return false;
      if (kpiFilter === 'departures' && !(b && isSoon(b.departureDate, 7))) return false;
      return true;
    });
  }, [scored, sevFilter, kpiFilter, bookingById]);

  const selected = queue.find((q) => q.action.id === selectedActionId)
    ?? scored.find((q) => q.action.id === selectedActionId)
    ?? null;

  const selectAction = (a: OpsAction) => {
    setSelectedActionId(a.id);
    setDraft(a.draftBody);
    setStageAfterSend(a.stage);
  };

  const approveAndSend = () => {
    if (!selected) return;
    const currentId = selected.action.id;
    const next = queue.find((q) => q.action.id !== currentId);
    setDoneIds((prev) => [...prev, currentId]);
    toast.success('Sent · stage updated');
    if (next) selectAction(next.action);
    else {
      setSelectedActionId(null);
      setDraft('');
    }
  };

  const matchStageFilter = (b: OpsBooking) => {
    if (stageFilter === 'SOON') return isSoon(b.departureDate, 7);
    if (stageFilter === 'BLOCKED') return b.missing.some((m) => m.blocking);
    return true;
  };

  const filteredBookings = bookings.filter(matchStageFilter);
  const stageBookings = filteredBookings.filter((b) => b.stage === selectedStage);
  const maxStageCount = Math.max(1, ...STAGE_ORDER.map((s) => filteredBookings.filter((b) => b.stage === s).length));
  const blockedBookings = bookings
    .filter((b) => b.missing.some((m) => m.blocking))
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate));


  const now = new Date();
  const clock = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden"
      style={{ background: C.bg, color: C.text, fontFamily: UI }}
    >
      {/* TOP BAR */}
      <header className="flex h-[62px] shrink-0 items-center justify-between px-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full"
            style={{ background: `radial-gradient(circle at 30% 30%, ${C.accentLight}, ${C.accent} 70%)` }}
          />
          <div>
            <div style={{ fontFamily: MONO, fontWeight: 700, letterSpacing: '0.18em', fontSize: 14 }}>OPS WIZARD</div>
            <div style={{ fontSize: 11, color: C.muted }}>Your Tours Portugal · Operations Intelligence</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>{clock}</span>
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ fontFamily: MONO, fontSize: 10.5, color: C.success, background: 'rgba(15,157,107,0.08)', border: '1px solid rgba(15,157,107,0.3)' }}
          >
            <RefreshCw size={11} /> SYNCED
          </span>
        </div>
      </header>

      {/* KPI ROW */}
      <div className="grid shrink-0 grid-cols-4 gap-3 px-5 py-3">
        <KpiCard color={C.critical} value={kpis.critical} label="urgent actions" sub="Needs attention now"
          active={kpiFilter === 'critical'} onClick={() => setKpiFilter(kpiFilter === 'critical' ? null : 'critical')} />
        <KpiCard color={C.high} value={kpis.approvals} label="pending approvals" sub="Awaiting your review"
          active={kpiFilter === 'approvals'} onClick={() => setKpiFilter(kpiFilter === 'approvals' ? null : 'approvals')} />
        <KpiCard color="#ffd24a" value={kpis.blocked} label="blocked bookings" sub="Missing required info"
          active={kpiFilter === 'blocked'} onClick={() => setKpiFilter(kpiFilter === 'blocked' ? null : 'blocked')} />
        <KpiCard color={C.purple} value={kpis.departures} label="departures ≤7 days" sub="Require validation"
          active={kpiFilter === 'departures'} onClick={() => setKpiFilter(kpiFilter === 'departures' ? null : 'departures')} />
      </div>

      {/* MISSING INFO */}
      <div className="shrink-0 px-5 pb-3">
        <div style={panelStyle} className="overflow-hidden">
          <button
            onClick={() => setMissingOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
          >
            {missingOpen ? <ChevronDown size={14} style={{ color: C.muted }} /> : <ChevronRight size={14} style={{ color: C.muted }} />}
            <AlertTriangle size={13} style={{ color: C.critical }} />
            <Label style={{ color: C.text, fontWeight: 700, fontSize: 11.5 }}>MISSING INFO</Label>
            <span
              className="rounded-full px-1.5"
              style={{ fontFamily: MONO, fontSize: 10, color: C.critical, background: 'rgba(217,45,67,0.09)' }}
            >
              {blockedBookings.length}
            </span>
            <span className="ml-auto" style={{ fontSize: 11, color: C.muted }}>
              Suppliers · guide &amp; transport · client payments · final briefings
            </span>
          </button>

          {missingOpen && (
            <div className="max-h-[210px] overflow-y-auto" style={{ borderTop: `1px solid ${C.border}` }}>
              {blockedBookings.length === 0 ? (
                <div className="px-4 py-3" style={{ fontSize: 11.5, color: C.success, fontFamily: MONO }}>
                  NOTHING BLOCKING — every booking has its four pillars covered
                </div>
              ) : (
                blockedBookings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setView('pipeline'); setSelectedStage(b.stage); setExpandedBooking(b.id); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left"
                    style={{ borderTop: `1px solid ${C.soft}` }}
                  >
                    <span className="shrink-0" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.accentLight }}>{b.id}</span>
                    <span className="shrink-0" style={{ fontSize: 12, fontWeight: 600 }}>{b.clientName}</span>
                    <span className="shrink-0" style={{ fontSize: 11, color: C.muted }}>{STAGE_LABEL[b.stage]}</span>
                    <span className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
                      {b.missing.filter((m) => m.blocking).map((m) => (
                        <span
                          key={m.field}
                          className="rounded-[7px] px-2 py-0.5"
                          style={{
                            fontFamily: MONO, fontSize: 10, color: C.critical,
                            background: 'rgba(217,45,67,0.09)', border: '1px solid rgba(217,45,67,0.3)',
                          }}
                        >
                          {m.field}
                        </span>
                      ))}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>


      {/* BOARD CONTROL BAR */}
      <div className="flex shrink-0 items-center gap-2 px-5 pb-2">
        <Label style={{ color: C.text }}>Today’s board</Label>
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: C.muted }}>
          {openCount}/4 PANELS OPEN
        </span>
        <span
          title={isSeeded ? 'Ligado à base de dados operacional' : 'A usar dataset de arranque (ainda sem dados na BD)'}
          style={{
            fontFamily: MONO, fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
            color: isSeeded ? '#046c4e' : '#8a5300',
            background: isSeeded ? 'rgba(4,108,78,0.10)' : 'rgba(217,138,0,0.12)',
            border: `1.2px solid ${isSeeded ? 'rgba(4,108,78,0.35)' : 'rgba(217,138,0,0.35)'}`,
          }}
        >
          {isLoading ? 'A CARREGAR…' : isSeeded ? 'LIVE DB' : 'SEED DATA'}
        </span>
        <div className="ml-auto flex gap-1.5">
          {!isSeeded && !isLoading && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1 rounded-[7px] px-2.5 py-1"
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.text, background: '#fff', border: `1.5px solid ${C.border}` }}
            >
              {seeding ? 'A IMPORTAR…' : 'IMPORTAR PARA BD'}
            </button>
          )}
          <button
            onClick={() => setAllCards(true)}
            className="flex items-center gap-1 rounded-[7px] px-2.5 py-1"
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: '#fff', background: C.accent }}
          >
            <ChevronDown size={11} /> EXPAND ALL
          </button>
          <button
            onClick={() => setAllCards(false)}
            className="flex items-center gap-1 rounded-[7px] px-2.5 py-1"
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.text, background: '#fff', border: `1.5px solid ${C.border}` }}
          >
            <ChevronRight size={11} /> COLLAPSE ALL
          </button>
        </div>
      </div>

      {/* MAIN — horizontal board */}
      <main className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-5 pb-3">
        {/* CARD 1 — PRIORITY QUEUE */}
        {view === 'pipeline' && (
        <BoardCard
          id="queue"
          title="PRIORITY QUEUE"
          subtitle="Auto-ranked by deadline, severity and impact"
          count={queue.length}
          open={openCards.queue}
          onToggle={() => toggleCard('queue')}
          grow={1}
          headerRight={(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as SevFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setSevFilter(f)}
              className="rounded-[7px] px-2 py-1 transition-colors"
              style={{
                fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
                color: sevFilter === f ? '#fff' : C.text,
                background: sevFilter === f ? C.accent : '#fff',
                border: `1.5px solid ${sevFilter === f ? C.accent : C.border}`,
              }}
            >
              {f}
            </button>
          ))}
        >
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
            {queue.length === 0 ? (
              <div
                className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-[11px] p-6 text-center"
                style={{ border: `1.5px dashed ${C.border}` }}
              >
                <CheckCircle2 size={26} style={{ color: C.success }} />
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em' }}>
                  ALL CLEAR — no pending actions in this filter
                </div>
              </div>
            ) : (
              queue.map(({ action, score }, i) => (
                <QueueCard
                  key={action.id}
                  index={i + 1}
                  action={action}
                  score={score}
                  selected={selectedActionId === action.id}
                  onSelect={() => selectAction(action)}
                />
              ))
            )}
          </div>
        </BoardCard>
        )}



        {/* CARD 2 — PIPELINE / CALENDAR */}
        <BoardCard
          id="pipeline"
          title={view === 'pipeline' ? 'OPERATIONS PIPELINE' : 'RESERVAS CALENDAR'}
          subtitle={view === 'pipeline'
            ? '8 stages · click a stage to filter'
            : 'Departures by day · click an event for the lead card'}
          count={view === 'pipeline' ? filteredBookings.length : undefined}
          open={openCards.pipeline}
          onToggle={() => toggleCard('pipeline')}
          grow={view === 'calendar' ? 3 : 1.5}
          headerRight={([['pipeline', 'PIPELINE'], ['calendar', 'CALENDAR']] as const).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex items-center gap-1 rounded-[7px] px-2.5 py-1"
              style={{
                fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
                color: view === v ? '#fff' : C.text,
                background: view === v ? C.accent : '#fff',
                border: `1.5px solid ${view === v ? C.accent : C.border}`,
              }}
            >
              {v === 'calendar' ? <CalendarDays size={10} /> : <LayoutList size={10} />} {lbl}
            </button>
          ))}
        >
          {view === 'calendar' ? (
            <ReservasCalendar
              monthOffset={monthOffset}
              onShiftMonth={(d) => setMonthOffset((m) => m + d)}
              onPick={(b) => setPeek(b)}
              bookings={bookings}
            />
          ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Label style={{ marginRight: 4 }}>Filter</Label>
              {([['ALL', 'ALL'], ['SOON', '≤7 DAYS'], ['BLOCKED', 'BLOCKED']] as const).map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setStageFilter(v)}
                  className="rounded-[7px] px-2.5 py-1"
                  style={{
                    fontFamily: MONO, fontSize: 10,
                    color: stageFilter === v ? '#fff' : C.muted,
                    background: stageFilter === v ? C.accent : '#fff',
                    border: `1px solid ${stageFilter === v ? C.accent : C.border}`,
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {STAGE_ORDER.map((stage) => {
                const items = filteredBookings.filter((b) => b.stage === stage);

                const blocked = items.filter((b) => b.missing.some((m) => m.blocking)).length;
                const active = selectedStage === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => { setSelectedStage(stage); setExpandedBooking(null); }}
                    className="w-full rounded-[9px] px-3 py-2 text-left transition-colors"
                    style={{
                      background: active ? 'rgba(28,79,216,0.07)' : '#ffffff',
                      border: `1px solid ${active ? 'rgba(28,79,216,0.4)' : C.border}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 500 }}>{STAGE_LABEL[stage]}</span>
                      <span
                        className="rounded-full px-1.5"
                        style={{ fontFamily: MONO, fontSize: 10, color: C.accentLight, background: 'rgba(28,79,216,0.08)' }}
                      >
                        {items.length}
                      </span>
                      {blocked > 0 && (
                        <span className="ml-auto flex items-center gap-1" style={{ fontFamily: MONO, fontSize: 10, color: C.critical }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.critical }} />
                          {blocked} blocked
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 h-[3px] w-full rounded-full" style={{ background: 'rgba(10,37,64,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(items.length / maxStageCount) * 100}%`, background: active ? C.accentLight : C.accent }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <Label>BOOKINGS IN {STAGE_LABEL[selectedStage]}</Label>
              <div className="mt-2 space-y-1.5">
                {stageBookings.length === 0 && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>No bookings in this stage.</div>
                )}
                {stageBookings.map((b) => {
                  const open = expandedBooking === b.id;
                  return (
                    <div key={b.id} className="rounded-[9px]" style={{ border: `1px solid ${C.border}` }}>
                      <button
                        onClick={() => setExpandedBooking(open ? null : b.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                      >
                        {open ? <ChevronDown size={13} style={{ color: C.muted }} /> : <ChevronRight size={13} style={{ color: C.muted }} />}
                        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.accentLight }}>{b.id}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{b.clientName}</span>
                        <span className="truncate" style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>{b.product}</span>
                        <span className="ml-auto shrink-0" style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: C.muted }}>
                          {b.departureDate}
                        </span>
                        <span className="shrink-0" style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: C.muted }}>{b.pax} pax</span>
                        <span
                          className="shrink-0 rounded px-1.5"
                          style={{ fontFamily: MONO, fontSize: 10, color: C.accentLight, background: 'rgba(28,79,216,0.08)' }}
                        >
                          {b.language}
                        </span>
                      </button>
                      {open && (
                        <div className="space-y-2 px-3 pb-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                          <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
                            <Label style={{ marginRight: 2, color: C.text }}>Readiness {readinessPercent(b)}%</Label>
                            <PillarChips booking={b} />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {b.missing.length === 0 && (

                              <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.success }}>NOTHING MISSING</span>
                            )}
                            {b.missing.map((m) => (
                              <span
                                key={m.field}
                                className="rounded-[7px] px-2 py-0.5"
                                style={{
                                  fontFamily: MONO, fontSize: 10,
                                  color: m.blocking ? C.critical : C.high,
                                  background: m.blocking ? 'rgba(217,45,67,0.09)' : 'rgba(196,122,0,0.1)',
                                  border: `1px solid ${m.blocking ? 'rgba(217,45,67,0.3)' : 'rgba(196,122,0,0.3)'}`,
                                }}
                              >
                                {m.field}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {b.links.map((l) => (
                              <button
                                key={l.type + l.label}
                                onClick={() => openDeepLink(l.url)}
                                className="flex items-center gap-1 rounded-[7px] px-2 py-0.5"
                                style={{ fontFamily: MONO, fontSize: 10, color: C.text, border: `1px solid ${C.border}` }}
                              >
                                <ExternalLink size={9} /> {l.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}
        </BoardCard>

        {/* CARD 3 — REVIEW & APPROVE */}
        {view === 'pipeline' && (
        <BoardCard
          id="review"
          title="REVIEW & APPROVE"
          subtitle="Review the draft, then send"
          open={openCards.review}
          onToggle={() => toggleCard('review')}
          grow={1}
        >


          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center" style={{ fontSize: 12, color: C.muted }}>
              Select an action from the queue
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-[9px]"
                  style={{ background: 'rgba(28,79,216,0.1)', fontFamily: MONO, fontSize: 12, color: C.accentLight }}
                >
                  {initials(selected.action.recipient)}
                </div>
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{selected.action.recipient}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{STAGE_LABEL[selected.action.stage]}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[9px] p-2" style={{ border: `1px solid ${C.border}` }}>
                  <Label>Deadline</Label>
                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.high, marginTop: 2 }}>{selected.action.deadlineLabel}</div>
                </div>
                <div className="min-w-0 rounded-[9px] p-2" style={{ border: `1px solid ${C.border}` }}>
                  <Label>Subject</Label>
                  <div className="truncate" style={{ fontSize: 11.5, marginTop: 2 }}>{selected.action.draftSubject}</div>
                </div>
              </div>

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full resize-none rounded-[9px] p-2.5 outline-none"
                style={{
                  height: 180, fontFamily: MONO, fontSize: 11, lineHeight: 1.5,
                  background: '#fbfcfe', border: `1px solid ${C.border}`, color: C.text,
                }}
              />

              <div className="flex gap-2">
                <button
                  className="rounded-[8px] py-2"
                  style={{ flex: 1, fontFamily: MONO, fontSize: 10.5, color: C.text, border: `1px solid ${C.border}` }}
                  onClick={() => toast('Draft is editable above')}
                >
                  EDIT DRAFT
                </button>
                <button
                  className="rounded-[8px] py-2"
                  style={{ flex: 1.5, fontFamily: MONO, fontSize: 10.5, color: '#fff', background: C.accent, border: `1px solid ${C.accent}` }}
                  onClick={approveAndSend}
                >
                  APPROVE &amp; SEND
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-[8px] py-2"
                  style={{ fontFamily: MONO, fontSize: 10.5, color: C.text, border: `1px solid ${C.border}` }}
                  onClick={() => toast('Scheduled')}
                >
                  SCHEDULE
                </button>
                <button
                  className="flex-1 rounded-[8px] py-2"
                  style={{ fontFamily: MONO, fontSize: 10.5, color: C.critical, border: '1px solid rgba(217,45,67,0.35)' }}
                  onClick={() => toast('Draft rejected')}
                >
                  REJECT
                </button>
              </div>

              <div>
                <Label>Update stage after sending:</Label>
                <select
                  value={stageAfterSend}
                  onChange={(e) => setStageAfterSend(e.target.value as OpsStage)}
                  className="mt-1.5 w-full rounded-[8px] px-2 py-2 outline-none"
                  style={{ fontSize: 12, background: '#fbfcfe', border: `1px solid ${C.border}`, color: C.text }}
                >
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s} style={{ background: C.bg }}>{STAGE_LABEL[s]}</option>
                  ))}
                </select>
              </div>

              <div style={{ borderTop: `1px solid ${C.border}` }} className="pt-2.5">
                <Label>Open in</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selected.action.links.map((l) => (
                    <button
                      key={l.type + l.label}
                      onClick={() => openDeepLink(l.url)}
                      className="flex items-center gap-1 rounded-[7px] px-2 py-1"
                      style={{ fontFamily: MONO, fontSize: 10, color: C.text, border: `1px solid ${C.border}` }}
                    >
                      <ExternalLink size={9} /> {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </BoardCard>
        )}

        {/* CARD 4 — LIVE ACTIVITY */}
        {view === 'pipeline' && (
        <BoardCard
          id="activity"
          title="LIVE ACTIVITY"
          subtitle="Latest operational events"
          count={mockActivity.length}
          open={openCards.activity}
          onToggle={() => toggleCard('activity')}
          grow={0.8}
        >
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {mockActivity.map((ev, i) => {
              const Icon = ACTIVITY_ICON[ev.icon] ?? Clock;
              return (
                <div key={i} className="flex items-start gap-2 rounded-[9px] px-2.5 py-2" style={{ border: `1.5px solid ${C.border}` }}>
                  <Icon size={14} style={{ color: ev.color, flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0">
                    <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>
                      <span style={{ fontFamily: MONO, fontWeight: 800, color: C.accent, marginRight: 6 }}>{ev.time}</span>
                      {ev.label}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{ev.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </BoardCard>
        )}
      </main>

      {/* CALENDAR EVENT POP-UP */}
      {peek && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(4,24,44,0.45)' }}
          onClick={() => setPeek(null)}
        >
          <div
            className="w-full max-w-[520px] p-4"
            style={{ ...panelStyle, boxShadow: '0 24px 60px -20px rgba(4,24,44,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2.5">
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: C.accent }}>{peek.id}</span>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 15, fontWeight: 800 }}>{peek.clientName}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{peek.product}</div>
              </div>
              <button
                onClick={() => setPeek(null)}
                style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.muted }}
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                ['DEPARTURE', peek.departureDate],
                ['PAX', String(peek.pax)],
                ['LANG', peek.language],
                ['READY', `${readinessPercent(peek)}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[9px] px-2 py-1.5" style={{ border: `1.5px solid ${C.border}` }}>
                  <Label style={{ fontSize: 9.5 }}>{k}</Label>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Label>Stage</Label>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{STAGE_LABEL[peek.stage]}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <PillarChips booking={peek} />
            </div>

            {peek.missing.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {peek.missing.map((m) => (
                  <span
                    key={m.field}
                    className="rounded-[7px] px-2 py-0.5"
                    style={{
                      fontFamily: MONO, fontSize: 10, fontWeight: 800,
                      color: m.blocking ? '#a81026' : '#8a5600',
                      background: m.blocking ? 'rgba(217,45,67,0.16)' : 'rgba(196,122,0,0.18)',
                      border: `1px solid ${m.blocking ? 'rgba(217,45,67,0.55)' : 'rgba(196,122,0,0.55)'}`,
                    }}
                  >
                    {m.field}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => window.open(`/leads/${peek.id}`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 rounded-[8px] px-3 py-2"
                style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: '#fff', background: C.accent }}
              >
                <ExternalLink size={11} /> ABRIR DADOS GERAIS
              </button>
              <button
                onClick={() => { setView('pipeline'); setSelectedStage(peek.stage); setExpandedBooking(peek.id); setPeek(null); }}
                className="flex items-center gap-1.5 rounded-[8px] px-3 py-2"
                style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: C.text, border: `1.5px solid ${C.border}` }}
              >
                <LayoutList size={11} /> VER NO PIPELINE
              </button>
              {peek.links.map((l) => (
                <button
                  key={l.type + l.label}
                  onClick={() => openDeepLink(l.url)}
                  className="flex items-center gap-1 rounded-[8px] px-2.5 py-2"
                  style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.text, border: `1.5px solid ${C.border}` }}
                >
                  <ExternalLink size={10} /> {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}



      {/* BOTTOM BAR */}
      <footer className="relative flex h-[72px] shrink-0 items-center gap-4 px-5" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: C.success }} />
          <Label>Live activity</Label>
        </div>
        <div className="flex min-w-0 flex-1 gap-3 overflow-hidden">
          {mockActivity.slice(0, 4).map((ev, i) => {
            const Icon = ACTIVITY_ICON[ev.icon] ?? Clock;
            return (
              <div key={i} className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] px-2.5 py-1.5" style={{ border: `1px solid ${C.border}` }}>
                <Icon size={13} style={{ color: ev.color, flexShrink: 0 }} />
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 11.5 }}>
                    <span style={{ fontFamily: MONO, color: C.muted, marginRight: 6 }}>{ev.time}</span>
                    {ev.label}
                  </div>
                  <div className="truncate" style={{ fontSize: 10.5, color: C.muted }}>{ev.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setAskOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-2"
          style={{ fontFamily: MONO, fontSize: 10.5, color: '#fff', background: C.accent }}
        >
          <Sparkles size={12} /> ASK OPS
        </button>

        {askOpen && (
          <div className="absolute bottom-[76px] right-5 w-[320px] p-3" style={{ ...panelStyle, background: '#ffffff', boxShadow: '0 12px 30px -12px rgba(10,37,64,0.25)' }}>
            <Label style={{ color: C.text }}>Ask ops</Label>
            <input
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="What needs attention today?"
              className="mt-2 w-full rounded-[8px] px-2.5 py-2 outline-none"
              style={{ fontSize: 12, background: '#fbfcfe', border: `1px solid ${C.border}`, color: C.text }}
            />
            <div className="mt-2.5 rounded-[8px] p-2.5" style={{ background: 'rgba(28,79,216,0.06)', fontSize: 11.5, lineHeight: 1.5 }}>
              <CalendarClock size={12} style={{ color: C.accentLight, display: 'inline', marginRight: 6 }} />
              Focus on YT5041 first — supplier confirmation is blocking the technical briefing, and the departure is inside 7 days.
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

/* ── sub-components ───────────────────────────────────────────────────── */
function PillarChips({ booking }: { booking: OpsBooking }) {
  const st = pillarStatus(booking);
  return (
    <>
      {PILLARS.map((p) => {
        const t = PILLAR_TONE[st[p.key]];
        return (
          <span
            key={p.key}
            title={`${p.label} — ${t.word}`}
            className="flex items-center gap-1 rounded-[7px] px-2 py-0.5"
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 800,
              color: t.fg, background: t.bg, border: `1px solid ${t.border}`,
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: t.fg }} />
            {p.short}
          </span>
        );
      })}
    </>
  );
}

function KpiCard({ color, value, label, sub, active, onClick }: {
  color: string; value: number; label: string; sub: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[66px] items-center gap-3 rounded-[11px] px-3.5 text-left transition-colors"
      style={{
        background: active ? `${color}1f` : `${color}0d`,
        border: `1px solid ${active ? color : `${color}44`}`,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800, color }}>{value}</div>
      <div className="min-w-0">
        <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>{label}</div>
        <div className="truncate" style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{sub}</div>
      </div>
    </button>
  );
}

function QueueCard({ index, action, score, selected, onSelect }: {
  index: number; action: OpsAction; score: number; selected: boolean; onSelect: () => void;
}) {
  const sev = SEV_COLOR[action.severity];
  return (
    <div
      onClick={onSelect}
      className="cursor-pointer rounded-[9px] p-2.5"
      style={{
        background: selected ? 'rgba(28,79,216,0.06)' : '#ffffff',
        border: `1px solid ${selected ? 'rgba(28,79,216,0.45)' : C.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: C.muted }}>{String(index).padStart(2, '0')}</span>
        <span
          className="rounded px-1.5"
          style={{ fontFamily: MONO, fontSize: 9.5, color: sev, background: `${sev}1a`, border: `1px solid ${sev}55` }}
        >
          {action.severity.toUpperCase()}
        </span>
        <span className="ml-auto flex items-center gap-1 rounded px-1.5" style={{ fontFamily: MONO, fontSize: 9.5, color: C.high, background: 'rgba(196,122,0,0.1)' }}>
          <AlertTriangle size={9} /> {action.deadlineLabel}
        </span>
      </div>

      <div className="mt-1.5" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{action.title}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{action.subtitle}</div>

      <div className="mt-2 flex items-center gap-2" style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted }}>
        <span>{STAGE_LABEL[action.stage]}</span>
        <span>|</span>
        <span>{STATE_LABEL[action.state]}</span>
        <span className="ml-auto flex items-center gap-1" style={{ color: C.text }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEV_COLOR[action.severity] }} />
          {score.toFixed(1)}
        </span>
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="flex-1 rounded-[8px] py-1.5"
          style={{ fontFamily: MONO, fontSize: 9.5, color: '#fff', background: C.accent }}
        >
          {action.primaryLabel}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); const l = action.links[0]; if (l) openDeepLink(l.url); }}
          className="flex-1 rounded-[8px] py-1.5"
          style={{ fontFamily: MONO, fontSize: 9.5, color: C.text, border: `1px solid ${C.border}` }}
        >
          {action.secondaryLabel}
        </button>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(/[\s·]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

/* ── Reservas calendar (departures by day) ────────────────────────────── */
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function ReservasCalendar({ monthOffset, onShiftMonth, onPick, bookings }: {
  monthOffset: number;
  onShiftMonth: (delta: number) => void;
  onPick: (b: OpsBooking) => void;
  bookings: OpsBooking[];
}) {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<number, OpsBooking[]>();
  bookings.forEach((b) => {
    const d = new Date(b.departureDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = byDay.get(d.getDate()) ?? [];
      list.push(b);
      byDay.set(d.getDate(), list);
    }
  });

  const monthLabel = base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthCount = [...byDay.values()].reduce((n, l) => n + l.length, 0);
  const monthPax = [...byDay.values()].flat().reduce((n, b) => n + b.pax, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => onShiftMonth(-1)}
          className="rounded-[7px] p-1"
          style={{ border: `1px solid ${C.border}`, color: C.text }}
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={() => onShiftMonth(1)}
          className="rounded-[7px] p-1"
          style={{ border: `1px solid ${C.border}`, color: C.text }}
        >
          <ChevronRight size={13} />
        </button>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {monthLabel}
        </div>
        <div className="ml-auto" style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: C.muted }}>
          {monthCount} DEPARTURES · {monthPax} PAX
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, textAlign: 'center' }}>{d}</div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1 overflow-y-auto">
        {cells.map((day, i) => {
          const items = day ? byDay.get(day) ?? [] : [];
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div
              key={i}
              className="min-h-[68px] rounded-[9px] p-1.5"
              style={{
                background: day ? (isToday ? 'rgba(28,79,216,0.07)' : '#fff') : C.soft,
                border: `1px solid ${isToday ? 'rgba(28,79,216,0.4)' : C.border}`,
              }}
            >
              {day && (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: isToday ? C.accent : C.muted }}>
                    {String(day).padStart(2, '0')}
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.map((b) => {
                      const blocked = b.missing.some((m) => m.blocking);
                      const color = blocked ? C.critical : C.success;
                      return (
                        <button
                          key={b.id}
                          onClick={() => onPick(b)}
                          className="block w-full truncate rounded-[6px] px-1 py-0.5 text-left"
                          style={{
                            fontFamily: MONO, fontSize: 9,
                            color,
                            background: `${color}14`,
                            border: `1px solid ${color}44`,
                          }}
                          title={`${b.id} · ${b.clientName} · ${b.product} · ${b.pax} pax`}
                        >
                          {b.id} · {b.pax}p
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-3" style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted }}>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: C.success }} /> READY
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: C.critical }} /> BLOCKED
        </span>
      </div>
    </div>
  );
}
