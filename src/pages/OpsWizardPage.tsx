import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Clock, Euro, Plane, RefreshCw, ChevronDown, ChevronRight,
  ExternalLink, MessageSquare, CalendarDays, LayoutList, ChevronLeft, Loader2,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useOpsData, useOpsActivity } from '@/hooks/useOpsData';
import type { OpsAction, OpsBooking, OpsStage, Severity } from '@/types/ops';
import { priorityScore } from '@/lib/priority';
import { openDeepLink } from '@/lib/links';
import { PILLARS, PILLAR_TONE, pillarStatus, readinessPercent } from '@/lib/readiness';

/* ── tokens (YT light: white + blue) ─────────────────────────────────── */
const C = {
  panel: '#ffffff',
  border: 'rgba(28,79,216,0.24)',
  text: '#04182c',
  muted: 'rgba(4,24,44,0.72)',
  accent: '#0f3fb8',
  accentLight: '#1c4fd8',
  critical: '#b3122c',
  high: '#8a5600',
  medium: '#0f3fb8',
  success: '#0a6b4c',
  purple: '#4b32b0',
  soft: '#eef3fb',
};

const STAGE_ORDER: OpsStage[] = [
  'deposit_received', 'suppliers_confirmation', 'technical_briefing',
  'clients_final_briefing', 'in_execution', 'post_trip', 'deferred', 'archived',
];

const STAGE_LABEL: Record<OpsStage, string> = {
  deposit_received: 'Depósito / Pagamento recebido',
  suppliers_confirmation: 'Reservas & confirmações FSE',
  technical_briefing: 'Briefing técnico',
  clients_final_briefing: 'Briefing final ao cliente',
  in_execution: 'Em execução',
  post_trip: 'Pós-viagem',
  deferred: 'Adiada',
  archived: 'Arquivo',
};

const SEV_COLOR: Record<Severity, string> = { critical: C.critical, high: C.high, medium: C.medium };

const ACTIVITY_ICON: Record<string, any> = {
  euro: Euro, check: CheckCircle2, plane: Plane, clock: Clock, mail: MessageSquare,
};

type KpiFilter = null | 'critical' | 'approvals' | 'blocked' | 'departures';
type SevFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM';
type StageFilter = 'ALL' | 'SOON' | 'BLOCKED';

const DAY = 86400000;
const isSoon = (iso: string, days: number) => {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t - Date.now() <= days * DAY && t - Date.now() >= -DAY;
};

const panelStyle: React.CSSProperties = {
  background: C.panel,
  border: `1.5px solid ${C.border}`,
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(10,37,64,0.05), 0 12px 30px -22px rgba(10,37,64,0.25)',
};

const Label = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase', ...style }}>
    {children}
  </div>
);

/* ── vertical collapsible section ─────────────────────────────────────── */
function Section({
  title, subtitle, count, open, onToggle, headerRight, children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={panelStyle} className="overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: open ? `1.5px solid ${C.border}` : 'none', background: 'rgba(28,79,216,0.05)' }}
      >
        <button onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
          {open ? <ChevronDown size={18} style={{ color: C.accent }} /> : <ChevronRight size={18} style={{ color: C.accent }} />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</span>
              {typeof count === 'number' && (
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: C.accent }}>
                  {count}
                </span>
              )}
            </div>
            {subtitle && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
          </div>
        </button>
        {headerRight && <div className="flex flex-wrap items-center gap-2">{headerRight}</div>}
      </div>
      {open && <div>{children}</div>}
    </section>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */
export default function OpsWizardPage() {
  const navigate = useNavigate();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [sevFilter, setSevFilter] = useState<SevFilter>('ALL');
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [selectedStage, setSelectedStage] = useState<OpsStage>('deposit_received');
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [view, setView] = useState<'pipeline' | 'calendar'>('pipeline');
  const [monthOffset, setMonthOffset] = useState(0);
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [peek, setPeek] = useState<OpsBooking | null>(null);
  const [open, setOpen] = useState({ queue: true, blocked: true, pipeline: true, activity: false });

  const { bookings, actions, isLoading, refetch } = useOpsData();
  const activity = useOpsActivity();

  const toggle = (k: keyof typeof open) => setOpen((p) => ({ ...p, [k]: !p[k] }));

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
      approvals: live.filter((a) => a.state === 'awaiting_supplier').length,
      blocked: bookings.filter((b) => b.missing.some((m) => m.blocking)).length,
      departures: bookings.filter((b) => isSoon(b.departureDate, 7)).length,
    };
  }, [doneIds, actions, bookings]);

  const queue = useMemo(
    () =>
      scored.filter(({ action }) => {
        if (sevFilter !== 'ALL' && action.severity !== sevFilter.toLowerCase()) return false;
        const b = bookingById.get(action.bookingId);
        if (kpiFilter === 'critical' && action.severity !== 'critical') return false;
        if (kpiFilter === 'approvals' && action.state !== 'awaiting_supplier') return false;
        if (kpiFilter === 'blocked' && !b?.missing.some((m) => m.blocking)) return false;
        if (kpiFilter === 'departures' && !(b && isSoon(b.departureDate, 7))) return false;
        return true;
      }),
    [scored, sevFilter, kpiFilter, bookingById],
  );

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
    .sort((a, b) => (a.departureDate || '9999').localeCompare(b.departureDate || '9999'));

  const openLead = (id: string) => navigate(`/leads/${id}`);

  return (
    <AppLayout>
      <div className="space-y-4" style={{ color: C.text }}>
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: C.text }}>Ops Wizard</h1>
            <p style={{ fontSize: 13.5, color: C.muted }}>
              Pagamentos · Reservas FSE · Briefing FSE · Briefing cliente — sobre as leads reais
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12.5, color: C.muted }}>
              {isLoading ? 'A carregar…' : `${bookings.length} reservas ativas`}
            </span>
            <button
              onClick={() => { refetch(); activity.refetch(); }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: C.accent }}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard color={C.critical} value={kpis.critical} label="ações críticas" sub="Partida ≤ 3 dias"
            active={kpiFilter === 'critical'} onClick={() => setKpiFilter(kpiFilter === 'critical' ? null : 'critical')} />
          <KpiCard color={C.high} value={kpis.approvals} label="a aguardar fornecedor" sub="Confirmações pendentes"
            active={kpiFilter === 'approvals'} onClick={() => setKpiFilter(kpiFilter === 'approvals' ? null : 'approvals')} />
          <KpiCard color="#c47a00" value={kpis.blocked} label="reservas bloqueadas" sub="Falta informação crítica"
            active={kpiFilter === 'blocked'} onClick={() => setKpiFilter(kpiFilter === 'blocked' ? null : 'blocked')} />
          <KpiCard color={C.purple} value={kpis.departures} label="partidas ≤ 7 dias" sub="Requerem validação"
            active={kpiFilter === 'departures'} onClick={() => setKpiFilter(kpiFilter === 'departures' ? null : 'departures')} />
        </div>

        {/* ★ CALENDÁRIO OPS — centro da visão */}
        <Section
          title="Calendário Ops"
          subtitle="Partidas por dia — clique num evento para ver o que falta e abrir a lead"
          count={bookings.filter((b) => b.departureDate).length}
          open={open.calendar}
          onToggle={() => toggle('calendar')}
          headerRight={(['ALL', 'READY', 'MISSING'] as CalFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setCalFilter(f)}
              className="rounded-lg px-2.5 py-1.5"
              style={{
                fontSize: 11.5, fontWeight: 800,
                color: calFilter === f ? '#fff' : C.text,
                background: calFilter === f ? C.accent : '#fff',
                border: `1.5px solid ${calFilter === f ? C.accent : C.border}`,
              }}
            >
              {f === 'ALL' ? 'TODAS' : f === 'READY' ? 'READY TO GO' : 'EM FALTA'}
            </button>
          ))}
        >
          <ReservasCalendar
            monthOffset={monthOffset}
            onShiftMonth={(d) => setMonthOffset((m) => m + d)}
            onToday={() => setMonthOffset(0)}
            onPick={(b) => setPeek(b)}
            bookings={bookings}
            filter={calFilter}
          />
        </Section>

        {/* PIPELINE — uma linha de fases */}
        <Section
          title="Pipeline operacional"
          subtitle="Clique numa fase para filtrar as reservas"
          count={filteredBookings.length}
          open={open.pipeline}
          onToggle={() => toggle('pipeline')}
          headerRight={([['ALL', 'TODAS'], ['SOON', '≤7 DIAS'], ['BLOCKED', 'BLOQUEADAS']] as const).map(([v, lbl]) => (
            <button
              key={v}
              onClick={() => setStageFilter(v)}
              className="rounded-lg px-2.5 py-1.5"
              style={{
                fontSize: 11.5, fontWeight: 700,
                color: stageFilter === v ? '#fff' : C.muted,
                background: stageFilter === v ? C.accent : '#fff',
                border: `1.5px solid ${stageFilter === v ? C.accent : C.border}`,
              }}
            >
              {lbl}
            </button>
          ))}
        >
          <div className="p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STAGE_ORDER.map((stage) => {
                const items = filteredBookings.filter((b) => b.stage === stage);
                const blocked = items.filter((b) => b.missing.some((m) => m.blocking)).length;
                const active = selectedStage === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => { setSelectedStage(stage); setExpandedBooking(null); }}
                    className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2"
                    style={{
                      background: active ? 'rgba(28,79,216,0.07)' : '#fff',
                      border: `1.5px solid ${active ? 'rgba(28,79,216,0.4)' : C.border}`,
                    }}
                    title={STAGE_LABEL[stage]}
                  >
                    <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, whiteSpace: 'nowrap' }}>{STAGE_SHORT[stage]}</span>
                    <span className="rounded-full px-1.5" style={{ fontSize: 11.5, fontWeight: 800, color: C.accentLight, background: 'rgba(28,79,216,0.1)' }}>
                      {items.length}
                    </span>
                    {blocked > 0 && <span className="h-2 w-2 rounded-full" style={{ background: C.critical }} />}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <Label>Reservas em {STAGE_LABEL[selectedStage]}</Label>
              <div className="mt-2 space-y-2">
                {stageBookings.length === 0 && (
                  <div style={{ fontSize: 13, color: C.muted }}>Nenhuma reserva nesta fase.</div>
                )}
                {stageBookings.map((b) => {
                  const isOpen = expandedBooking === b.id;
                  return (
                    <div key={b.id} className="rounded-xl" style={{ border: `1.5px solid ${C.border}` }}>
                      <button
                        onClick={() => setExpandedBooking(isOpen ? null : b.id)}
                        className="flex w-full flex-wrap items-center gap-3 px-3.5 py-3 text-left"
                      >
                        {isOpen ? <ChevronDown size={16} style={{ color: C.muted }} /> : <ChevronRight size={16} style={{ color: C.muted }} />}
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.accentLight }}>{b.ref}</span>
                        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{b.clientName}</span>
                        <span className="truncate" style={{ fontSize: 13, color: C.muted }}>{b.product}</span>
                        <span className="ml-auto" style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>{b.departureDate || 'sem data'}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>{b.pax} pax</span>
                        <span className="rounded px-2" style={{ fontSize: 12, fontWeight: 800, color: C.accentLight, background: 'rgba(28,79,216,0.08)' }}>
                          {readinessPercent(b)}%
                        </span>
                      </button>
                      {isOpen && (
                        <div className="space-y-3 px-3.5 pb-3.5" style={{ borderTop: `1px solid ${C.border}` }}>
                          <div className="flex flex-wrap items-center gap-2 pt-3">
                            <PillarChips booking={b} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {b.missing.length === 0 && (
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.success }}>NADA EM FALTA</span>
                            )}
                            {b.missing.map((m) => (
                              <span
                                key={m.field}
                                className="rounded-lg px-2 py-0.5"
                                style={{
                                  fontSize: 11.5, fontWeight: 700,
                                  color: m.blocking ? C.critical : C.high,
                                  background: m.blocking ? 'rgba(217,45,67,0.09)' : 'rgba(196,122,0,0.1)',
                                  border: `1px solid ${m.blocking ? 'rgba(217,45,67,0.3)' : 'rgba(196,122,0,0.3)'}`,
                                }}
                              >
                                {m.field}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {b.links.map((l) => (
                              <button
                                key={l.type + l.label}
                                onClick={() => (l.url.startsWith('/') ? navigate(l.url) : openDeepLink(l.url))}
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                                style={{ fontSize: 12, fontWeight: 700, color: C.text, border: `1.5px solid ${C.border}` }}
                              >
                                <ExternalLink size={11} /> {l.label}
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
        </Section>

        {/* PRIORITY QUEUE */}
        <Section
          title="Fila de prioridade"
          subtitle="Ordenada por severidade, partida e impacto"
          count={queue.length}
          open={open.queue}
          onToggle={() => toggle('queue')}
          headerRight={(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as SevFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setSevFilter(f)}
              className="rounded-lg px-2.5 py-1.5"
              style={{
                fontSize: 11.5, fontWeight: 800,
                color: sevFilter === f ? '#fff' : C.text,
                background: sevFilter === f ? C.accent : '#fff',
                border: `1.5px solid ${sevFilter === f ? C.accent : C.border}`,
              }}
            >
              {f}
            </button>
          ))}
        >
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {isLoading && <div style={{ fontSize: 13, color: C.muted }}>A carregar ações…</div>}
            {!isLoading && queue.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-2 rounded-xl p-8 text-center" style={{ border: `1.5px dashed ${C.border}` }}>
                <CheckCircle2 size={28} style={{ color: C.success }} />
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.muted }}>Sem ações pendentes neste filtro</div>
              </div>
            )}
            {queue.slice(0, 60).map(({ action, score }, i) => (
              <QueueCard
                key={action.id}
                index={i + 1}
                action={action}
                score={score}
                booking={bookingById.get(action.bookingId)}
                onOpen={() => openLead(action.bookingId)}
                onDone={() => setDoneIds((p) => [...p, action.id])}
              />
            ))}
          </div>
        </Section>

        {/* BLOCKED / MISSING INFO */}
        <Section
          title="Informação em falta"
          subtitle="Fornecedores · guia & transporte · pagamentos · briefings"
          count={blockedBookings.length}
          open={open.blocked}
          onToggle={() => toggle('blocked')}
        >
          <div className="divide-y" style={{ borderColor: C.soft }}>
            {blockedBookings.length === 0 ? (
              <div className="px-4 py-4" style={{ fontSize: 13.5, color: C.success, fontWeight: 700 }}>
                Nada a bloquear — todas as reservas têm os quatro pilares cobertos
              </div>
            ) : (
              blockedBookings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => openLead(b.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-[rgba(28,79,216,0.04)]"
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.accentLight }}>{b.ref}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{b.clientName}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{STAGE_LABEL[b.stage]}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{b.departureDate || 'sem data'}</span>
                  <span className="ml-auto flex flex-wrap justify-end gap-1.5">
                    {b.missing.filter((m) => m.blocking).map((m) => (
                      <span
                        key={m.field}
                        className="rounded-lg px-2 py-0.5"
                        style={{ fontSize: 11.5, fontWeight: 700, color: C.critical, background: 'rgba(217,45,67,0.09)', border: '1px solid rgba(217,45,67,0.3)' }}
                      >
                        {m.field}
                      </span>
                    ))}
                  </span>
                </button>
              ))
            )}
          </div>
        </Section>

        {/* ACTIVITY */}
        <Section
          title="Atividade recente"
          subtitle="Registos internos e timeline do CRM"
          count={activity.data?.length}
          open={open.activity}
          onToggle={() => toggle('activity')}
        >
          <div className="grid gap-2 p-4 md:grid-cols-2">
            {activity.isLoading && <div style={{ fontSize: 13, color: C.muted }}>A carregar atividade…</div>}
            {!activity.isLoading && !activity.data?.length && (
              <div style={{ fontSize: 13, color: C.muted }}>Sem atividade registada.</div>
            )}
            {(activity.data ?? []).map((ev, i) => {
              const Icon = ACTIVITY_ICON[ev.icon] ?? Clock;
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ border: `1.5px solid ${C.border}` }}>
                  <Icon size={16} style={{ color: ev.color, flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0">
                    <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>
                      <span style={{ fontWeight: 800, color: C.accent, marginRight: 6 }}>{ev.time}</span>
                      {ev.label}
                    </div>
                    <div className="truncate" style={{ fontSize: 12.5, color: C.muted }}>{ev.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

      </div>

      {/* CALENDAR EVENT POP-UP */}
      {peek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(4,24,44,0.45)' }} onClick={() => setPeek(null)}>
          <div className="w-full max-w-[540px] p-4" style={{ ...panelStyle }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2.5">
              <span style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{peek.ref}</span>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 16, fontWeight: 800 }}>{peek.clientName}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{peek.product}</div>
              </div>
              <button onClick={() => setPeek(null)} style={{ fontSize: 13, fontWeight: 800, color: C.muted }}>✕</button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ['PARTIDA', peek.departureDate || '—'],
                ['PAX', String(peek.pax)],
                ['PRONTIDÃO', `${readinessPercent(peek)}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl px-2.5 py-2" style={{ border: `1.5px solid ${C.border}` }}>
                  <Label style={{ fontSize: 10.5 }}>{k}</Label>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Label>Fase</Label>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{STAGE_LABEL[peek.stage]}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2"><PillarChips booking={peek} /></div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => { const id = peek.id; setPeek(null); openLead(id); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2"
                style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', background: C.accent }}
              >
                <ExternalLink size={12} /> ABRIR LEAD
              </button>
              {peek.links.filter((l) => !l.url.startsWith('/')).map((l) => (
                <button
                  key={l.type + l.label}
                  onClick={() => openDeepLink(l.url)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-2"
                  style={{ fontSize: 12, fontWeight: 700, color: C.text, border: `1.5px solid ${C.border}` }}
                >
                  <ExternalLink size={11} /> {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
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
            className="flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{ fontSize: 11.5, fontWeight: 800, color: t.fg, background: t.bg, border: `1px solid ${t.border}` }}
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
      className="flex h-[86px] items-center gap-3 rounded-xl px-4 text-left transition-colors"
      style={{ background: active ? `${color}1f` : `${color}0d`, border: `1.5px solid ${active ? color : `${color}44`}` }}
    >
      <div style={{ fontSize: 34, fontWeight: 800, color }}>{value}</div>
      <div className="min-w-0">
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>{label}</div>
        <div className="truncate" style={{ fontSize: 12.5, color: C.muted }}>{sub}</div>
      </div>
    </button>
  );
}

function QueueCard({ index, action, score, booking, onOpen, onDone }: {
  index: number; action: OpsAction; score: number; booking?: OpsBooking; onOpen: () => void; onDone: () => void;
}) {
  const sev = SEV_COLOR[action.severity];
  return (
    <div className="rounded-xl p-3.5" style={{ background: '#fff', border: `1.5px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{String(index).padStart(2, '0')}</span>
        <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 800, color: sev, background: `${sev}1a`, border: `1px solid ${sev}55` }}>
          {action.severity.toUpperCase()}
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded px-2 py-0.5" style={{ fontSize: 11.5, fontWeight: 800, color: C.high, background: 'rgba(196,122,0,0.1)' }}>
          <AlertTriangle size={11} /> {action.deadlineLabel}
        </span>
      </div>

      <div className="mt-2" style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>{action.title}</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{action.subtitle}</div>

      {booking && (
        <div className="mt-2.5 flex flex-wrap gap-1.5"><PillarChips booking={booking} /></div>
      )}

      <div className="mt-3 flex items-center gap-2" style={{ fontSize: 12, color: C.muted }}>
        <span>{STAGE_LABEL[action.stage]}</span>
        <span className="ml-auto flex items-center gap-1.5" style={{ color: C.text, fontWeight: 800 }}>
          <span className="h-2 w-2 rounded-full" style={{ background: sev }} />
          {score.toFixed(1)}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={onOpen} className="flex-1 rounded-lg py-2" style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: C.accent }}>
          ABRIR LEAD
        </button>
        <button onClick={onDone} className="flex-1 rounded-lg py-2" style={{ fontSize: 12, fontWeight: 800, color: C.text, border: `1.5px solid ${C.border}` }}>
          RESOLVIDO
        </button>
      </div>
    </div>
  );
}

/* ── Reservas calendar (departures by day) ────────────────────────────── */
const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

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
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<number, OpsBooking[]>();
  bookings.forEach((b) => {
    if (!b.departureDate) return;
    const d = new Date(b.departureDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = byDay.get(d.getDate()) ?? [];
      list.push(b);
      byDay.set(d.getDate(), list);
    }
  });

  const monthLabel = base.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  const monthCount = [...byDay.values()].reduce((n, l) => n + l.length, 0);
  const monthPax = [...byDay.values()].flat().reduce((n, b) => n + b.pax, 0);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => onShiftMonth(-1)} className="rounded-lg p-1.5" style={{ border: `1.5px solid ${C.border}`, color: C.text }}>
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => onShiftMonth(1)} className="rounded-lg p-1.5" style={{ border: `1.5px solid ${C.border}`, color: C.text }}>
          <ChevronRight size={16} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 800, textTransform: 'capitalize' }}>{monthLabel}</div>
        <div className="ml-auto" style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>
          {monthCount} partidas · {monthPax} pax
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 pb-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textAlign: 'center' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          const items = day ? byDay.get(day) ?? [] : [];
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div
              key={i}
              className="min-h-[104px] rounded-xl p-2"
              style={{
                background: day ? (isToday ? 'rgba(28,79,216,0.07)' : '#fff') : C.soft,
                border: `1.5px solid ${isToday ? 'rgba(28,79,216,0.4)' : C.border}`,
              }}
            >
              {day && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? C.accent : C.muted }}>
                    {String(day).padStart(2, '0')}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {items.map((b) => {
                      const blocked = b.missing.some((m) => m.blocking);
                      const color = blocked ? C.critical : C.success;
                      return (
                        <button
                          key={b.id}
                          onClick={() => onPick(b)}
                          className="block w-full truncate rounded-lg px-1.5 py-1 text-left"
                          style={{ fontSize: 11, fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}44` }}
                          title={`${b.ref} · ${b.clientName} · ${b.product} · ${b.pax} pax`}
                        >
                          {b.ref} · {b.pax}p
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

      <div className="mt-3 flex items-center gap-4" style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.success }} /> PRONTA</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.critical }} /> BLOQUEADA</span>
      </div>
    </div>
  );
}
