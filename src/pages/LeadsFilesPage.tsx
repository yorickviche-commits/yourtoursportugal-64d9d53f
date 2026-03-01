import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { mockFiles } from '@/data/mockLeads';
import { useLeads } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { Sparkles, Search, FileText, Image, Table2, File, ExternalLink, User, MapPin, Tag, Plus, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AISimulationForm from '@/components/leads/AISimulationForm';
import NewLeadDialog from '@/components/NewLeadDialog';

type Tab = 'leads' | 'files';
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

// Lead status color
const leadStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-[hsl(var(--warning-muted))] text-[hsl(var(--warning-foreground))]';
    case 'contacted': return 'bg-[hsl(var(--info-muted))] text-[hsl(var(--info))]';
    case 'qualified': return 'bg-[hsl(var(--success-muted))] text-[hsl(var(--success))]';
    case 'proposal_sent': return 'bg-[hsl(var(--urgent-muted))] text-[hsl(var(--urgent))]';
    case 'negotiation': return 'bg-purple-100 text-purple-700';
    case 'won': return 'bg-[hsl(var(--success-muted))] text-[hsl(var(--success))]';
    case 'lost': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

// Status dot color
const statusDot = (status: string) => {
  switch (status) {
    case 'new': return 'bg-[hsl(var(--warning))]';
    case 'contacted': return 'bg-[hsl(var(--info))]';
    case 'qualified': return 'bg-[hsl(var(--success))]';
    case 'proposal_sent': return 'bg-[hsl(var(--urgent))]';
    case 'negotiation': return 'bg-purple-500';
    default: return 'bg-muted-foreground';
  }
};

// File icon
const fileIcon = (type: string) => {
  switch (type) {
    case 'pdf': return <FileText className="h-4 w-4 text-[hsl(var(--destructive))]" />;
    case 'doc': return <FileText className="h-4 w-4 text-[hsl(var(--info))]" />;
    case 'image': return <Image className="h-4 w-4 text-[hsl(var(--success))]" />;
    case 'spreadsheet': return <Table2 className="h-4 w-4 text-[hsl(var(--success))]" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
};

const LeadsFilesPage = () => {
  const navigate = useNavigate();
  const { leads } = useLeads();
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  const filteredLeads = leads.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search && !l.clientName.toLowerCase().includes(search.toLowerCase()) &&
        !l.destination.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredFiles = mockFiles.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) &&
        !f.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  // KPI calculations
  const totalVolume = leads.reduce((sum, l) => {
    const budgetMap: Record<string, number> = { '€€': 3000, '€€€': 6000, '€€€€': 12000 };
    return sum + (budgetMap[l.budgetLevel] || 0) * l.pax;
  }, 0);
  const avgValue = leads.length > 0 ? totalVolume / leads.length : 0;
  const avgDays = 12;
  const dailySimulations = leads.filter(l => {
    const today = new Date().toISOString().split('T')[0];
    return l.createdAt.startsWith(today);
  }).length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Simulações</h1>
        </div>

        {/* Main Tabs: Leads vs Files */}
        <div className="flex items-center gap-1 border-b border-border">
          {([
            { key: 'leads' as Tab, label: 'Simulações', count: leads.length },
            { key: 'files' as Tab, label: 'Ficheiros', count: mockFiles.length },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.key
                  ? "border-[hsl(var(--info))] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {tab.label}
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>

        {activeTab === 'leads' && (
          <>
            {/* Status sub-tabs */}
            <div className="flex items-center gap-0 border-b border-border/50 overflow-x-auto">
              {STATUS_TABS.map(tab => (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                    statusFilter === tab.value
                      ? "border-[hsl(var(--info))] text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}>
                  {tab.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 px-2">
                <span className="text-xs text-muted-foreground">Categorias</span>
                <span className="text-xs text-muted-foreground">Arquivados</span>
              </div>
            </div>

            {/* KPI Analytics Cards */}
            <div className="bg-card rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg text-muted-foreground">Análise de simulações</h2>
                <div className="flex items-center gap-2">
                  <Input type="date" className="h-8 text-xs w-36" defaultValue="2026-02-21" />
                  <Input type="date" className="h-8 text-xs w-36" defaultValue="2026-02-28" />
                  <Button variant="ghost" size="sm"><Search className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div className="border-l-2 border-foreground/20 pl-4">
                  <p className="text-xs font-medium text-foreground">volume total</p>
                  <p className="text-lg font-medium text-foreground mt-2">{totalVolume.toLocaleString('pt-PT')} €</p>
                </div>
                <div className="border-l-2 border-foreground/20 pl-4">
                  <p className="text-xs font-medium text-foreground">valor médio</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{avgValue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €</p>
                </div>
                <div className="border-l-2 border-foreground/20 pl-4">
                  <p className="text-xs font-medium text-foreground">média de dias</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{avgDays}</p>
                </div>
                <div className="border-l-2 border-foreground/20 pl-4">
                  <p className="text-xs font-medium text-foreground">simulações diárias</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{dailySimulations}</p>
                </div>
                <div className="border-l-2 border-foreground/20 pl-4">
                  <p className="text-xs font-medium text-foreground">total de simulações</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{leads.length}</p>
                </div>
              </div>
            </div>

            {/* Search + New button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="default" size="sm" className="text-xs">Pesquisa Detalhada</Button>
                <span className="text-xs text-muted-foreground">
                  Mostrar <select className="border rounded px-1 py-0.5 text-xs bg-background">
                    <option>10</option><option>25</option><option>50</option>
                  </select> registos por página
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm w-48" />
                </div>
                <Button onClick={() => setNewLeadOpen(true)} size="sm" variant="outline" className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Nova Lead
                </Button>
                <Button onClick={() => setSimulationOpen(true)}
                  className="bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--urgent)/0.8)] hover:opacity-90 text-white gap-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  New AI Simulation
                </Button>
              </div>
            </div>

            {/* Leads Table */}
            <div className="bg-card rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Id</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Nome</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Tipo</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Destino</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Dias</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Datas</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Pessoas</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Total PVP</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Data Criação</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Estado</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground text-xs">Consultar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => (
                    <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.id}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[hsl(var(--info))] hover:underline">{lead.clientName}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.source === 'ai_simulation' ? 'AI Sim' : 'Externa'}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{lead.destination}</td>
                      <td className="px-4 py-3 text-xs text-center text-foreground">—</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lead.travelDates}</td>
                      <td className="px-4 py-3 text-xs text-center text-foreground">{lead.pax}</td>
                      <td className="px-4 py-3 text-xs text-right font-medium text-foreground">{lead.budgetLevel}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString('pt-PT')} {new Date(lead.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-block h-3 w-3 rounded-full", statusDot(lead.status))} title={lead.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Eye className="h-4 w-4 text-muted-foreground mx-auto" />
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">Sem simulações encontradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Pesquisar ficheiros..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm" />
              </div>
            </div>
            <div className="bg-card rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ficheiro</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tags</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Upload por</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Data</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tamanho</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Drive</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map(file => (
                    <tr key={file.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {fileIcon(file.type)}
                          <span className="text-xs font-medium text-foreground">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {file.tags.map(tag => (
                            <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Tag className="h-2.5 w-2.5" />{tag}
                            </span>
                          ))
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{file.uploadedBy}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(file.uploadedAt).toLocaleDateString('pt-PT')}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{file.size}</td>
                      <td className="px-4 py-3 text-center">
                        {file.driveUrl && (
                          <a href={file.driveUrl} className="inline-flex items-center text-[hsl(var(--info))] hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AISimulationForm open={simulationOpen} onOpenChange={setSimulationOpen} />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </AppLayout>
  );
};

export default LeadsFilesPage;
