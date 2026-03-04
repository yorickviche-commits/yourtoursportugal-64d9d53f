import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Users, Send, TrendingUp, Calendar as CalendarIcon, ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
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

type DashboardSubPage = 'overview' | 'calendar_reservas' | 'calendar_tasks';

const StatCard = ({ icon: Icon, label, value, variant = 'default' }: { icon: React.ElementType; label: string; value: number; variant?: 'default' | 'urgent' | 'warning' | 'success' | 'info' }) => {
  const variants = { default: 'bg-card border-border', urgent: 'bg-card border-destructive/30', warning: 'bg-card border-urgent/30', success: 'bg-card border-success/30', info: 'bg-card border-info/30' };
  const iconVariants = { default: 'text-muted-foreground', urgent: 'text-destructive', warning: 'text-urgent', success: 'text-success', info: 'text-info' };
  return (
    <div className={`rounded-lg border p-4 ${variants[variant]}`}>
      <div className="flex items-center justify-between">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-1">{value}</p></div>
        <Icon className={`h-5 w-5 ${iconVariants[variant]}`} />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [subPage, setSubPage] = useState<DashboardSubPage>('overview');
  const { data: trips = [], isLoading: tripsLoading } = useTripsQuery();
  const { data: approvals = [] } = useApprovalsQuery();
  const { data: leads = [] } = useLeadsQuery();

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const urgentTrips = trips.filter(t => t.urgency === 'D-1' || t.urgency === 'D-3');
  const blockedTrips = trips.filter(t => t.has_blocker);

  // Compute stats from real data
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tripsNext7 = trips.filter(t => t.start_date && new Date(t.start_date) >= now && new Date(t.start_date) <= in7Days).length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified').length;
  const proposalsSent = leads.filter(l => l.status === 'proposal_sent').length;

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Daily Command Center</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: pt })}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border">
          {subPageTabs.map(tab => (
            <button key={tab.key} onClick={() => setSubPage(tab.key)} className={cn("px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px", subPage === tab.key ? "border-[hsl(var(--info))] text-[hsl(var(--info))]" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>
          ))}
        </div>

        {subPage === 'overview' && (
          <>
            <div className="grid grid-cols-4 gap-3">
              <StatCard icon={CalendarIcon} label="Trips next 7 days" value={tripsNext7} variant="warning" />
              <StatCard icon={Clock} label="Pending approvals" value={pendingApprovals.length} variant="info" />
              <StatCard icon={CheckCircle} label="Total trips" value={trips.length} variant="default" />
              <StatCard icon={AlertTriangle} label="Blocked items" value={blockedTrips.length} variant="urgent" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Users} label="New leads" value={newLeads} variant="default" />
              <StatCard icon={TrendingUp} label="Qualified" value={qualifiedLeads} variant="success" />
              <StatCard icon={Send} label="Proposals sent" value={proposalsSent} variant="info" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Urgent Trips</h2>
                  <Link to="/trips" className="text-xs text-info hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="space-y-2">
                  {urgentTrips.map(trip => (
                    <Link key={trip.id} to={`/trips/${trip.id}`} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <StatusBadge {...(urgencyConfig[trip.urgency as keyof typeof urgencyConfig] || urgencyConfig['future'])} />
                        <div><p className="text-sm font-medium">{trip.client_name}</p><p className="text-xs text-muted-foreground">{trip.destination} · {trip.pax} pax</p></div>
                      </div>
                      <div className="text-right"><p className="text-xs text-muted-foreground">{trip.start_date}</p></div>
                    </Link>
                  ))}
                  {urgentTrips.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No urgent trips</p>}
                </div>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Blocked Items</h2>
                </div>
                <div className="space-y-2">
                  {blockedTrips.map(trip => (
                    <Link key={trip.id} to={`/trips/${trip.id}`} className="flex items-center justify-between p-3 rounded-md border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                      <div><p className="text-sm font-medium">{trip.client_name}</p><p className="text-xs text-destructive mt-0.5">{trip.blocker_note}</p></div>
                    </Link>
                  ))}
                  {blockedTrips.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No blocked items</p>}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Pending Approvals</h2>
                <Link to="/approvals" className="text-xs text-info hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="space-y-2">
                {pendingApprovals.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <StatusBadge {...(approvalTypeConfig[item.type as keyof typeof approvalTypeConfig] || approvalTypeConfig['itinerary'])} />
                      <div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.client_name} · by {item.submitted_by}</p></div>
                    </div>
                    <Link to="/approvals" className="text-xs font-medium text-info hover:underline">Review</Link>
                  </div>
                ))}
                {pendingApprovals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All caught up!</p>}
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
