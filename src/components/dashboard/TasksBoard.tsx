import { useState, useMemo } from 'react';
import { format, isSameDay, parseISO, addDays, isToday, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle, Clock, FileText, Users, Truck, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type TaskCategory = 'reservas_fse' | 'briefing_fse' | 'briefing_guia' | 'briefing_cliente' | 'checklist' | 'geral';
type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
type TaskStatus = 'pending' | 'in_progress' | 'done';

interface OperationalTask {
  id: string;
  title: string;
  date: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  tripId?: string;
  clientName?: string;
  assignedTo?: string;
}

const CATEGORY_CONFIG: Record<TaskCategory, { label: string; icon: React.ElementType; color: string }> = {
  reservas_fse: { label: 'Reservas FSEs', icon: ClipboardList, color: 'text-[hsl(var(--info))]' },
  briefing_fse: { label: 'Briefing FSEs', icon: FileText, color: 'text-purple-500' },
  briefing_guia: { label: 'Briefing Guia', icon: Users, color: 'text-orange-500' },
  briefing_cliente: { label: 'Briefing Cliente', icon: FileText, color: 'text-green-500' },
  checklist: { label: 'Checklist', icon: CheckCircle2, color: 'text-teal-500' },
  geral: { label: 'Geral', icon: Clock, color: 'text-muted-foreground' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; bgClass: string; textClass: string }> = {
  urgent: { label: 'Urgente', bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
  high: { label: 'Alta', bgClass: 'bg-[hsl(var(--warning))]/10', textClass: 'text-[hsl(var(--warning))]' },
  medium: { label: 'Média', bgClass: 'bg-[hsl(var(--info))]/10', textClass: 'text-[hsl(var(--info))]' },
  low: { label: 'Baixa', bgClass: 'bg-muted', textClass: 'text-muted-foreground' },
};

// Mock tasks
const MOCK_TASKS: OperationalTask[] = [
  { id: 'tk1', title: 'Confirmar hotel upgrade Wright', date: '2026-02-28', category: 'reservas_fse', priority: 'urgent', status: 'pending', tripId: 'T-002', clientName: 'James & Claire Wright', assignedTo: 'João P.' },
  { id: 'tk2', title: 'Enviar briefing guia Douro Valley', date: '2026-02-28', category: 'briefing_guia', priority: 'urgent', status: 'pending', tripId: 'T-002', clientName: 'James & Claire Wright', assignedTo: 'Maria S.' },
  { id: 'tk3', title: 'Briefing final cliente Wright', date: '2026-02-28', category: 'briefing_cliente', priority: 'high', status: 'in_progress', tripId: 'T-002', clientName: 'James & Claire Wright', assignedTo: 'Maria S.' },
  { id: 'tk4', title: 'Confirmar guia Sintra Novak', date: '2026-03-01', category: 'reservas_fse', priority: 'urgent', status: 'pending', tripId: 'T-005', clientName: 'The Novak Family', assignedTo: 'João P.' },
  { id: 'tk5', title: 'Reservar wine tour Henderson', date: '2026-03-02', category: 'reservas_fse', priority: 'high', status: 'pending', tripId: 'T-001', clientName: 'The Henderson Family', assignedTo: 'Maria S.' },
  { id: 'tk6', title: 'Briefing FSE transporte Henderson', date: '2026-03-02', category: 'briefing_fse', priority: 'high', status: 'pending', tripId: 'T-001', clientName: 'The Henderson Family', assignedTo: 'João P.' },
  { id: 'tk7', title: 'Checklist pre-arrival Henderson', date: '2026-03-03', category: 'checklist', priority: 'medium', status: 'pending', tripId: 'T-001', clientName: 'The Henderson Family', assignedTo: 'Maria S.' },
  { id: 'tk8', title: 'Briefing cliente Henderson', date: '2026-03-02', category: 'briefing_cliente', priority: 'medium', status: 'pending', tripId: 'T-001', clientName: 'The Henderson Family', assignedTo: 'Maria S.' },
  { id: 'tk9', title: 'Follow-up proposta Mitchell', date: '2026-03-01', category: 'geral', priority: 'medium', status: 'pending', tripId: 'T-003', clientName: 'Sarah Mitchell Group', assignedTo: 'Maria S.' },
  { id: 'tk10', title: 'Preparar briefing guia Novak', date: '2026-03-04', category: 'briefing_guia', priority: 'high', status: 'pending', tripId: 'T-005', clientName: 'The Novak Family', assignedTo: 'João P.' },
  { id: 'tk11', title: 'Verificar transfers Novak', date: '2026-03-04', category: 'checklist', priority: 'medium', status: 'pending', tripId: 'T-005', clientName: 'The Novak Family', assignedTo: 'João P.' },
  { id: 'tk12', title: 'Confirmar restaurante DOC Wright', date: '2026-02-28', category: 'reservas_fse', priority: 'high', status: 'done', tripId: 'T-002', clientName: 'James & Claire Wright', assignedTo: 'Maria S.' },
];

const TasksBoard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<OperationalTask[]>(MOCK_TASKS);
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');

  // 7-day view from selected date
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfDay(selectedDate), i)), [selectedDate]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
    ));
  };

  const getTasksForDay = (day: Date) => {
    return tasks
      .filter(t => isSameDay(parseISO(t.date), day))
      .filter(t => filterCategory === 'all' || t.category === filterCategory)
      .filter(t => filterPriority === 'all' || t.priority === filterPriority)
      .sort((a, b) => {
        const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        return pOrder[a.priority] - pOrder[b.priority];
      });
  };

  // Stats
  const allFiltered = tasks
    .filter(t => filterCategory === 'all' || t.category === filterCategory)
    .filter(t => filterPriority === 'all' || t.priority === filterPriority);
  const todayTasks = allFiltered.filter(t => isSameDay(parseISO(t.date), new Date()));
  const overdueTasks = allFiltered.filter(t => isBefore(parseISO(t.date), startOfDay(new Date())) && t.status !== 'done');
  const pendingCount = allFiltered.filter(t => t.status !== 'done').length;
  const doneCount = allFiltered.filter(t => t.status === 'done').length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <div>
            <p className="text-lg font-bold">{overdueTasks.length}</p>
            <p className="text-[10px] text-muted-foreground">Atrasadas</p>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
          <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />
          <div>
            <p className="text-lg font-bold">{todayTasks.filter(t => t.status !== 'done').length}</p>
            <p className="text-[10px] text-muted-foreground">Hoje pendentes</p>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
          <Circle className="h-4 w-4 text-[hsl(var(--info))]" />
          <div>
            <p className="text-lg font-bold">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground">Total pendentes</p>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
          <div>
            <p className="text-lg font-bold">{doneCount}</p>
            <p className="text-[10px] text-muted-foreground">Concluídas</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Categoria:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterCategory('all')}
              className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                filterCategory === 'all' ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >Todas</button>
            {(Object.entries(CATEGORY_CONFIG) as [TaskCategory, typeof CATEGORY_CONFIG[TaskCategory]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                  filterCategory === key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >{cfg.label}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Prioridade:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterPriority('all')}
              className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                filterPriority === 'all' ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >Todas</button>
            {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setFilterPriority(key)}
                className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                  filterPriority === key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >{cfg.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1.5 text-xs font-medium rounded-full border border-border hover:bg-muted transition-colors">
          Hoje
        </button>
        <button onClick={() => setSelectedDate(d => addDays(d, -7))} className="p-1 hover:bg-muted rounded transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => setSelectedDate(d => addDays(d, 7))} className="p-1 hover:bg-muted rounded transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold capitalize">
          {format(days[0], "d MMM", { locale: pt })} – {format(days[6], "d MMM yyyy", { locale: pt })}
        </h3>
      </div>

      {/* 7-day columns */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayTasks = getTasksForDay(day);
          const isT = isToday(day);
          const isPast = isBefore(day, startOfDay(new Date()));
          const allDone = dayTasks.length > 0 && dayTasks.every(t => t.status === 'done');

          return (
            <div key={day.toISOString()} className={cn(
              "bg-card border rounded-lg overflow-hidden min-h-[200px]",
              isT && "border-[hsl(var(--info))] ring-1 ring-[hsl(var(--info))]/30",
              allDone && "border-[hsl(var(--success))]/50"
            )}>
              {/* Day header */}
              <div className={cn(
                "px-2 py-2 text-center border-b border-border",
                isT && "bg-[hsl(var(--info))]/10",
                allDone && "bg-[hsl(var(--success))]/10"
              )}>
                <p className="text-[10px] text-muted-foreground uppercase">
                  {format(day, 'EEE', { locale: pt })}
                </p>
                <p className={cn("text-sm font-bold", isT && "text-[hsl(var(--info))]")}>
                  {format(day, 'd')}
                </p>
                {allDone && <p className="text-[9px] text-[hsl(var(--success))] font-medium">✓ Tudo feito</p>}
              </div>

              {/* Tasks */}
              <div className="p-1.5 space-y-1">
                {dayTasks.map(task => {
                  const catCfg = CATEGORY_CONFIG[task.category];
                  const priCfg = PRIORITY_CONFIG[task.priority];
                  const CatIcon = catCfg.icon;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "rounded p-1.5 border transition-all cursor-pointer group",
                        task.status === 'done'
                          ? "bg-muted/50 border-border opacity-60"
                          : cn(priCfg.bgClass, "border-transparent hover:border-border")
                      )}
                    >
                      <div className="flex items-start gap-1">
                        <button onClick={() => toggleTask(task.id)} className="mt-0.5 shrink-0">
                          {task.status === 'done' ? (
                            <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" />
                          ) : (
                            <Circle className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "text-[10px] font-medium leading-tight",
                            task.status === 'done' && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <CatIcon className={cn("h-2.5 w-2.5", catCfg.color)} />
                            <span className={cn("text-[8px] font-medium", priCfg.textClass)}>
                              {priCfg.label}
                            </span>
                          </div>
                          {task.tripId && (
                            <Link to={`/trips/${task.tripId}`} className="text-[8px] text-[hsl(var(--info))] hover:underline">
                              {task.tripId}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {dayTasks.length === 0 && (
                  <p className="text-[9px] text-muted-foreground text-center py-4">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TasksBoard;
