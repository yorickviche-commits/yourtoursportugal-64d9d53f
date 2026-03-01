import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Users, Send, TrendingUp, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { mockTrips, mockApprovals, mockStats } from '@/data/mockData';
import { urgencyConfig, statusConfig, approvalTypeConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import MonthlyCalendar, { CalendarEvent, EVENT_COLORS } from '@/components/dashboard/MonthlyCalendar';
import TasksBoard from '@/components/dashboard/TasksBoard';

type DashboardSubPage = 'overview' | 'calendar_reservas' | 'calendar_tasks';

const StatCard = ({
  icon: Icon,
  label,
  value,
  variant = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  variant?: 'default' | 'urgent' | 'warning' | 'success' | 'info';
}) => {
  const variants = {
    default: 'bg-card border-border',
    urgent: 'bg-card border-destructive/30',
    warning: 'bg-card border-urgent/30',
    success: 'bg-card border-success/30',
    info: 'bg-card border-info/30',
  };
  const iconVariants = {
    default: 'text-muted-foreground',
    urgent: 'text-destructive',
    warning: 'text-urgent',
    success: 'text-success',
    info: 'text-info',
  };

  return (
    <div className={`rounded-lg border p-4 ${variants[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${iconVariants[variant]}`} />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [subPage, setSubPage] = useState<DashboardSubPage>('overview');

  const urgentTrips = mockTrips.filter((t) => t.urgency === 'D-1' || t.urgency === 'D-3');
  const blockedTrips = mockTrips.filter((t) => t.hasBlocker);

  // Build calendar events from trips
  const calendarEvents: CalendarEvent[] = mockTrips.map((t, idx) => ({
    id: t.id,
    title: `${t.clientName} - ${t.destination}`,
    startDate: t.startDate,
    endDate: t.endDate,
    color: EVENT_COLORS[idx % EVENT_COLORS.length],
    tripId: t.id,
    clientName: t.clientName,
    destination: t.destination,
    pax: t.pax,
    status: t.status,
    salesOwner: t.salesOwner,
    totalValue: t.totalValue,
  }));

  const subPageTabs: { key: DashboardSubPage; label: string }[] = [
    { key: 'overview', label: 'Visão Geral' },
    { key: 'calendar_reservas', label: '📅 Calendário Reservas' },
    { key: 'calendar_tasks', label: '📋 Calendário Tasks' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Daily Command Center</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: pt })}
            </p>
          </div>
        </div>

        {/* Sub-page tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {subPageTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSubPage(tab.key)}
              className={cn(
                "px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
                subPage === tab.key
                  ? "border-[hsl(var(--info))] text-[hsl(var(--info))]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {subPage === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard icon={CalendarIcon} label="Trips next 7 days" value={mockStats.tripsNext7Days} variant="warning" />
              <StatCard icon={Clock} label="Pending approvals" value={mockStats.pendingApprovals} variant="info" />
              <StatCard icon={CheckCircle} label="Pending reservations" value={mockStats.pendingReservations} variant="default" />
              <StatCard icon={AlertTriangle} label="Blocked items" value={mockStats.blockedItems} variant="urgent" />
            </div>

            {/* Sales snapshot */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Users} label="New leads" value={mockStats.newLeads} variant="default" />
              <StatCard icon={TrendingUp} label="Qualified" value={mockStats.qualifiedLeads} variant="success" />
              <StatCard icon={Send} label="Proposals sent" value={mockStats.proposalsSent} variant="info" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Urgent Trips */}
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Urgent Trips</h2>
                  <Link to="/trips" className="text-xs text-info hover:underline flex items-center gap-1">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {urgentTrips.map((trip) => (
                    <Link
                      key={trip.id}
                      to={`/trips/${trip.id}`}
                      className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <StatusBadge {...urgencyConfig[trip.urgency]} />
                        <div>
                          <p className="text-sm font-medium">{trip.clientName}</p>
                          <p className="text-xs text-muted-foreground">{trip.destination} · {trip.pax} pax</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{trip.startDate}</p>
                        <StatusBadge {...statusConfig[trip.status]} />
                      </div>
                    </Link>
                  ))}
                  {urgentTrips.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No urgent trips</p>
                  )}
                </div>
              </div>

              {/* Blocked Items */}
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Blocked Items
                  </h2>
                </div>
                <div className="space-y-2">
                  {blockedTrips.map((trip) => (
                    <Link
                      key={trip.id}
                      to={`/trips/${trip.id}`}
                      className="flex items-center justify-between p-3 rounded-md border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{trip.clientName}</p>
                        <p className="text-xs text-destructive mt-0.5">{trip.blockerNote}</p>
                      </div>
                      <StatusBadge {...urgencyConfig[trip.urgency]} />
                    </Link>
                  ))}
                  {blockedTrips.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No blocked items</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Pending Approvals</h2>
                <Link to="/approvals" className="text-xs text-info hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {mockApprovals.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge {...approvalTypeConfig[item.type]} />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.clientName} · by {item.submittedBy}</p>
                      </div>
                    </div>
                    <Link
                      to="/approvals"
                      className="text-xs font-medium text-info hover:underline"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Calendar Reservas */}
        {subPage === 'calendar_reservas' && (
          <MonthlyCalendar events={calendarEvents} />
        )}

        {/* Calendar Tasks */}
        {subPage === 'calendar_tasks' && (
          <TasksBoard />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
