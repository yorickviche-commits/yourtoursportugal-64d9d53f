import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Users, Send, TrendingUp, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { format, isSameDay, parseISO, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { mockTrips, mockApprovals, mockStats } from '@/data/mockData';
import { urgencyConfig, statusConfig, approvalTypeConfig } from '@/lib/config';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type DashboardSubPage = 'overview' | 'calendar_reservas' | 'calendar_tasks';

// Mock tasks/urgencies data
const mockTasks = [
  { id: 't1', date: '2026-02-28', title: 'Confirmar hotel upgrade T-002', priority: 'urgent' as const, tripId: 'T-002' },
  { id: 't2', date: '2026-02-28', title: 'Enviar proposta Sarah Mitchell', priority: 'warning' as const, tripId: 'T-003' },
  { id: 't3', date: '2026-03-01', title: 'Confirmar guia Sintra T-005', priority: 'urgent' as const, tripId: 'T-005' },
  { id: 't4', date: '2026-03-02', title: 'Reservar wine tour Henderson', priority: 'warning' as const, tripId: 'T-001' },
  { id: 't5', date: '2026-03-03', title: 'Check-in Henderson Family', priority: 'info' as const, tripId: 'T-001' },
  { id: 't6', date: '2026-03-05', title: 'Preparar briefing Novak Family', priority: 'warning' as const, tripId: 'T-005' },
  { id: 't7', date: '2026-03-01', title: 'Follow-up Robert Chen proposta', priority: 'info' as const, tripId: 'T-004' },
];

const priorityStyles = {
  urgent: 'border-destructive/40 bg-destructive/5 text-destructive',
  warning: 'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 text-[hsl(var(--warning))]',
  info: 'border-[hsl(var(--info))]/40 bg-[hsl(var(--info))]/5 text-[hsl(var(--info))]',
};

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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const urgentTrips = mockTrips.filter((t) => t.urgency === 'D-1' || t.urgency === 'D-3');
  const blockedTrips = mockTrips.filter((t) => t.hasBlocker);

  // Dates that have confirmed reservations
  const reservationDates = mockTrips
    .filter(t => t.status === 'confirmed' || t.status === 'approved')
    .flatMap(t => {
      const start = parseISO(t.startDate);
      const end = parseISO(t.endDate);
      const dates: Date[] = [];
      let current = start;
      while (current <= end) {
        dates.push(current);
        current = addDays(current, 1);
      }
      return dates;
    });

  // Dates that have tasks
  const taskDates = mockTasks.map(t => parseISO(t.date));

  // Get trips for selected date
  const tripsOnDate = mockTrips.filter(t => {
    const start = parseISO(t.startDate);
    const end = parseISO(t.endDate);
    return selectedDate >= start && selectedDate <= end;
  });

  // Get tasks for selected date
  const tasksOnDate = mockTasks.filter(t => isSameDay(parseISO(t.date), selectedDate));

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
          <div className="grid grid-cols-[auto_1fr] gap-6">
            <div className="bg-card rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Reservas Confirmadas</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="p-3 pointer-events-auto"
                modifiers={{ booked: reservationDates }}
                modifiersClassNames={{ booked: 'bg-[hsl(var(--info))]/20 text-[hsl(var(--info))] font-bold rounded-md' }}
              />
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Dias com reservas assinalados a azul
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: pt })}
              </h3>
              {tripsOnDate.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem reservas neste dia</p>
              ) : (
                tripsOnDate.map(trip => (
                  <Link
                    key={trip.id}
                    to={`/trips/${trip.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge {...urgencyConfig[trip.urgency]} />
                      <div>
                        <p className="text-sm font-medium">{trip.clientName}</p>
                        <p className="text-xs text-muted-foreground">{trip.destination} · {trip.pax} pax</p>
                        <p className="text-[10px] text-muted-foreground">{trip.startDate} → {trip.endDate}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <StatusBadge {...statusConfig[trip.status]} />
                      <p className="text-xs font-medium">{trip.totalValue.toLocaleString()}€</p>
                      <p className="text-[10px] text-muted-foreground">{trip.salesOwner}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* Calendar Tasks */}
        {subPage === 'calendar_tasks' && (
          <div className="grid grid-cols-[auto_1fr] gap-6">
            <div className="bg-card rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Tasks & Urgências</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="p-3 pointer-events-auto"
                modifiers={{ hasTask: taskDates }}
                modifiersClassNames={{ hasTask: 'bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-bold rounded-md' }}
              />
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Dias com tasks assinalados a laranja
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: pt })}
              </h3>
              {tasksOnDate.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem tasks neste dia</p>
              ) : (
                tasksOnDate.map(task => (
                  <Link
                    key={task.id}
                    to={`/trips/${task.tripId}`}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-colors hover:opacity-80",
                      priorityStyles[task.priority]
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground">Trip: {task.tripId}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                      task.priority === 'urgent' && 'bg-destructive/10 text-destructive',
                      task.priority === 'warning' && 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
                      task.priority === 'info' && 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]',
                    )}>
                      {task.priority === 'urgent' ? 'Urgente' : task.priority === 'warning' ? 'Importante' : 'Normal'}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
