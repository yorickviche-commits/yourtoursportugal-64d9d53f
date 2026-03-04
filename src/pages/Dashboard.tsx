import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Users, Send, TrendingUp, Calendar as CalendarIcon, ArrowRight, Loader2, Plus, DollarSign, ListTodo } from 'lucide-react';
import { format, formatDistanceToNow, startOfMonth, isBefore, startOfDay, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { urgencyConfig, statusConfig, approvalTypeConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import MonthlyCalendar, { CalendarEvent, EVENT_COLORS } from '@/components/dashboard/MonthlyCalendar';
import TasksBoard from '@/components/dashboard/TasksBoard';
import { useTripsQuery } from '@/hooks/useTripsQuery';
import { useApprovalsQuery } from '@/hooks/useApprovalsQuery';
import { useLeadsQuery } from '@/hooks/useLeadsQuery';
import { useTasksQuery } from '@/hooks/useTasksQuery';
import { useActivityLogQuery } from '@/hooks/useActivityLogQuery';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardSubPage = 'overview' | 'calendar_reservas' | 'calendar_tasks';

const KPICard = ({ icon: Icon, label, value, subtitle, variant = 'default', loading }: {
  icon: React.ElementType; label: string; value: string | number; subtitle?: string;
  variant?: 'default' | 'urgent' | 'warning' | 'success' | 'info'; loading?: boolean;
}) => {
  const borderColors = { default: 'border-border', urgent: 'border-destructive/30', warning: 'border-[hsl(var(--urgent))]/30', success: 'border-[hsl(var(--success))]/30', info: 'border-[hsl(var(--info))]/30' };
  const iconColors = { default: 'text-muted-foreground', urgent: 'text-destructive', warning: 'text-[hsl(var(--urgent))]', success: 'text-[hsl(var(--success))]', info: 'text-[hsl(var(--info))]' };

  return (
    <div className={cn("rounded-lg border bg-card p-3 sm:p-4", borderColors[variant])}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-medium truncate">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-xl sm:text-2xl font-bold mt-1">{value}</p>}
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", iconColors[variant])} />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [subPage, setSubPage] = useState<DashboardSubPage>('overview');
  const { data: trips = [], isLoading: tripsLoading } = useTripsQuery();
  const { data: approvals = [], isLoading: approvalsLoading } = useApprovalsQuery();
  const { data: leads = [], isLoading: leadsLoading } = useLeadsQuery();
  const { data: allTasks = [], isLoading: tasksLoading } = useTasksQuery();
  const { data: activityLogs = [] } = useActivityLogQuery();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const loading = tripsLoading || approvalsLoading || leadsLoading || tasksLoading;

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        if (payload.eventType === 'INSERT') {
          const newLead = payload.new as any;
          toast({ title: '🆕 Novo lead', description: newLead.client_name || 'Lead criado' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        queryClient.invalidateQueries({ queryKey: ['trips'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          if (updated.status !== 'pending') {
            toast({ title: '✅ Aprovação resolvida', description: updated.title });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, toast]);

  // KPI calculations
  const monthStart = startOfMonth(new Date());
  const leadsThisMonth = leads.filter(l => new Date(l.created_at) >= monthStart).length;
  const wonLeads = leads.filter(l => l.status === 'won').length;
  const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;
  const pipeline = trips
    .filter(t => t.status === 'confirmed' || t.status === 'active' || t.status === 'in_progress')
    .reduce((sum, t) => sum + (t.total_value || 0), 0);
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const overdueTasks = allTasks.filter(t => {
    if (t.status === 'done' || !t.due_date) return false;
    return isBefore(new Date(t.due_date), startOfDay(new Date()));
  });

  const urgentTrips = trips.filter(t => t.urgency === 'D-1' || t.urgency === 'D-3');
  const blockedTrips = trips.filter(t => t.has_blocker);

  // Upcoming trips next 30 days
  const in30Days = addDays(new Date(), 30);
  const upcomingTrips = trips
    .filter(t => t.start_date && new Date(t.start_date) >= new Date() && new Date(t.start_date) <= in30Days)
    .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime());

  // Leads by status
  const leadsByStatus = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const leadStatusLabels: Record<string, string> = {
    new: 'Novos', contacted: 'Contactados', qualified: 'Qualificados',
    proposal_sent: 'Proposta Enviada', negotiation: 'Negociação', won: 'Ganhos', lost: 'Perdidos',
  };
  const leadStatusColors: Record<string, string> = {
    new: 'bg-[hsl(var(--info))]', contacted: 'bg-[hsl(var(--warning))]', qualified: 'bg-purple-500',
    proposal_sent: 'bg-[hsl(var(--urgent))]', negotiation: 'bg-purple-500', won: 'bg-[hsl(var(--success))]', lost: 'bg-destructive',
  };

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
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Daily Command Center</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: pt })}</p>
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

        {subPage === 'overview' && (
          <>
            {/* 5 KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              <KPICard icon={Users} label="Leads este mês" value={leadsThisMonth} loading={loading} variant="info" />
              <KPICard icon={TrendingUp} label="Taxa de conversão" value={`${conversionRate}%`} subtitle={`${wonLeads}/${leads.length}`} loading={loading} variant="success" />
              <KPICard icon={DollarSign} label="Pipeline" value={`€${pipeline.toLocaleString('pt-PT')}`} loading={loading} variant="warning" />
              <KPICard icon={CheckCircle} label="Aprovações pendentes" value={pendingApprovals.length} loading={loading} variant={pendingApprovals.length > 0 ? 'urgent' : 'default'} />
              <KPICard icon={ListTodo} label="Tarefas atrasadas" value={overdueTasks.length} loading={loading} variant={overdueTasks.length > 0 ? 'urgent' : 'default'} />
            </div>

            {/* Urgent + Blocked */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Viagens Urgentes</h2>
                  <Link to="/trips" className="text-xs text-[hsl(var(--info))] hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="space-y-2">
                  {urgentTrips.map(trip => (
                    <Link key={trip.id} to={`/trips/${trip.id}`} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusBadge {...(urgencyConfig[trip.urgency as keyof typeof urgencyConfig] || urgencyConfig['future'])} />
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{trip.client_name}</p><p className="text-xs text-muted-foreground">{trip.destination} · {trip.pax} pax</p></div>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0 ml-2">{trip.start_date}</p>
                    </Link>
                  ))}
                  {urgentTrips.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem viagens urgentes 🎉</p>}
                </div>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Items Bloqueados</h2>
                </div>
                <div className="space-y-2">
                  {blockedTrips.map(trip => (
                    <Link key={trip.id} to={`/trips/${trip.id}`} className="flex items-center justify-between p-3 rounded-md border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                      <div className="min-w-0"><p className="text-sm font-medium truncate">{trip.client_name}</p><p className="text-xs text-destructive mt-0.5">{trip.blocker_note}</p></div>
                    </Link>
                  ))}
                  {blockedTrips.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem bloqueios ✓</p>}
                </div>
              </div>
            </div>

            {/* Approvals + Upcoming */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Aprovações Pendentes</h2>
                  <Link to="/approvals" className="text-xs text-[hsl(var(--info))] hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="space-y-2">
                  {pendingApprovals.slice(0, 4).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusBadge {...(approvalTypeConfig[item.type as keyof typeof approvalTypeConfig] || approvalTypeConfig['itinerary'])} />
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{item.title}</p><p className="text-xs text-muted-foreground">{item.client_name}</p></div>
                      </div>
                      <Link to="/approvals" className="text-xs font-medium text-[hsl(var(--info))] hover:underline shrink-0 ml-2">Rever</Link>
                    </div>
                  ))}
                  {pendingApprovals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Tudo em dia! ✓</p>}
                </div>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Próximas Viagens (30 dias)</h2>
                </div>
                <div className="space-y-2">
                  {upcomingTrips.slice(0, 5).map(trip => (
                    <Link key={trip.id} to={`/trips/${trip.id}`} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                      <div className="min-w-0"><p className="text-sm font-medium truncate">{trip.client_name}</p><p className="text-xs text-muted-foreground">{trip.destination}</p></div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-medium">{trip.start_date}</p>
                        <p className="text-[10px] text-muted-foreground">€{(trip.total_value || 0).toLocaleString()}</p>
                      </div>
                    </Link>
                  ))}
                  {upcomingTrips.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem viagens próximas</p>}
                </div>
              </div>
            </div>

            {/* Leads by status + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-card rounded-lg border p-4">
                <h2 className="text-sm font-semibold mb-3">Leads por Estado</h2>
                <div className="space-y-2">
                  {Object.entries(leadsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", leadStatusColors[status] || 'bg-muted-foreground')} />
                      <span className="text-xs flex-1">{leadStatusLabels[status] || status}</span>
                      <span className="text-xs font-bold">{count}</span>
                    </div>
                  ))}
                  {Object.keys(leadsByStatus).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Ainda sem leads</p>}
                </div>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <h2 className="text-sm font-semibold mb-3">Atividade Recente</h2>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {activityLogs.slice(0, 25).map(log => (
                    <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--info))] mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs truncate">{log.action_type}</p>
                        {log.entity_type && log.entity_id && (
                          <Link to={`/${log.entity_type === 'lead' ? 'leads' : log.entity_type === 'trip' ? 'trips' : log.entity_type === 'approval' ? 'approvals' : 'tasks'}/${log.entity_id}`}
                            className="text-[10px] text-[hsl(var(--info))] hover:underline">
                            {log.entity_type} →
                          </Link>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: pt })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {activityLogs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem atividade recente</p>}
                </div>
              </div>
            </div>
          </>
        )}

        {subPage === 'calendar_reservas' && <MonthlyCalendar events={calendarEvents} />}
        {subPage === 'calendar_tasks' && <TasksBoard />}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
