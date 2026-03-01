import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type CalendarView = 'month' | 'week' | 'day';

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
  tripId?: string;
  clientName?: string;
  destination?: string;
  pax?: number;
  status?: string;
  salesOwner?: string;
  totalValue?: number;
}

// Color palette matching Google Calendar style
const EVENT_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500',
];

const MonthlyCalendar = ({ events }: { events: CalendarEvent[] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);

  const goToToday = () => setCurrentDate(new Date());

  const navigate = (dir: 'prev' | 'next') => {
    if (view === 'month') setCurrentDate(d => dir === 'next' ? addMonths(d, 1) : subMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => dir === 'next' ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate(d => dir === 'next' ? addDays(d, 1) : addDays(d, -1));
  };

  const headerLabel = useMemo(() => {
    if (view === 'month') return format(currentDate, "MMMM 'de' yyyy", { locale: pt });
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, 'd MMM', { locale: pt })} – ${format(we, 'd MMM yyyy', { locale: pt })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: pt });
  }, [currentDate, view]);

  // Build grid days
  const gridDays = useMemo(() => {
    if (view === 'month') {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      const gs = startOfWeek(ms, { weekStartsOn: 1 });
      const ge = endOfWeek(me, { weekStartsOn: 1 });
      const days: Date[] = [];
      let d = gs;
      while (d <= ge) { days.push(d); d = addDays(d, 1); }
      return days;
    }
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return [currentDate];
  }, [currentDate, view]);

  const getEventsForDay = (day: Date) =>
    events.filter(e => {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopupPos({ x: rect.left, y: rect.bottom + 4 });
    setSelectedEvent(event);
  };

  const weekdays = ['SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.', 'DOM.'];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goToToday} className="px-3 py-1.5 text-xs font-medium rounded-full border border-border hover:bg-muted transition-colors">
            Hoje
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('prev')} className="p-1 hover:bg-muted rounded transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navigate('next')} className="p-1 hover:bg-muted rounded transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-lg font-semibold capitalize">{headerLabel}</h2>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['month', 'week', 'day'] as CalendarView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Weekday headers */}
        {view !== 'day' && (
          <div className={cn("grid border-b border-border", view === 'month' ? 'grid-cols-7' : 'grid-cols-7')}>
            {weekdays.map(wd => (
              <div key={wd} className="py-2 text-center text-[10px] font-medium text-muted-foreground border-r border-border last:border-r-0">
                {wd}
              </div>
            ))}
          </div>
        )}

        {/* Day cells */}
        {view === 'day' ? (
          <div className="p-4 min-h-[400px]">
            <p className="text-sm font-semibold mb-3 capitalize">
              {format(currentDate, "EEEE, d 'de' MMMM", { locale: pt })}
            </p>
            <div className="space-y-1.5">
              {getEventsForDay(currentDate).map(ev => (
                <button
                  key={ev.id}
                  onClick={(e) => handleEventClick(e, ev)}
                  className={cn("w-full text-left px-3 py-2 rounded text-xs text-white font-medium truncate", ev.color)}
                >
                  {ev.title}
                </button>
              ))}
              {getEventsForDay(currentDate).length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem eventos neste dia</p>
              )}
            </div>
          </div>
        ) : (
          <div className={cn("grid", view === 'month' ? 'grid-cols-7' : 'grid-cols-7')}>
            {gridDays.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);
              const maxVisible = view === 'month' ? 3 : 5;
              const visibleEvents = dayEvents.slice(0, maxVisible);
              const moreCount = dayEvents.length - maxVisible;

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[100px] border-r border-b border-border last:border-r-0 p-1",
                    !isCurrentMonth && "bg-muted/30",
                    view === 'week' && "min-h-[300px]"
                  )}
                >
                  <div className="flex justify-center mb-1">
                    <span className={cn(
                      "text-xs w-6 h-6 flex items-center justify-center rounded-full",
                      isToday && "bg-[hsl(var(--info))] text-white font-bold",
                      !isToday && !isCurrentMonth && "text-muted-foreground/50",
                      !isToday && isCurrentMonth && "text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {visibleEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={(e) => handleEventClick(e, ev)}
                        className={cn(
                          "w-full text-left px-1.5 py-0.5 rounded text-[10px] text-white font-medium truncate block",
                          ev.color
                        )}
                        title={ev.title}
                      >
                        {ev.title}
                      </button>
                    ))}
                    {moreCount > 0 && (
                      <p className="text-[10px] text-muted-foreground text-center cursor-pointer hover:text-foreground">
                        Mais {moreCount}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Popup */}
      {selectedEvent && popupPos && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-lg p-4 w-72"
          style={{
            left: Math.min(popupPos.x, window.innerWidth - 300),
            top: Math.min(popupPos.y, window.innerHeight - 250),
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className={cn("w-3 h-3 rounded-sm mt-0.5 shrink-0", selectedEvent.color)} />
            <button onClick={() => { setSelectedEvent(null); setPopupPos(null); }} className="p-0.5 hover:bg-muted rounded">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-2">{selectedEvent.title}</h4>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {selectedEvent.clientName && <p><span className="font-medium text-foreground">Cliente:</span> {selectedEvent.clientName}</p>}
            {selectedEvent.destination && <p><span className="font-medium text-foreground">Destino:</span> {selectedEvent.destination}</p>}
            {selectedEvent.pax && <p><span className="font-medium text-foreground">Pax:</span> {selectedEvent.pax}</p>}
            {selectedEvent.status && <p><span className="font-medium text-foreground">Status:</span> {selectedEvent.status}</p>}
            {selectedEvent.salesOwner && <p><span className="font-medium text-foreground">Owner:</span> {selectedEvent.salesOwner}</p>}
            {selectedEvent.totalValue && <p><span className="font-medium text-foreground">Valor:</span> {selectedEvent.totalValue.toLocaleString()}€</p>}
            <p>
              <span className="font-medium text-foreground">Período:</span>{' '}
              {format(parseISO(selectedEvent.startDate), 'd MMM', { locale: pt })} → {format(parseISO(selectedEvent.endDate), 'd MMM', { locale: pt })}
            </p>
          </div>
          {selectedEvent.tripId && (
            <Link
              to={`/trips/${selectedEvent.tripId}`}
              className="mt-3 block text-center text-xs font-medium text-[hsl(var(--info))] hover:underline"
              onClick={() => { setSelectedEvent(null); setPopupPos(null); }}
            >
              Ver detalhes →
            </Link>
          )}
        </div>
      )}

      {/* Click-away overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 z-40" onClick={() => { setSelectedEvent(null); setPopupPos(null); }} />
      )}
    </div>
  );
};

export default MonthlyCalendar;
export { EVENT_COLORS };
