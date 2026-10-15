import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

type Row = {
  id: string; session_key: string; source: string; surface: string | null; agent_label: string | null;
  actor_email: string | null; provider: string | null; model: string | null; lead_code: string | null;
  status: string; started_at: string; last_heartbeat_at: string | null; ended_at: string | null;
  calls: number | null; input_tokens: number | null; output_tokens: number | null; cost_usd: number | null;
  summary: string | null; meta: unknown; created_at: string; live_status: string; duration_s: number | null;
};

const SOURCES: Record<string, { label: string; v: string }> = {
  tcc_edge: { label: 'Funções TCC', v: '--src-tcc' },
  claude_mcp: { label: 'Claude no TCC (MCP)', v: '--src-mcp' },
  claude_scheduled: { label: 'Tarefas agendadas', v: '--src-scheduled' },
  claude_chrome: { label: 'Claude no Chrome', v: '--src-chrome' },
  claude_chat: { label: 'Chat Claude', v: '--src-chat' },
  claude_cowork: { label: 'Claude (sessões de trabalho)', v: '--src-cowork' },
  other: { label: 'Outros', v: '--src-other' },
};
const SRC_KEYS = Object.keys(SOURCES);
const srcOf = (s: string) => (SOURCES[s] ? s : 'other');
const col = (s: string) => `hsl(var(${SOURCES[srcOf(s)].v}))`;
const TZ = 'Europe/Lisbon';

// ---------- formatos ----------
const nf = new Intl.NumberFormat('pt-PT');
const nf1 = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 });
const fmtTok = (n: number) => n >= 1e6 ? `${nf1.format(n / 1e6)} M` : n >= 1e3 ? `${nf1.format(n / 1e3)} k` : nf.format(n);
const fmtUsd = (n: number) => `$ ${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: n < 1 ? 4 : 2 }).format(n)}`;
const fmtDur = (s: number) => {
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')}`;
};
const dayKey = (iso: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const fmtDT = (iso: string) => new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// ---------- período ----------
type Mode = 'day' | 'week' | 'month' | '30d' | 'range';
interface Filt { mode: Mode; anchor: string; from: string; to: string; source: string }
const LS = 'tcc.aiUsage.filters.v1';
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function periodOf(f: Filt): { from: Date; to: Date } {
  const a = parse(f.anchor);
  if (f.mode === 'day') return { from: a, to: a };
  if (f.mode === 'week') { const s = addDays(a, -((a.getDay() + 6) % 7)); return { from: s, to: addDays(s, 6) }; }
  if (f.mode === 'month') return { from: new Date(a.getFullYear(), a.getMonth(), 1), to: new Date(a.getFullYear(), a.getMonth() + 1, 0) };
  if (f.mode === '30d') { const t = new Date(); t.setHours(0, 0, 0, 0); return { from: addDays(t, -29), to: t }; }
  return { from: parse(f.from), to: parse(f.to) };
}
function shift(f: Filt, dir: number): Filt {
  const a = parse(f.anchor);
  const n = f.mode === 'day' ? addDays(a, dir) : f.mode === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1);
  return { ...f, anchor: ymd(n) };
}
// limites UTC aproximados do período em Lisboa (margem de 1 dia; filtra-se depois por dia de Lisboa)
const loadFilt = (): Filt => {
  const t = ymd(new Date());
  try { const v = JSON.parse(localStorage.getItem(LS) || ''); if (v?.mode) return v; } catch { /* default */ }
  return { mode: 'week', anchor: t, from: ymd(addDays(new Date(), -6)), to: t, source: 'all' };
};

type Metric = 'sessions' | 'calls' | 'tokens' | 'cost';
const METRICS: { k: Metric; l: string }[] = [{ k: 'sessions', l: 'Sessões' }, { k: 'calls', l: 'Chamadas' }, { k: 'tokens', l: 'Tokens' }, { k: 'cost', l: 'Custo' }];
const mval = (r: Row, m: Metric) => m === 'sessions' ? 1 : m === 'calls' ? (r.calls || 0) : m === 'tokens' ? (r.input_tokens || 0) + (r.output_tokens || 0) : Number(r.cost_usd || 0);
const mfmt = (n: number, m: Metric) => m === 'cost' ? fmtUsd(n) : m === 'tokens' ? fmtTok(n) : nf.format(n);

function StatusPill({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    ok: ['Concluída', 'bg-muted text-muted-foreground'],
    running: ['A correr', 'bg-success/15 text-success'],
    stale: ['Sem sinal', 'bg-warning/20 text-warning-foreground'],
    abandoned: ['Abandonada', 'bg-warning/20 text-warning-foreground'],
    error: ['Erro', 'bg-destructive/15 text-destructive'],
  };
  const [l, c] = map[s] || [s, 'bg-muted text-muted-foreground'];
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', c)}>{l}</span>;
}
const SrcTag = ({ s }: { s: string }) => (
  <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: col(s) }} />{SOURCES[srcOf(s)].label}
  </span>
);
const LeadBadge = ({ code }: { code: string }) => (
  <Link to={`/leads?search=${encodeURIComponent(code)}`} onClick={e => e.stopPropagation()}>
    <Badge variant="outline" className="font-mono text-[11px] hover:bg-accent">{code}</Badge>
  </Link>
);

export default function AdminAiUsagePage() {
  const [filt, setFilt] = useState<Filt>(loadFilt);
  const [rows, setRows] = useState<Row[]>([]);
  const [live, setLive] = useState<Row[]>([]);
  const [syncAt, setSyncAt] = useState<Date | null>(null);
  const [syncErr, setSyncErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<Metric>('sessions');
  const [sel, setSel] = useState<Row | null>(null);
  const [now, setNow] = useState(Date.now());
  const debounce = useRef<number>();

  useEffect(() => { localStorage.setItem(LS, JSON.stringify(filt)); }, [filt]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const period = useMemo(() => periodOf(filt), [filt]);
  const days = useMemo(() => { const out: string[] = []; for (let d = period.from; d <= period.to; d = addDays(d, 1)) out.push(ymd(d)); return out; }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const fromIso = addDays(period.from, -1).toISOString();
    const toIso = addDays(period.to, 2).toISOString();
    let q = (supabase.from as any)('v_ai_usage').select('*').gte('started_at', fromIso).lt('started_at', toIso).order('started_at', { ascending: false }).limit(5000);
    if (filt.source !== 'all') q = q.eq('source', filt.source);
    const liveQ = (supabase.from as any)('v_ai_usage').select('*').eq('status', 'running')
      .gte('last_heartbeat_at', new Date(Date.now() - 12 * 3600e3).toISOString()).order('started_at', { ascending: false }).limit(50);
    const [a, b] = await Promise.all([q, liveQ]);
    setLoading(false);
    if (a.error || b.error) { setSyncErr(true); return; }
    const set = new Set(days);
    setRows((a.data as Row[]).filter(r => set.has(dayKey(r.started_at))));
    setLive(b.data as Row[]);
    setSyncErr(false); setSyncAt(new Date());
  }, [period, filt.source, days]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = window.setInterval(() => void load(), 20_000);
    const vis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', vis);
    const ch = supabase.channel('ai-usage-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_usage_events' }, () => {
        window.clearTimeout(debounce.current);
        debounce.current = window.setTimeout(() => void load(), 2000);
      }).subscribe();
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); supabase.removeChannel(ch); window.clearTimeout(debounce.current); };
  }, [load]);

  // ---------- agregações ----------
  const k = useMemo(() => {
    let calls = 0, tin = 0, tout = 0, cost = 0, priced = 0, dur = 0, fails = 0;
    const leads = new Set<string>();
    for (const r of rows) {
      calls += r.calls || 0; tin += r.input_tokens || 0; tout += r.output_tokens || 0;
      if (r.cost_usd != null) { cost += Number(r.cost_usd); priced++; }
      dur += Number(r.duration_s || 0);
      if (r.lead_code) leads.add(r.lead_code);
      if (r.status === 'error' || r.status === 'abandoned') fails++;
    }
    return { sessions: rows.length, calls, perDay: calls / Math.max(1, days.length), tin, tout, cost, priced, dur, leads: leads.size, fails };
  }, [rows, days]);

  const presentSrc = useMemo(() => SRC_KEYS.filter(s => rows.some(r => srcOf(r.source) === s)), [rows]);
  const chartData = useMemo(() => days.map(d => {
    const o: Record<string, number | string> = { day: d, label: format(parse(d), days.length > 14 ? 'dd/MM' : 'EEE dd', { locale: pt }) };
    for (const s of presentSrc) o[s] = 0;
    for (const r of rows) if (dayKey(r.started_at) === d) o[srcOf(r.source)] = (o[srcOf(r.source)] as number) + mval(r, metric);
    return o;
  }), [days, rows, metric, presentSrc]);
  const chartCfg: ChartConfig = useMemo(() => Object.fromEntries(presentSrc.map(s => [s, { label: SOURCES[s].label, color: col(s) }])), [presentSrc]);

  const top = (keyFn: (r: Row) => string, n: number) => {
    const m = new Map<string, { v: number; bySrc: Map<string, number> }>();
    for (const r of rows) {
      const key = keyFn(r); const e = m.get(key) || { v: 0, bySrc: new Map() };
      const v = mval(r, metric); e.v += v; e.bySrc.set(srcOf(r.source), (e.bySrc.get(srcOf(r.source)) || 0) + v); m.set(key, e);
    }
    return [...m.entries()].map(([name, e]) => ({ name, v: e.v, src: [...e.bySrc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'other' }))
      .filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, n);
  };
  const bySurface = useMemo(() => top(r => r.surface || '—', 12), [rows, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const byModel = useMemo(() => top(r => r.model || (r.source.startsWith('claude_') ? 'Claude (plano)' : '—'), 10), [rows, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodLabel = filt.mode === 'day' ? format(period.from, "EEEE, d 'de' MMMM yyyy", { locale: pt })
    : filt.mode === 'month' ? format(period.from, 'MMMM yyyy', { locale: pt })
    : `${format(period.from, 'dd/MM/yyyy')} – ${format(period.to, 'dd/MM/yyyy')}`;
  const canStep = filt.mode === 'day' || filt.mode === 'week' || filt.mode === 'month';
  const noTokens = rows.length > 0 && k.tin + k.tout === 0 && k.cost === 0 && (metric === 'tokens' || metric === 'cost');

  const kpis = [
    { l: 'Sessões', v: nf.format(k.sessions) },
    { l: 'Chamadas AI', v: nf.format(k.calls), s: `${nf1.format(k.perDay)} / dia` },
    { l: 'Tokens', v: fmtTok(k.tin + k.tout), s: `${fmtTok(k.tin)} entrada · ${fmtTok(k.tout)} saída` },
    { l: 'Custo estimado', v: fmtUsd(k.cost), s: `${nf.format(k.priced)} registos com preço` },
    { l: 'Tempo de trabalho AI', v: fmtDur(k.dur) },
    { l: 'Files tocadas', v: nf.format(k.leads) },
    { l: 'Falhas', v: nf.format(k.fails), bad: k.fails > 0 },
  ];

  const HBars = ({ items }: { items: { name: string; v: number; src: string }[] }) => {
    const max = Math.max(1, ...items.map(i => i.v));
    if (!items.length) return <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>;
    return <div className="space-y-2">{items.map(i => (
      <div key={i.name} className="text-xs">
        <div className="flex justify-between gap-2 mb-0.5"><span className="truncate">{i.name}</span><span className="font-mono shrink-0">{mfmt(i.v, metric)}</span></div>
        <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full rounded" style={{ width: `${(i.v / max) * 100}%`, background: col(i.src) }} /></div>
      </div>))}</div>;
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
        {/* 1. Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Consumo AI</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="relative flex h-2 w-2">
                {!syncErr && <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />}
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', syncErr ? 'bg-destructive' : 'bg-success')} />
              </span>
              {syncErr ? 'Falha ao atualizar' : syncAt ? `Atualizado às ${format(syncAt, 'HH:mm:ss')}` : 'A carregar…'}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />Atualizar
          </Button>
        </div>

        {/* 2. Ao vivo */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-3">Sessões a correr agora <span className="text-3xl font-bold">{live.length}</span></CardTitle></CardHeader>
          <CardContent>
            {live.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma sessão a correr neste momento.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {live.map(r => {
                  const stale = r.live_status === 'stale';
                  const ago = r.last_heartbeat_at ? Math.round((now - new Date(r.last_heartbeat_at).getTime()) / 60000) : 0;
                  return (
                    <button key={r.id} onClick={() => setSel(r)} className="text-left rounded-lg border p-3 space-y-1.5 hover:bg-accent/40 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', stale ? 'bg-warning/20 text-warning-foreground' : 'bg-success/15 text-success')}>
                          {stale ? `Sem sinal há ${ago} min` : 'Ao vivo'}
                        </span>
                        <SrcTag s={r.source} />
                      </div>
                      <div className="font-medium text-sm">{r.surface || '—'}</div>
                      {r.summary && <div className="text-xs text-muted-foreground line-clamp-2">{r.summary}</div>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{fmtDur((now - new Date(r.started_at).getTime()) / 1000)}</span>
                        <span>{nf.format(r.calls || 0)} chamadas</span>
                        {(r.input_tokens || r.output_tokens) ? <span>{fmtTok((r.input_tokens || 0) + (r.output_tokens || 0))} tokens</span> : null}
                        {r.cost_usd != null && <span>{fmtUsd(Number(r.cost_usd))}</span>}
                        {r.model && <span>{r.model}</span>}
                        {r.lead_code && <LeadBadge code={r.lead_code} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Filtros */}
        <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              {([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['30d', '30 dias'], ['range', 'Intervalo']] as [Mode, string][]).map(([m, l]) => (
                <Button key={m} size="sm" variant={filt.mode === m ? 'secondary' : 'ghost'} className="h-7 px-2.5" onClick={() => setFilt({ ...filt, mode: m, anchor: m === filt.mode ? filt.anchor : ymd(new Date()) })}>{l}</Button>
              ))}
            </div>
            {canStep && <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFilt(shift(filt, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFilt(shift(filt, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </>}
            {filt.mode === 'range' && (['from', 'to'] as const).map(key => (
              <Popover key={key}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7"><CalendarIcon className="h-3.5 w-3.5 mr-1.5" />{format(parse(filt[key]), 'dd/MM/yyyy')}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={parse(filt[key])} onSelect={d => d && setFilt({ ...filt, [key]: ymd(d) })} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            ))}
            <span className="text-sm text-muted-foreground capitalize">{periodLabel}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['all', ...SRC_KEYS].map(s => (
              <button key={s} onClick={() => setFilt({ ...filt, source: s })}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs inline-flex items-center gap-1.5', filt.source === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}>
                {s !== 'all' && <span className="h-2 w-2 rounded-full" style={{ background: col(s) }} />}{s === 'all' ? 'Todas' : SOURCES[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {kpis.map(x => (
            <Card key={x.l}><CardContent className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className={cn('text-xl font-semibold mt-1', x.bad && 'text-destructive')}>{x.v}</div>
              {x.s && <div className="text-[11px] text-muted-foreground mt-0.5">{x.s}</div>}
            </CardContent></Card>
          ))}
        </div>

        {/* 5. Gráfico */}
        <Card>
          <CardHeader className="pb-2 flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm">Por dia e origem</CardTitle>
            <div className="inline-flex rounded-md border p-0.5">
              {METRICS.map(m => <Button key={m.k} size="sm" variant={metric === m.k ? 'secondary' : 'ghost'} className="h-7 px-2.5" onClick={() => setMetric(m.k)}>{m.l}</Button>)}
            </div>
          </CardHeader>
          <CardContent>
            {noTokens && <p className="text-xs text-muted-foreground mb-2">Só as funções do TCC instrumentadas trazem tokens e custo.</p>}
            <ChartContainer config={chartCfg} className="h-[260px] w-full aspect-auto">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={56} tickFormatter={v => mfmt(Number(v), metric)} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => (
                  <div className="flex w-full justify-between gap-3"><span className="text-muted-foreground">{SOURCES[String(name)]?.label}</span><span className="font-mono">{mfmt(Number(v), metric)}</span></div>
                )} />} />
                {presentSrc.map(s => <Bar key={s} dataKey={s} stackId="a" fill={`var(--color-${s})`} />)}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 6. Onde se gasta / Por modelo */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Onde se gasta</CardTitle></CardHeader><CardContent><HBars items={bySurface} /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Por modelo</CardTitle></CardHeader><CardContent><HBars items={byModel} /></CardContent></Card>
        </div>

        {/* 7. Atividade recente */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Atividade recente</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader><TableRow>
                {['Início', 'Origem', 'O quê', 'File', 'Chamadas', 'Tokens', 'Custo', 'Duração', 'Estado'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {rows.slice(0, 100).map(r => (
                  <TableRow key={r.id} className="cursor-pointer text-xs" onClick={() => setSel(r)}>
                    <TableCell className="whitespace-nowrap font-mono">{fmtDT(r.started_at)}</TableCell>
                    <TableCell><SrcTag s={r.source} /></TableCell>
                    <TableCell className="max-w-[320px]"><div className="font-medium truncate">{r.surface || '—'}</div>{r.summary && <div className="text-[11px] text-muted-foreground truncate">{r.summary}</div>}</TableCell>
                    <TableCell>{r.lead_code ? <LeadBadge code={r.lead_code} /> : '—'}</TableCell>
                    <TableCell>{nf.format(r.calls || 0)}</TableCell>
                    <TableCell>{(r.input_tokens || r.output_tokens) ? fmtTok((r.input_tokens || 0) + (r.output_tokens || 0)) : '—'}</TableCell>
                    <TableCell>{r.cost_usd != null ? fmtUsd(Number(r.cost_usd)) : '—'}</TableCell>
                    <TableCell>{r.duration_s != null ? fmtDur(Number(r.duration_s)) : '—'}</TableCell>
                    <TableCell><StatusPill s={r.live_status} /></TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Sem atividade no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 8. Rodapé */}
        <p className="text-xs text-muted-foreground">
          Tokens e custo existem para as chamadas AI das funções do TCC (desde 8 out 2026). As sessões Claude do plano (MCP, Chrome, chat, tarefas agendadas) contam sessões, chamadas e duração, mas não tokens. Custo estimado em USD pela tabela de preços de cada modelo. Uma sessão sem sinal há mais de 20 min passa a 'Sem sinal'.
        </p>
      </div>

      <Sheet open={!!sel} onOpenChange={o => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {sel && <>
            <SheetHeader><SheetTitle>{sel.surface || 'Sessão AI'}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><StatusPill s={sel.live_status} /><SrcTag s={sel.source} /></div>
              {sel.summary && <p className="text-muted-foreground">{sel.summary}</p>}
              {([
                ['Agente', sel.agent_label], ['Utilizador', sel.actor_email], ['Provider', sel.provider], ['Modelo', sel.model],
                ['File', sel.lead_code], ['Início', fmtDT(sel.started_at)], ['Último sinal', sel.last_heartbeat_at && fmtDT(sel.last_heartbeat_at)],
                ['Fim', sel.ended_at && fmtDT(sel.ended_at)], ['Duração', sel.duration_s != null ? fmtDur(Number(sel.duration_s)) : null],
                ['Chamadas', nf.format(sel.calls || 0)], ['Tokens entrada', nf.format(sel.input_tokens || 0)], ['Tokens saída', nf.format(sel.output_tokens || 0)],
                ['Custo', sel.cost_usd != null ? fmtUsd(Number(sel.cost_usd)) : null], ['Session key', sel.session_key],
              ] as [string, string | null][]).map(([l, v]) => (
                <div key={l} className="grid grid-cols-[120px_1fr] gap-2 text-xs"><span className="text-muted-foreground">{l}</span><span className="break-all font-mono">{v || '—'}</span></div>
              ))}
              <div className="pt-2"><div className="text-xs text-muted-foreground mb-1">meta</div>
                <pre className="text-[11px] bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(sel.meta ?? {}, null, 2)}</pre></div>
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
