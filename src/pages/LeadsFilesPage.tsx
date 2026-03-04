import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useLeadsQuery } from '@/hooks/useLeadsQuery';
import { cn } from '@/lib/utils';
import { Search, Eye, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AISimulationForm from '@/components/leads/AISimulationForm';
import NewLeadDialog from '@/components/NewLeadDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';

type LeadStatusFilter = 'all' | 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';

const STATUS_TABS: { value: LeadStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'new', label: 'Em Construção' },
  { value: 'contacted', label: 'A Aguardar' },
  { value: 'qualified', label: 'Pre-Reservadas' },
  { value: 'proposal_sent', label: 'Recusadas' },
  { value: 'negotiation', label: 'Reservadas' },
  { value: 'won', label: 'Concluídas' },
  { value: 'lost', label: 'Canceladas' },
];

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  new: { label: 'Novo', className: 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]' },
  contacted: { label: 'Contactado', className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' },
  qualified: { label: 'Qualificado', className: 'bg-purple-100 text-purple-700' },
  proposal_sent: { label: 'Proposta', className: 'bg-[hsl(var(--urgent))]/10 text-[hsl(var(--urgent))]' },
  negotiation: { label: 'Negociação', className: 'bg-purple-100 text-purple-700' },
  won: { label: 'Ganho', className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' },
  lost: { label: 'Perdido', className: 'bg-destructive/10 text-destructive' },
};

const LeadsFilesPage = () => {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeadsQuery();
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const isMobile = useIsMobile();

  const filteredLeads = leads.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search && !l.client_name.toLowerCase().includes(search.toLowerCase()) &&
        !(l.destination || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
            <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)}
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
              return (
                <div key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                  className="bg-card rounded-lg border p-4 active:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{lead.client_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.destination || '—'} · {lead.pax} pax · {lead.number_of_days || '—'} dias</p>
                    </div>
                    <StatusBadge label={badge.label} className={badge.className} />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-muted-foreground">{lead.lead_code}</span>
                    <span className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-PT')}</span>
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
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Id</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Nome</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Destino</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Dias</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Datas</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Pax</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Data Criação</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Estado</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Ver</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => {
                  const badge = statusBadgeConfig[lead.status] || statusBadgeConfig.new;
                  return (
                    <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.lead_code}</td>
                      <td className="px-4 py-3"><p className="text-xs font-medium text-[hsl(var(--info))] hover:underline">{lead.client_name}</p></td>
                      <td className="px-4 py-3 text-xs text-foreground">{lead.destination}</td>
                      <td className="px-4 py-3 text-xs text-center text-foreground">{lead.number_of_days || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.travel_dates}</td>
                      <td className="px-4 py-3 text-xs text-center text-foreground">{lead.pax}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString('pt-PT')} {new Date(lead.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge label={badge.label} className={badge.className} /></td>
                      <td className="px-4 py-3 text-center"><Eye className="h-4 w-4 text-muted-foreground mx-auto" /></td>
                    </tr>
                  );
                })}
                {filteredLeads.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Sem simulações encontradas</td></tr>
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
