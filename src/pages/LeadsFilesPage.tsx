import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useLeadsQuery } from '@/hooks/useLeadsQuery';
import { useLeadsCostingSummary } from '@/hooks/useLeadsCostingSummary';
import { cn } from '@/lib/utils';
import { Search, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import AISimulationForm from '@/components/leads/AISimulationForm';
import NewLeadDialog from '@/components/NewLeadDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import ClientTypeBadge from '@/components/ClientTypeBadge';
import StatusBadge from '@/components/StatusBadge';
import { displayLeadCode } from '@/lib/leadCode';
import LeadAgentsCell from '@/components/LeadAgentsCell';

// Aligned 1:1 with LEAD_STATUSES in LeadDetailPage.tsx — same labels users can assign inside a lead.
type LeadStatusFilter = 'all' | 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';

const STATUS_TABS: { value: LeadStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'proposal_sent', label: 'Proposta Enviada' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perdido' },
];

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  new: { label: 'Novo', className: 'bg-muted text-muted-foreground' },
  contacted: { label: 'Contactado', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  qualified: { label: 'Qualificado', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  proposal_sent: { label: 'Proposta Enviada', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  negotiation: { label: 'Negociação', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  won: { label: 'Ganho ✓', className: 'bg-[hsl(var(--stable))]/15 text-[hsl(var(--stable))]' },
  lost: { label: 'Perdido', className: 'bg-destructive/15 text-destructive' },
};

const fmtMoney = (n: number) =>
  n.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + '€';

const LeadsFilesPage = () => {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeadsQuery();
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const isMobile = useIsMobile();

  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const { data: costingMap = {} } = useLeadsCostingSummary(leadIds);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        displayLeadCode(l),
        l.lead_code,
        l.yt_id,
        l.client_name,
        l.destination,
        l.travel_dates,
        l.email,
        String(l.pax ?? ''),
        String(l.number_of_days ?? ''),
        statusBadgeConfig[l.status]?.label,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, statusFilter, search]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Simulações</h1>
        </div>

        <div className="flex items-center gap-0 border-b border-border/50 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                statusFilter === tab.value
                  ? "border-[hsl(var(--info))] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Pesquisar por ID, nome, destino, datas..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : isMobile ? (
          /* Mobile: Card List */
          <div className="space-y-3">
            {filteredLeads.map(lead => {
              const badge = statusBadgeConfig[lead.status] || statusBadgeConfig.new;
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
            {filteredLeads.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem simulações encontradas</p>}
          </div>
        ) : (
          /* Desktop: Table */
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Id</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Nome</th>
                  <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs">Tipo</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Destino</th>
                  <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs">Dias</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Datas</th>
                  <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs">Pax</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">PVP / Margem</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Data Criação</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Agentes</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Estado</th>
                  <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs">Ver</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => {
                  const badge = statusBadgeConfig[lead.status] || statusBadgeConfig.new;
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
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{displayLeadCode(lead)}</td>
                      <td className="px-3 py-3"><p className="text-xs font-medium text-[hsl(var(--info))] hover:underline">{lead.client_name}</p></td>
                      <td className="px-2 py-3 text-center"><ClientTypeBadge value={(lead as any).client_type} /></td>
                      <td className="px-3 py-3 text-xs text-foreground">{lead.destination}</td>
                      <td className="px-2 py-3 text-xs text-center text-foreground">{lead.number_of_days || '—'}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{lead.travel_dates}</td>
                      <td className="px-2 py-3 text-xs text-center text-foreground">{lead.pax}</td>
                      <td className="px-3 py-3 text-xs text-right whitespace-nowrap">
                        {hasPvp ? (
                          <div className="leading-tight">
                            <div className="font-semibold text-foreground">{fmtMoney(cs.pvp)}</div>
                            <div className={cn("text-[10px] font-medium", marginColor)}>{cs.marginPct.toFixed(0)}%</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('pt-PT')} {new Date(lead.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <LeadAgentsCell leadId={lead.id} value={(lead as any).assigned_agents} />
                      </td>
                      <td className="px-3 py-3 text-center"><StatusBadge label={badge.label} className={badge.className} /></td>
                      <td className="px-2 py-3 text-center"><Eye className="h-4 w-4 text-muted-foreground mx-auto" /></td>
                    </tr>
                  );
                })}
                {filteredLeads.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">Sem simulações encontradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AISimulationForm open={simulationOpen} onOpenChange={setSimulationOpen} />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </AppLayout>
  );
};

export default LeadsFilesPage;
