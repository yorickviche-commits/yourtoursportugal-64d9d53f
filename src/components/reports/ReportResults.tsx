import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronDown, ChevronRight, Download, ExternalLink, Info, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  formatDelta, formatGroupKey, formatValue, rawValue, downloadCsv,
} from '@/lib/reports/format';
import { runReport } from '@/lib/reports/runReport';
import type {
  DetailResult, ReportDefinition, RunReportResult, SummaryResult, SummaryRow,
} from '@/types/reports';

interface Props {
  result: RunReportResult | null;
  error: string | null;
  running: boolean;
  definition: ReportDefinition;
  reportName: string;
  onDrillDown?: (def: ReportDefinition) => void;
}

const keyOf = (keys: (string | null)[], level: number) => keys.slice(0, level).map(k => k ?? '∅').join('||');

export default function ReportResults({ result, error, running, definition, reportName }: Props) {
  if (running) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="text-xs whitespace-pre-wrap">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return (
      <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground">
        Escolha as definições e prima <span className="font-medium text-foreground">Gerar</span>.
      </div>
    );
  }

  return result.mode === 'summary'
    ? <SummaryView result={result} definition={definition} reportName={reportName} />
    : <DetailView result={result} reportName={reportName} />;
}

/* ------------------------------------------------------------------ Resumo */

function SummaryView({ result, definition, reportName }: { result: SummaryResult; definition: ReportDefinition; reportName: string }) {
  const groupKeys = result.group_keys || [];
  const columns = result.columns || [];
  const compare = !!result.prior_rows;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [drill, setDrill] = useState<{ title: string; def: ReportDefinition } | null>(null);

  const priorIndex = useMemo(() => {
    const map = new Map<string, SummaryRow>();
    (result.prior_rows || []).forEach(r => map.set(`${r.level}::${keyOf(r.keys, r.level)}`, r));
    return map;
  }, [result.prior_rows]);

  // Árvore: linhas por (nível, pai)
  const byParent = useMemo(() => {
    const map = new Map<string, SummaryRow[]>();
    (result.rows || []).forEach(r => {
      const parent = `${r.level - 1}::${keyOf(r.keys, r.level - 1)}`;
      const arr = map.get(parent) || [];
      arr.push(r);
      map.set(parent, arr);
    });
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      map.forEach(arr => arr.sort((a, b) => {
        const av = Number(a.values[sortKey] ?? 0), bv = Number(b.values[sortKey] ?? 0);
        return (av - bv) * dir;
      }));
    }
    return map;
  }, [result.rows, sortKey, sortDir]);

  const flat = useMemo(() => {
    const out: SummaryRow[] = [];
    const walk = (parentKey: string) => {
      (byParent.get(parentKey) || []).forEach(r => {
        out.push(r);
        const own = `${r.level}::${keyOf(r.keys, r.level)}`;
        if (!collapsed.has(own)) walk(own);
      });
    };
    walk('0::');
    return out;
  }, [byParent, collapsed]);

  const toggle = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sortBy = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const buildDetailDefinition = (row: SummaryRow): ReportDefinition => {
    const filters = definition.filters.slice();
    let from = result.period.from;
    let to = result.period.to;
    row.keys.slice(0, row.level).forEach((val, i) => {
      const gk = groupKeys[i];
      if (!gk) return;
      if (gk.bucket) {
        const r = bucketRange(String(val ?? ''), gk.bucket);
        if (r) { from = r.from; to = r.to; }
        return;
      }
      if (val === null) filters.push({ field: gk.key, op: 'is_null' });
      else filters.push({ field: gk.key, op: 'eq', values: [val] });
    });
    return {
      ...definition,
      mode: 'detail',
      filters,
      group_by: [],
      date: { ...definition.date, preset: 'custom', from, to },
      page: 1,
      page_size: 100,
    };
  };

  const exportCsv = () => {
    const header = [...groupKeys.map(g => g.label), ...columns.flatMap(c => compare ? [c.label, `${c.label} (ano anterior)`, `${c.label} Δ %`] : [c.label])];
    const rows = flat.map(r => {
      const prior = priorIndex.get(`${r.level}::${keyOf(r.keys, r.level)}`);
      const keyCells = groupKeys.map((_, i) => (i < r.level ? (r.keys[i] ?? '') : ''));
      const valCells = columns.flatMap(c => {
        const cur = rawValue(r.values[c.key], c.format);
        if (!compare) return [cur];
        return [cur, rawValue(prior?.values[c.key], c.format), formatDelta(r.values[c.key], prior?.values[c.key]).text];
      });
      return [...keyCells.map(String), ...valCells];
    });
    const totalRow = [
      'Totais', ...groupKeys.slice(1).map(() => ''),
      ...columns.flatMap(c => compare
        ? [rawValue(result.total[c.key], c.format), rawValue(result.prior_total?.[c.key], c.format), formatDelta(result.total[c.key], result.prior_total?.[c.key]).text]
        : [rawValue(result.total[c.key], c.format)]),
    ];
    downloadCsv(
      `${slug(reportName)}_${result.period.from || 'inicio'}_${result.period.to || 'fim'}.csv`,
      header, [...rows, totalRow]
    );
  };

  if (!result.rows?.length) {
    return (
      <div className="space-y-2">
        <Notices result={result} />
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground">
          Sem dados para este período e filtros
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Notices result={result} />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {result.row_count} linhas · {result.period.from || '—'} → {result.period.to || '—'}
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportCsv}>
          <Download className="h-3 w-3 mr-1" /> CSV
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto bg-card">
        <Table className="text-xs tabular-nums">
          <TableHeader>
            <TableRow>
              {groupKeys.map(g => (
                <TableHead key={g.key} className="text-[10px] uppercase whitespace-nowrap">{g.label}</TableHead>
              ))}
              {columns.map(c => (
                <TableHead
                  key={c.key}
                  className="text-[10px] uppercase text-right whitespace-nowrap cursor-pointer select-none"
                  onClick={() => sortBy(c.key)}
                  title={c.group}
                >
                  {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </TableHead>
              ))}
              {compare && columns.map(c => (
                <TableHead key={`p-${c.key}`} className="text-[10px] uppercase text-right whitespace-nowrap">
                  {c.label} · ano anterior
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {flat.map((r, idx) => {
              const id = `${r.level}::${keyOf(r.keys, r.level)}`;
              const hasChildren = byParent.has(id);
              const isDeepest = r.level === groupKeys.length;
              const prior = priorIndex.get(id);
              return (
                <TableRow key={`${id}-${idx}`} className={cn(r.level === 1 && groupKeys.length > 1 && 'bg-muted/40 font-medium')}>
                  {groupKeys.map((_, i) => (
                    <TableCell key={i} className="whitespace-nowrap">
                      {i === r.level - 1 ? (
                        <span className="flex items-center gap-1" style={{ paddingLeft: (r.level - 1) * 8 }}>
                          {hasChildren ? (
                            <button onClick={() => toggle(id)} className="text-muted-foreground">
                              {collapsed.has(id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          ) : <span className="w-3" />}
                          {formatGroupKey(r.keys[i])}
                        </span>
                      ) : null}
                    </TableCell>
                  ))}
                  {columns.map(c => (
                    <TableCell key={c.key} className="text-right whitespace-nowrap">{formatValue(r.values[c.key], c.format)}</TableCell>
                  ))}
                  {compare && columns.map(c => {
                    const d = formatDelta(r.values[c.key], prior?.values[c.key]);
                    return (
                      <TableCell key={`p-${c.key}`} className="text-right whitespace-nowrap">
                        {formatValue(prior?.values[c.key] ?? null, c.format)}
                        <span className={cn('ml-1', d.tone === 'up' && 'text-[hsl(var(--success))]', d.tone === 'down' && 'text-destructive')}>
                          {d.text}
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell className="whitespace-nowrap">
                    {isDeepest && (
                      <button
                        className="text-[10px] text-primary inline-flex items-center gap-1"
                        onClick={() => setDrill({
                          title: r.keys.slice(0, r.level).map(k => formatGroupKey(k)).join(' · '),
                          def: buildDetailDefinition(r),
                        })}
                      >
                        <Search className="h-3 w-3" /> Ver detalhe
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted font-semibold sticky bottom-0">
              <TableCell className="whitespace-nowrap" colSpan={Math.max(1, groupKeys.length)}>
                Totais · {result.row_count} itens
              </TableCell>
              {columns.map(c => (
                <TableCell key={c.key} className="text-right whitespace-nowrap">{formatValue(result.total[c.key], c.format)}</TableCell>
              ))}
              {compare && columns.map(c => {
                const d = formatDelta(result.total[c.key], result.prior_total?.[c.key]);
                return (
                  <TableCell key={`pt-${c.key}`} className="text-right whitespace-nowrap">
                    {formatValue(result.prior_total?.[c.key] ?? null, c.format)}
                    <span className={cn('ml-1', d.tone === 'up' && 'text-[hsl(var(--success))]', d.tone === 'down' && 'text-destructive')}>{d.text}</span>
                  </TableCell>
                );
              })}
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <DrillSheet drill={drill} onClose={() => setDrill(null)} reportName={reportName} />
    </div>
  );
}

function bucketRange(value: string, bucket: string): { from: string; to: string } | null {
  const v = String(value);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = v.slice(0, 10);
    if (bucket === 'day') return { from: d, to: d };
    if (bucket === 'week') {
      const s = new Date(d); const e = new Date(s); e.setDate(e.getDate() + 6);
      return { from: iso(s), to: iso(e) };
    }
    if (bucket === 'month') {
      const s = new Date(d); const y = s.getUTCFullYear(); const m = s.getUTCMonth();
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
    }
    if (bucket === 'quarter') {
      const s = new Date(d); const y = s.getUTCFullYear(); const q = Math.floor(s.getUTCMonth() / 3);
      return { from: iso(new Date(Date.UTC(y, q * 3, 1))), to: iso(new Date(Date.UTC(y, q * 3 + 3, 0))) };
    }
    if (bucket === 'year') {
      const y = new Date(d).getUTCFullYear();
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
  }
  if (/^\d{4}-\d{2}$/.test(v)) {
    const [y, m] = v.split('-').map(Number);
    return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  }
  if (/^\d{4}$/.test(v)) return { from: `${v}-01-01`, to: `${v}-12-31` };
  return null;
}

/* ----------------------------------------------------------------- Detalhe */

function DetailView({ result, reportName }: { result: DetailResult; reportName: string }) {
  const columns = result.columns || [];

  const exportCsv = () => {
    downloadCsv(
      `${slug(reportName)}_${result.period.from || 'inicio'}_${result.period.to || 'fim'}.csv`,
      columns.map(c => c.label),
      (result.rows || []).map(r => columns.map(c => rawValue(r[c.key], c.format)))
    );
  };

  if (!result.rows?.length) {
    return (
      <div className="space-y-2">
        <Notices result={result} />
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground">
          Sem dados para este período e filtros
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Notices result={result} />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {result.row_count} linhas · página {result.page}
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportCsv}>
          <Download className="h-3 w-3 mr-1" /> CSV
        </Button>
      </div>
      <DetailTable columns={columns} rows={result.rows} />
    </div>
  );
}

function DetailTable({ columns, rows }: { columns: DetailResult['columns']; rows: Record<string, any>[] }) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto bg-card">
      <Table className="text-xs tabular-nums">
        <TableHeader>
          <TableRow>
            {columns.map(c => (
              <TableHead key={c.key} className={cn('text-[10px] uppercase whitespace-nowrap', c.kind === 'metric' && 'text-right')} title={c.group}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.lead_id || i}>
              {columns.map(c => (
                <TableCell key={c.key} className={cn('whitespace-nowrap', c.kind === 'metric' && 'text-right')}>
                  <DetailCell colKey={c.key} format={c.format} row={r} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailCell({ colKey, format, row }: { colKey: string; format: any; row: Record<string, any> }) {
  const value = row[colKey];
  if (colKey === 'yt_id' && row.lead_id) {
    return (
      <Link to={`/leads/${row.lead_id}`} className="text-primary inline-flex items-center gap-1">
        {value || '—'} <ExternalLink className="h-3 w-3" />
      </Link>
    );
  }
  if (colKey === 'paid_status') {
    const map: Record<string, { label: string; cls: string }> = {
      pago: { label: 'Pago', cls: 'bg-[hsl(var(--success))] text-white' },
      parcial: { label: 'Parcial', cls: 'bg-[hsl(var(--warning))] text-white' },
      por_pagar: { label: 'Por pagar', cls: 'bg-muted text-muted-foreground' },
      excedido: { label: 'Excedido', cls: 'bg-[hsl(var(--info))] text-white' },
    };
    const cfg = map[String(value)] || null;
    return cfg ? <Badge className={cn('text-[10px] font-normal', cfg.cls)}>{cfg.label}</Badge> : <span>—</span>;
  }
  if (colKey === 'below_min_margin') {
    return value ? <Badge className="text-[10px] font-normal bg-[hsl(var(--warning))] text-white">Margem baixa</Badge> : <span>—</span>;
  }
  if (colKey === 'margin_pct') {
    const n = Number(value);
    return <span className={cn(isFinite(n) && n < 20 && 'text-[hsl(var(--warning))] font-medium')}>{formatValue(value, format)}</span>;
  }
  return <span>{formatValue(value, format)}</span>;
}

/* -------------------------------------------------------------- Drill-down */

function DrillSheet({ drill, onClose, reportName }: { drill: { title: string; def: ReportDefinition } | null; onClose: () => void; reportName: string }) {
  const [data, setData] = useState<DetailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = async (p: number) => {
    if (!drill) return;
    setLoading(true); setError(null);
    try {
      const res = await runReport({ ...drill.def, page: p });
      setData(res as DetailResult);
      setPage(p);
    } catch (e: any) {
      setError(e?.message || 'Erro ao gerar o detalhe');
    } finally {
      setLoading(false);
    }
  };

  const sig = drill ? JSON.stringify(drill.def) : null;
  if (drill && sig !== loadedFor) {
    setLoadedFor(sig);
    void load(1);
  }

  return (
    <Sheet open={!!drill} onOpenChange={o => { if (!o) { onClose(); setData(null); setLoadedFor(null); } }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader><SheetTitle className="text-sm">Detalhe · {drill?.title}</SheetTitle></SheetHeader>
        <div className="mt-3 space-y-2">
          {loading && <Skeleton className="h-24 w-full" />}
          {error && <Alert variant="destructive"><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}
          {data && !loading && (
            <>
              <p className="text-[10px] text-muted-foreground">{data.row_count} linhas</p>
              <DetailTable columns={data.columns} rows={data.rows} />
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => load(page - 1)}>Anterior</Button>
                <span className="text-[10px] text-muted-foreground">Página {page}</span>
                <Button
                  variant="outline" size="sm" className="h-7 text-xs"
                  disabled={(data.rows?.length || 0) < (data.page_size || 100)}
                  onClick={() => load(page + 1)}
                >
                  Seguinte
                </Button>
              </div>
              <Button
                variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => downloadCsv(
                  `${slug(reportName)}_detalhe.csv`,
                  data.columns.map(c => c.label),
                  data.rows.map(r => data.columns.map(c => rawValue(r[c.key], c.format)))
                )}
              >
                <Download className="h-3 w-3 mr-1" /> CSV
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* --------------------------------------------------------------- Avisos/util */

function Notices({ result }: { result: RunReportResult }) {
  const truncated = (result as SummaryResult).truncated;
  return (
    <>
      {result.hidden_financial && (
        <Alert className="py-2">
          <Info className="h-3 w-3" />
          <AlertDescription className="text-[11px]">Colunas financeiras ocultas para o seu perfil</AlertDescription>
        </Alert>
      )}
      {truncated && (
        <Alert className="py-2">
          <Info className="h-3 w-3" />
          <AlertDescription className="text-[11px]">Resultados truncados — refine o período ou os filtros.</AlertDescription>
        </Alert>
      )}
    </>
  );
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'relatorio';
