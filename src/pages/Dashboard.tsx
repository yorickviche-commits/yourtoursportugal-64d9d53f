import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Wrench, DollarSign, Handshake, TrendingUp, Clock, CheckCircle, AlertTriangle, FileText, HelpCircle, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import MonthlyCalendar, { CalendarEvent, EVENT_COLORS } from '@/components/dashboard/MonthlyCalendar';
import TasksBoard from '@/components/dashboard/TasksBoard';
import { useTripsQuery } from '@/hooks/useTripsQuery';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import AdminKPIFilters from '@/components/kpi/AdminKPIFilters';
import KPICards from '@/components/kpi/KPICards';
import { useUserKPIs } from '@/hooks/useUserKPIs';
import {
  KPIFilterState, KPIValue, useSalesKPIs, useOperationsKPIs, useFinanceKPIs, useB2BKPIs,
} from '@/hooks/useAdminKPIs';

type DashboardSubPage = 'overview' | 'calendar_reservas' | 'calendar_tasks';

const fmtEur = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const KPICard = ({ icon: Icon, label, value, variant = 'default', unavailableNote }: {
  icon: React.ElementType; label: string; value: KPIValue | string; variant?: 'default' | 'success' | 'warning' | 'urgent'; unavailableNote?: string;
}) => {
  const variantStyles = {
    default: 'border-border', success: 'border-success/30', warning: 'border-warning/30', urgent: 'border-destructive/30',
  };
  const isMissing = value === null;
  const display = isMissing ? 'Sem dados' : value;
  return (
    <Card className={`${variantStyles[isMissing ? 'default' : variant]}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              {isMissing && unavailableNote && (
                <Tooltip>
                  <TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground/70 cursor-help" /></TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">{unavailableNote}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className={`text-2xl font-bold mt-1 ${isMissing ? 'text-muted-foreground/60' : ''}`}>{display}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

const DepartmentKPIDashboard = () => {
  const [filters, setFilters] = useState<KPIFilterState>({ period: '30d' });
  const sales = useSalesKPIs(filters);
  const operations = useOperationsKPIs(filters);
  const finance = useFinanceKPIs(filters);
  const b2b = useB2BKPIs(filters);

  const s = sales.data, o = operations.data, f = finance.data, b = b2b.data;

  return (
    <Tabs defaultValue="sales" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="sales" className="gap-1.5"><Users className="h-3.5 w-3.5" />Sales</TabsTrigger>
          <TabsTrigger value="operations" className="gap-1.5"><Wrench className="h-3.5 w-3.5" />Operations</TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />Finance</TabsTrigger>
          <TabsTrigger value="b2b" className="gap-1.5"><Handshake className="h-3.5 w-3.5" />B2B</TabsTrigger>
        </TabsList>
        <AdminKPIFilters value={filters} onChange={setFilters} />
      </div>

      <TabsContent value="sales">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard icon={Users} label="Leads Recebidos" value={s?.leadsRecebidos ?? (sales.isLoading ? 0 : null)} variant="default" />
          <KPICard icon={TrendingUp} label="Leads Convertidos" value={s?.leadsConvertidos ?? (sales.isLoading ? 0 : null)} variant="success" />
          <KPICard icon={Clock} label="Tempo Médio Resposta" value={null} unavailableNote="Ainda não existe um timestamp fiável de 'primeira resposta' no schema." variant="default" />
          <KPICard icon={DollarSign} label="Revenue Gerado" value={s ? fmtEur(s.revenueGerado ?? 0) : (sales.isLoading ? '…' : null)} variant="success" />
          <KPICard icon={TrendingUp} label="Taxa Conversão" value={s ? fmtPct(s.taxaConversao ?? 0) : (sales.isLoading ? '…' : null)} variant="default" />
          <KPICard icon={CheckCircle} label="Aprovação Propostas" value={s?.aprovacaoPropostas != null ? fmtPct(s.aprovacaoPropostas) : null} unavailableNote="Sem propostas enviadas (sent_at) neste período." variant="default" />
        </div>
      </TabsContent>

      <TabsContent value="operations">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard icon={FileText} label="Trips Criados" value={o?.tripsCriados ?? (operations.isLoading ? 0 : null)} variant="default" />
          <KPICard icon={AlertTriangle} label="Erros Sinalizados" value={o?.errosSinalizados ?? (operations.isLoading ? 0 : null)} variant="urgent" />
          <KPICard icon={CheckCircle} label="Drafts WeTravel" value={o?.draftsWeTravel ?? (operations.isLoading ? 0 : null)} variant="default" />
          <KPICard icon={DollarSign} label="Desvios Custo Operacional" value={null} unavailableNote="Não existe ainda uma coluna/tabela de desvio de custo operacional no schema." variant="warning" />
        </div>
      </TabsContent>

      <TabsContent value="finance">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard icon={DollarSign} label="Revenue Cobrado" value={f ? fmtEur(f.revenueCobrado ?? 0) : (finance.isLoading ? '…' : null)} variant="success" />
          <KPICard icon={Clock} label="Pagamentos Pendentes" value={f?.pagamentosPendentes ?? (finance.isLoading ? 0 : null)} unavailableNote="Aproximado por links WeTravel publicados e ativos — ainda sem estado de pagamento confirmado por reserva." variant="warning" />
          <KPICard icon={CheckCircle} label="Links WeTravel Gerados" value={f?.linksWeTravelGerados ?? (finance.isLoading ? 0 : null)} variant="default" />
          <KPICard icon={AlertTriangle} label="Reembolsos" value={f ? fmtEur(f.reembolsos ?? 0) : (finance.isLoading ? '…' : null)} variant="urgent" />
        </div>
      </TabsContent>

      <TabsContent value="b2b">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard icon={Handshake} label="Parceiros Onboarded" value={b?.parceirosOnboarded ?? (b2b.isLoading ? 0 : null)} variant="default" />
          <KPICard icon={CheckCircle} label="Deals Fechados" value={b?.dealsFechados ?? (b2b.isLoading ? 0 : null)} variant="success" />
          <KPICard icon={DollarSign} label="Valor Médio Deal" value={b?.valorMedioDeal != null ? fmtEur(b.valorMedioDeal) : null} unavailableNote="Sem deals B2B fechados (client_type = 'B2B', status = 'won') neste período." variant="default" />
        </div>
      </TabsContent>
    </Tabs>
  );
};

const PersonalKPIView = () => {
  const { user } = useAuth();
  const { data, isLoading, error } = useUserKPIs(user?.id, {});

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Os Meus KPIs</h2>
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md border border-border bg-muted/40" />
          ))}
        </div>
      )}
      {!isLoading && error && (
        <p className="text-xs text-muted-foreground">Não foi possível carregar os KPIs. Tenta recarregar a página.</p>
      )}
      {!isLoading && !error && data && <KPICards k={data} />}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link to="/leads"><Button size="sm" variant="outline" className="text-xs">Ver as minhas Leads</Button></Link>
        <Link to="/tasks"><Button size="sm" variant="outline" className="text-xs">Tarefas</Button></Link>
      </div>
    </div>
  );
};


const Dashboard = () => {
  const [subPage, setSubPage] = useState<DashboardSubPage>('overview');
  const { isAdmin } = useAuth();
  const { data: trips = [] } = useTripsQuery();

  const calendarEvents: CalendarEvent[] = trips.map((t, idx) => ({
    id: t.id, title: `${t.client_name} - ${t.destination}`,
    startDate: t.start_date || '', endDate: t.end_date || '',
    color: EVENT_COLORS[idx % EVENT_COLORS.length], tripId: t.id,
    clientName: t.client_name, destination: t.destination,
    pax: t.pax, status: t.status, salesOwner: t.sales_owner, totalValue: t.total_value,
  }));

  const subPageTabs: { key: DashboardSubPage; label: string }[] = [
    { key: 'overview', label: 'Visão Geral' },
    { key: 'calendar_reservas', label: '📅 Calendário Reservas' },
    { key: 'calendar_tasks', label: '📋 Calendário Tasks' },
  ];

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary hidden sm:block" />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Daily Command Center</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: pt })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/leads"><Button size="sm" variant="outline" className="text-xs gap-1"><Plus className="h-3 w-3" /> Novo Lead</Button></Link>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {subPageTabs.map(tab => (
            <button key={tab.key} onClick={() => setSubPage(tab.key)} className={cn("px-3 sm:px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap", subPage === tab.key ? "border-[hsl(var(--info))] text-[hsl(var(--info))]" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>
          ))}
        </div>

        {subPage === 'overview' && (isAdmin ? <DepartmentKPIDashboard /> : <PersonalKPIView />)}
        {subPage === 'calendar_reservas' && <MonthlyCalendar events={calendarEvents} />}
        {subPage === 'calendar_tasks' && <TasksBoard />}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
