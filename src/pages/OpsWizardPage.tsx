import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Euro, Plane, Sparkles, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink, CalendarClock, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { mockBookings, mockActions, mockActivity } from '@/data/mockOps';
import type { ActionState, OpsAction, OpsBooking, OpsStage, Severity } from '@/types/ops';
import { priorityScore } from '@/lib/priority';
import { openDeepLink } from '@/lib/links';

/* ── tokens ───────────────────────────────────────────────────────────── */
const C = {
  bg: '#04070f',
  panel: 'rgba(255,255,255,0.015)',
  border: 'rgba(91,155,255,0.12)',
  text: '#dfe8f8',
  muted: 'rgba(223,232,248,0.5)',
  accent: '#1c4fd8',
  accentLight: '#5b9bff',
  critical: '#ff4d5e',
  high: '#ffab2e',
  medium: '#5b9bff',
  success: '#2ee6a8',
  purple: '#b79dff',
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

const DAY = 86400000;
const isSoon = (iso: string, days: number) => {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t - Date.now() <= days * DAY;
};

const panelStyle: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
};

const Label = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.13em', color: C.muted, textTransform: 'uppercase', ...style }}>
    {children}
  </div>
);

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

  const bookingById = useMemo(() => {
    const m = new Map<string, OpsBooking>();
    mockBookings.forEach((b) => m.set(b.id, b));
    return m;
  }, []);

  const scored = useMemo(
    () =>
      mockActions
        .filter((a) => !doneIds.includes(a.id) && a.state !== 'done')
        .map((a) => ({ action: a, score: priorityScore(a, bookingById.get(a.bookingId) as OpsBooking) }))
        .sort((x, y) => y.score - x.score || x.action.deadlineISO.localeCompare(y.action.deadlineISO)),
    [doneIds, bookingById],
  );

  const kpis = useMemo(() => {
    const live = mockActions.filter((a) => !doneIds.includes(a.id) && a.state !== 'done');
    return {
      critical: live.filter((a) => a.severity === 'critical').length,
      approvals: live.filter((a) => a.state === 'awaiting_approval').length,
      blocked: mockBookings.filter((b) => b.missing.some((m) => m.blocking)).length,
      departures: mockBookings.filter((b) => isSoon(b.departureDate, 7)).length,
    };
  }, [doneIds]);

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

  const stageBookings = mockBookings.filter((b) => b.stage === selectedStage);
  const maxStageCount = Math.max(1, ...STAGE_ORDER.map((s) => mockBookings.filter((b) => b.stage === s).length));

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
            style={{ fontFamily: MONO, fontSize: 10.5, color: C.success, background: 'rgba(46,230,168,0.08)', border: '1px solid rgba(46,230,168,0.25)' }}
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

      {/* MAIN */}
      <main className="flex min-h-0 flex-1 gap-3 px-5 pb-3">
        {/* COL 1 — PRIORITY QUEUE */}
        <section className="flex w-[380px] shrink-0 flex-col overflow-hidden" style={panelStyle}>
          <div className="px-4 pt-3.5 pb-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
            <Label style={{ color: C.text, fontWeight: 700, fontSize: 11.5 }}>PRIORITY QUEUE</Label>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Auto-ranked by deadline, severity and impact</div>
            <div className="mt-2.5 flex gap-1.5">
              {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as SevFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setSevFilter(f)}
                  className="rounded-[7px] px-2.5 py-1 transition-colors"
                  style={{
                    fontFamily: MONO, fontSize: 10,
                    color: sevFilter === f ? '#fff' : C.muted,
                    background: sevFilter === f ? C.accent : 'transparent',
                    border: `1px solid ${sevFilter === f ? C.accent : C.border}`,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
            {queue.length === 0 ? (
              <div
                className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-[11px] p-6 text-center"
                style={{ border: `1px dashed ${C.border}` }}
              >
                <CheckCircle2 size={26} style={{ color: C.success }} />
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: '0.08em' }}>
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
        </section>

        {/* COL 2 — PIPELINE */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden" style={panelStyle}>
          <div className="px-4 pt-3.5 pb-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
            <Label style={{ color: C.text, fontWeight: 700, fontSize: 11.5 }}>OPERATIONS PIPELINE</Label>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>8 stages · click a stage to filter</div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="space-y-1.5">
              {STAGE_ORDER.map((stage) => {
                const items = mockBookings.filter((b) => b.stage === stage);
                const blocked = items.filter((b) => b.missing.some((m) => m.blocking)).length;
                const active = selectedStage === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => { setSelectedStage(stage); setExpandedBooking(null); }}
                    className="w-full rounded-[9px] px-3 py-2 text-left transition-colors"
                    style={{
                      background: active ? 'rgba(28,79,216,0.16)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(91,155,255,0.35)' : C.border}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 500 }}>{STAGE_LABEL[stage]}</span>
                      <span
                        className="rounded-full px-1.5"
                        style={{ fontFamily: MONO, fontSize: 10, color: C.accentLight, background: 'rgba(91,155,255,0.1)' }}
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
                    <div className="mt-1.5 h-[3px] w-full rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
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
                  <div style={{ fontSize: 11.5, color: C.muted }}>No bookings in this stage.</div>
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
                        <span style={{ fontFamily: MONO, fontSize: 11, color: C.accentLight }}>{b.id}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.clientName}</span>
                        <span className="truncate" style={{ fontSize: 11.5, color: C.muted }}>{b.product}</span>
                        <span className="ml-auto shrink-0" style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>
                          {b.departureDate}
                        </span>
                        <span className="shrink-0" style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>{b.pax} pax</span>
                        <span
                          className="shrink-0 rounded px-1.5"
                          style={{ fontFamily: MONO, fontSize: 10, color: C.accentLight, background: 'rgba(91,155,255,0.1)' }}
                        >
                          {b.language}
                        </span>
                      </button>
                      {open && (
                        <div className="space-y-2 px-3 pb-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                          <div className="flex flex-wrap gap-1.5 pt-2.5">
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
                                  background: m.blocking ? 'rgba(255,77,94,0.1)' : 'rgba(255,171,46,0.1)',
                                  border: `1px solid ${m.blocking ? 'rgba(255,77,94,0.3)' : 'rgba(255,171,46,0.3)'}`,
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
        </section>

        {/* COL 3 — REVIEW & APPROVE */}
        <section className="flex w-[400px] shrink-0 flex-col overflow-hidden" style={panelStyle}>
          <div className="px-4 pt-3.5 pb-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
            <Label style={{ color: C.text, fontWeight: 700, fontSize: 11.5 }}>REVIEW &amp; APPROVE</Label>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Review the draft, then send</div>
          </div>

          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center" style={{ fontSize: 12, color: C.muted }}>
              Select an action from the queue
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-[9px]"
                  style={{ background: 'rgba(28,79,216,0.25)', fontFamily: MONO, fontSize: 12, color: C.accentLight }}
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
                  background: 'rgba(0,0,0,0.35)', border: `1px solid ${C.border}`, color: C.text,
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
                  style={{ fontFamily: MONO, fontSize: 10.5, color: C.critical, border: '1px solid rgba(255,77,94,0.35)' }}
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
                  style={{ fontSize: 12, background: 'rgba(0,0,0,0.35)', border: `1px solid ${C.border}`, color: C.text }}
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
        </section>
      </main>

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
          <div className="absolute bottom-[76px] right-5 w-[320px] p-3" style={{ ...panelStyle, background: '#070c17' }}>
            <Label style={{ color: C.text }}>Ask ops</Label>
            <input
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="What needs attention today?"
              className="mt-2 w-full rounded-[8px] px-2.5 py-2 outline-none"
              style={{ fontSize: 12, background: 'rgba(0,0,0,0.35)', border: `1px solid ${C.border}`, color: C.text }}
            />
            <div className="mt-2.5 rounded-[8px] p-2.5" style={{ background: 'rgba(28,79,216,0.12)', fontSize: 11.5, lineHeight: 1.5 }}>
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
function KpiCard({ color, value, label, sub, active, onClick }: {
  color: string; value: number; label: string; sub: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[66px] items-center gap-3 rounded-[11px] px-3.5 text-left transition-colors"
      style={{
        background: active ? `${color}22` : `${color}0f`,
        border: `1px solid ${active ? color : `${color}44`}`,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div className="min-w-0">
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>{label}</div>
        <div className="truncate" style={{ fontSize: 11, color: C.muted }}>{sub}</div>
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
        background: selected ? 'rgba(28,79,216,0.14)' : 'rgba(255,255,255,0.015)',
        border: `1px solid ${selected ? 'rgba(91,155,255,0.4)' : C.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>{String(index).padStart(2, '0')}</span>
        <span
          className="rounded px-1.5"
          style={{ fontFamily: MONO, fontSize: 9.5, color: sev, background: `${sev}1a`, border: `1px solid ${sev}55` }}
        >
          {action.severity.toUpperCase()}
        </span>
        <span className="ml-auto flex items-center gap-1 rounded px-1.5" style={{ fontFamily: MONO, fontSize: 9.5, color: C.high, background: 'rgba(255,171,46,0.1)' }}>
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
