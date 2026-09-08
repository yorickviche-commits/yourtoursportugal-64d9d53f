import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useLeadsQuery } from '@/hooks/useLeadsQuery';
import { useLeadsCostingSummary } from '@/hooks/useLeadsCostingSummary';
import { useLeadsPaymentsSummary, resolvePaymentState } from '@/hooks/useLeadsPaymentsSummary';
import { cn } from '@/lib/utils';
import { Search, Eye, SlidersHorizontal, ArrowUp, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AISimulationForm from '@/components/leads/AISimulationForm';
import NewLeadDialog from '@/components/NewLeadDialog';
import LeadsAdvancedFilters, { LeadFilters, EMPTY_FILTERS, countActiveFilters } from '@/components/leads/LeadsAdvancedFilters';
import LeadsFilterChips from '@/components/leads/LeadsFilterChips';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import ClientTypeBadge from '@/components/ClientTypeBadge';
import StatusBadge from '@/components/StatusBadge';
import { displayLeadCode } from '@/lib/leadCode';
import LeadAgentsCell from '@/components/LeadAgentsCell';

import { resolveStage, normStage } from '@/lib/leadStages';
import { eur as fmtEur } from '@/lib/money';

const fmtDate = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('pt-PT');
};

const toTime = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
};

/** Datas em 2 linhas sobrepostas (início / fim) para não alargar a tabela. */
const LeadDates = ({ lead }: { lead: any }) => {
  const start = fmtDate(lead.travel_dates);
  const end = fmtDate(lead.travel_end_date);
  const estimated = (lead.dates_type || 'estimated') !== 'concrete';
  if (!start && !end) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="leading-tight">
      <div className="whitespace-nowrap">{start || '—'}</div>
      {end && end !== start && (
        <div className="whitespace-nowrap text-[10px] text-muted-foreground">→ {end}</div>
      )}
      {estimated && <div className="text-[10px] text-muted-foreground italic">estimadas</div>}
    </div>
  );
};

const fmtMoney = (n: number) =>
  fmtEur(n);

type SortKey = 'id' | 'name' | 'type' | 'destination' | 'days' | 'dates' | 'pax' | 'pvp' | 'margin' | 'created' | 'stage';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<SortKey, string> = {
  id: 'Id', name: 'Nome', type: 'Tipo', destination: 'Destino', days: 'Dias',
  dates: 'Datas', pax: 'Pax', pvp: 'PVP', margin: 'Margem', created: 'Criação', stage: 'Estado',
};

const num = (v: string) => (v === '' ? null : Number(v));

const LeadsFilesPage = () => {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeadsQuery();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const isMobile = useIsMobile();

  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const { data: costingMap = {} } = useLeadsCostingSummary(leadIds);
  const { data: paymentsMap = {} } = useLeadsPaymentsSummary(leadIds);

  const sources = useMemo(
    () => Array.from(new Set(leads.map(l => l.source).filter(Boolean))) as string[],
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = filters;
    const dest = f.destination.trim().toLowerCase();

    const inDateRange = (value: string | null | undefined, from: string, to: string) => {
      if (!from && !to) return true;
      const t = toTime(value);
      if (t === null) return false;
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime() + 86_399_000) return false;
      return true;
    };

    const inNumRange = (value: number | null, min: string, max: string) => {
      const lo = num(min), hi = num(max);
      if (lo === null && hi === null) return true;
      if (value === null) return false;
      if (lo !== null && value < lo) return false;
      if (hi !== null && value > hi) return false;
      return true;
    };

    return leads.filter(l => {
      const lead = l as any;

      if (f.stages.length > 0) {
        const cur = normStage(resolveStage(lead).stage);
        if (!f.stages.some(s => normStage(s) === cur)) return false;
      }
      if (!inDateRange(lead.travel_dates, f.departFrom, f.departTo)) return false;
      if (!inDateRange(lead.travel_end_date, f.arriveFrom, f.arriveTo)) return false;
      if (!inDateRange(lead.created_at, f.createdFrom, f.createdTo)) return false;
      if (dest && !(lead.destination || '').toLowerCase().includes(dest)) return false;
      if (f.clientType !== 'all' && (lead.client_type || 'B2C') !== f.clientType) return false;
      if (f.source !== 'all' && lead.source !== f.source) return false;
      if (f.agent !== 'all') {
        const assigned: string[] = Array.isArray(lead.assigned_agents) ? lead.assigned_agents : [];
        if (!assigned.includes(f.agent) && lead.sales_owner !== f.agent) return false;
      }

      const cs = costingMap[lead.id];
      const pvp = cs?.pvp ?? 0;
      if (!inNumRange(cs ? pvp : null, f.pvpMin, f.pvpMax)) return false;
      if (!inNumRange(cs ? cs.marginPct : null, f.marginMin, f.marginMax)) return false;

      if (f.paymentState !== 'all') {
        if (resolvePaymentState(paymentsMap[lead.id] || 0, pvp) !== f.paymentState) return false;
      }

      if (!inNumRange(lead.pax ?? null, f.paxMin, f.paxMax)) return false;
      if (!inNumRange(lead.number_of_days ?? null, f.daysMin, f.daysMax)) return false;

      if (!q) return true;
      const haystack = [
        displayLeadCode(l), l.lead_code, l.yt_id, l.client_name, l.destination,
        l.travel_dates, l.email, String(l.pax ?? ''), String(l.number_of_days ?? ''),
        resolveStage(lead).label,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, search, filters, costingMap, paymentsMap]);

  const sortedLeads = useMemo(() => {
    if (!sort) return filteredLeads;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const valueOf = (l: any): string | number => {
      const cs = costingMap[l.id];
      switch (sort.key) {
        case 'id': return displayLeadCode(l) || '';
        case 'name': return (l.client_name || '').toLowerCase();
        case 'type': return (l.client_type || '').toLowerCase();
        case 'destination': return (l.destination || '').toLowerCase();
        case 'days': return l.number_of_days || 0;
        case 'dates': return toTime(l.travel_dates) ?? 0;
        case 'pax': return l.pax || 0;
        case 'pvp': return cs?.pvp || 0;
        case 'margin': return cs?.marginPct ?? -Infinity;
        case 'created': return toTime(l.created_at) ?? 0;
        case 'stage': return resolveStage(l).label.toLowerCase();
      }
    };
    return [...filteredLeads].sort((a, b) => {
      const va = valueOf(a), vb = valueOf(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'pt') * dir;
      }
      return ((va as number) - (vb as number)) * dir;
    });
  }, [filteredLeads, sort, costingMap]);

  const toggleSort = (key: SortKey) => {
    setSort(cur => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' };
      if (cur.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const Th = ({ k, children, align = 'left' }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'center' | 'right' }) => {
    const active = sort?.key === k;
    return (
      <th className={cn('px-2 py-2.5 font-medium text-muted-foreground text-[11px] select-none',
        align === 'center' && 'text-center', align === 'right' && 'text-right', align === 'left' && 'text-left')}>
        <button onClick={() => toggleSort(k)}
          className={cn('inline-flex items-center gap-1 hover:text-foreground transition-colors',
            active && 'text-foreground')}>
          {children}
          {active && (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      </th>
    );
  };

  const activeCount = countActiveFilters(filters);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Files</h1>
          <span className="text-xs text-muted-foreground">{sortedLeads.length} files</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Pesquisar por ID, nome, destino, datas..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm" />
          </div>
          <Button variant="outline" className="h-9 gap-1.5 text-sm" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Pesquisa avançada
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{activeCount}</span>
            )}
          </Button>
          {isMobile && (
            <Select
              value={sort ? `${sort.key}:${sort.dir}` : 'default'}
              onValueChange={v => setSort(v === 'default' ? null : { key: v.split(':')[0] as SortKey, dir: v.split(':')[1] as SortDir })}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Mais recentes</SelectItem>
                {(Object.keys(SORT_LABELS) as SortKey[]).flatMap(k => ([
                  <SelectItem key={`${k}:asc`} value={`${k}:asc`}>{SORT_LABELS[k]} ↑</SelectItem>,
                  <SelectItem key={`${k}:desc`} value={`${k}:desc`}>{SORT_LABELS[k]} ↓</SelectItem>,
                ]))}
              </SelectContent>
            </Select>
          )}
        </div>

        <LeadsFilterChips value={filters} onChange={setFilters} />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : isMobile ? (
          /* Mobile: Card List */
          <div className="space-y-3">
            {sortedLeads.map(lead => {
              const badge = resolveStage(lead as any);
              const cs = costingMap[lead.id];
              const hasPvp = cs && cs.pvp > 0;
              return (
                <div key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                  className="bg-card rounded-lg border p-4 active:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-semibold truncate">{lead.client_name}</p>
                        <ClientTypeBadge value={(lead as any).client_type} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.destination || '—'} · {lead.pax} pax · {lead.number_of_days || '—'} dias</p>
                      <div className="text-xs text-muted-foreground mt-0.5"><LeadDates lead={lead} /></div>
                    </div>
                    <StatusBadge label={badge.label} className={badge.className} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <span className="text-muted-foreground">{displayLeadCode(lead)}</span>
                    <span className="font-medium">
                      PVP: <span className={cn(!hasPvp && "text-muted-foreground")}>{hasPvp ? fmtMoney(cs.pvp) : '—'}</span>
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      Margem: <span className={cn(!hasPvp && "text-muted-foreground")}>{hasPvp ? `${cs.marginPct.toFixed(0)}%` : '—'}</span>
                    </span>
                  </div>
                  <div className="mt-2" onClick={e => e.stopPropagation()}>
                    <LeadAgentsCell leadId={lead.id} value={(lead as any).assigned_agents} />
                  </div>
                </div>
              );
            })}
            {sortedLeads.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem files encontradas</p>}
          </div>
        ) : (
          /* Desktop: Table */
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[92px]" />
                <col />
                <col className="w-[56px]" />
                <col className="w-[130px]" />
                <col className="w-[48px]" />
                <col className="w-[104px]" />
                <col className="w-[48px]" />
                <col className="w-[110px]" />
                <col className="w-[86px]" />
                <col className="w-[120px]" />
                <col className="w-[160px]" />
                <col className="w-[44px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <Th k="id">Id</Th>
                  <Th k="name">Nome</Th>
                  <Th k="type" align="center">Tipo</Th>
                  <Th k="destination">Destino</Th>
                  <Th k="days" align="center">Dias</Th>
                  <Th k="dates">Datas</Th>
                  <Th k="pax" align="center">Pax</Th>
                  <th className="px-2 py-2.5 font-medium text-muted-foreground text-[11px] text-right select-none">
                    <button onClick={() => toggleSort('pvp')} className={cn('hover:text-foreground', sort?.key === 'pvp' && 'text-foreground')}>PVP</button>
                    <span className="mx-0.5">/</span>
                    <button onClick={() => toggleSort('margin')} className={cn('hover:text-foreground', sort?.key === 'margin' && 'text-foreground')}>Margem</button>
                  </th>
                  <Th k="created">Criação</Th>
                  <th className="text-left px-2 py-2.5 font-medium text-muted-foreground text-[11px]">Agentes</th>
                  <Th k="stage" align="center">Estado</Th>
                  <th className="text-center px-1 py-2.5 font-medium text-muted-foreground text-[11px]">Ver</th>
                </tr>
              </thead>

              <tbody>
                {sortedLeads.map(lead => {
                  const badge = resolveStage(lead as any);
                  const cs = costingMap[lead.id];
                  const hasPvp = cs && cs.pvp > 0;
                  const marginColor = hasPvp
                    ? (cs.marginPct >= 30
                        ? 'text-[hsl(var(--stable))]'
                        : cs.marginPct >= 25
                          ? 'text-[hsl(var(--warning))]'
                          : 'text-[hsl(var(--urgent))]')
                    : 'text-muted-foreground';
                  return (
                    <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-2 py-2.5 text-[11px] text-muted-foreground truncate">{displayLeadCode(lead)}</td>
                      <td className="px-2 py-2.5"><p className="text-xs font-medium text-[hsl(var(--info))] hover:underline break-words leading-tight">{lead.client_name}</p></td>
                      <td className="px-1 py-2.5 text-center"><ClientTypeBadge value={(lead as any).client_type} /></td>
                      <td className="px-2 py-2.5 text-[11px] text-foreground break-words leading-tight">{lead.destination}</td>
                      <td className="px-1 py-2.5 text-[11px] text-center text-foreground">{lead.number_of_days || '—'}</td>
                      <td className="px-2 py-2.5 text-[11px] text-foreground"><LeadDates lead={lead} /></td>
                      <td className="px-1 py-2.5 text-[11px] text-center text-foreground">{lead.pax}</td>
                      <td className="px-2 py-2.5 text-[11px] text-right whitespace-nowrap">
                        {hasPvp ? (
                          <div className="leading-tight">
                            <div className="font-semibold text-foreground">{fmtMoney(cs.pvp)}</div>
                            <div className={cn("text-[10px] font-medium", marginColor)}>{cs.marginPct.toFixed(0)}%</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-[10px] text-muted-foreground leading-tight">
                        <div>{new Date(lead.created_at).toLocaleDateString('pt-PT')}</div>
                        <div>{new Date(lead.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        <LeadAgentsCell leadId={lead.id} value={(lead as any).assigned_agents} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cn('inline-block rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight text-center break-words', badge.className)}>{badge.label}</span>
                      </td>
                      <td className="px-1 py-2.5 text-center"><Eye className="h-4 w-4 text-muted-foreground mx-auto" /></td>

                    </tr>
                  );
                })}
                {sortedLeads.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">Sem files encontradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LeadsAdvancedFilters open={filtersOpen} onOpenChange={setFiltersOpen} value={filters} onApply={setFilters} sources={sources} />
      <AISimulationForm open={simulationOpen} onOpenChange={setSimulationOpen} />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </AppLayout>
  );
};

export default LeadsFilesPage;
