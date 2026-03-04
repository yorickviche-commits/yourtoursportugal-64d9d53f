import { useState, useMemo } from 'react';
import { format, isSameDay, parseISO, addDays, isToday, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle, Clock, FileText, Users, Truck, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useTasksQuery, useUpdateTask, type DbTask } from '@/hooks/useTasksQuery';

export type TaskCategory = 'reservas_fse' | 'briefing_fse' | 'briefing_guia' | 'briefing_cliente' | 'checklist' | 'geral';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type TaskTeam = 'sales' | 'operations';

export interface OperationalTask {
  id: string;
  title: string;
  date: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  team: TaskTeam;
  tripId?: string;
  clientName?: string;
  assignedTo?: string;
}

export const CATEGORY_CONFIG: Record<TaskCategory, { label: string; icon: React.ElementType; color: string }> = {
  reservas_fse: { label: 'Reservas FSEs', icon: ClipboardList, color: 'text-[hsl(var(--info))]' },
  briefing_fse: { label: 'Briefing FSEs', icon: FileText, color: 'text-purple-500' },
  briefing_guia: { label: 'Briefing Guia', icon: Users, color: 'text-orange-500' },
  briefing_cliente: { label: 'Briefing Cliente', icon: FileText, color: 'text-green-500' },
  checklist: { label: 'Checklist', icon: CheckCircle2, color: 'text-teal-500' },
  geral: { label: 'Geral', icon: Clock, color: 'text-muted-foreground' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; bgClass: string; textClass: string }> = {
  urgent: { label: 'Urgente', bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
  high: { label: 'Alta', bgClass: 'bg-[hsl(var(--warning))]/10', textClass: 'text-[hsl(var(--warning))]' },
  medium: { label: 'Média', bgClass: 'bg-[hsl(var(--info))]/10', textClass: 'text-[hsl(var(--info))]' },
  low: { label: 'Baixa', bgClass: 'bg-muted', textClass: 'text-muted-foreground' },
};

// Convert DB task to UI task
const dbToUiTask = (t: DbTask): OperationalTask => ({
  id: t.id,
  title: t.title,
  date: t.due_date || t.created_at.split('T')[0],
  category: (t.category as TaskCategory) || 'geral',
  priority: (t.priority as TaskPriority) || 'medium',
  status: (t.status as TaskStatus) || 'pending',
  team: (t.team as TaskTeam) || 'operations',
  tripId: t.trip_id || undefined,
  clientName: undefined,
  assignedTo: t.assigned_to || undefined,
});

// ─── Shared Task Card Component ───
export const TaskCard = ({ task, onToggle }: { task: OperationalTask; onToggle: (id: string) => void }) => {
  const catCfg = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.geral;
  const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const CatIcon = catCfg.icon;

  return (
    <div className={cn(
      "rounded p-1.5 border transition-all cursor-pointer group",
      task.status === 'done'
        ? "bg-muted/50 border-border opacity-60"
        : cn(priCfg.bgClass, "border-transparent hover:border-border")
    )}>
      <div className="flex items-start gap-1">
        <button onClick={() => onToggle(task.id)} className="mt-0.5 shrink-0">
          {task.status === 'done'
            ? <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" />
            : <Circle className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
          }
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[10px] font-medium leading-tight", task.status === 'done' && "line-through text-muted-foreground")}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <CatIcon className={cn("h-2.5 w-2.5", catCfg.color)} />
            <span className={cn("text-[8px] font-medium", priCfg.textClass)}>{priCfg.label}</span>
            {task.assignedTo && <span className="text-[8px] text-muted-foreground">· {task.assignedTo}</span>}
          </div>
          {task.tripId && (
            <Link to={`/trips/${task.tripId}`} className="text-[8px] text-[hsl(var(--info))] hover:underline">
              {task.tripId.substring(0, 8)}...
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── TasksBoard for Dashboard Calendar ───
const TasksBoard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: dbTasks = [] } = useTasksQuery();
  const updateTask = useUpdateTask();
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');

  const tasks = useMemo(() => dbTasks.map(dbToUiTask), [dbTasks]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfDay(selectedDate), i)), [selectedDate]);

  const toggleTask = (taskId: string) => {
    const task = dbTasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    updateTask.mutate({ id: taskId, updates: { status: newStatus } });
  };

  const getTasksForDay = (day: Date, team?: TaskTeam) => {
    return tasks
      .filter(t => {
        try { return isSameDay(parseISO(t.date), day); } catch { return false; }
      })
      .filter(t => !team || t.team === team)
      .filter(t => filterCategory === 'all' || t.category === filterCategory)
      .filter(t => filterPriority === 'all' || t.priority === filterPriority)
      .sort((a, b) => {
        const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
      });
  };

  const allFiltered = tasks
    .filter(t => filterCategory === 'all' || t.category === filterCategory)
    .filter(t => filterPriority === 'all' || t.priority === filterPriority);
  const todayTasks = allFiltered.filter(t => { try { return isSameDay(parseISO(t.date), new Date()); } catch { return false; } });
  const overdueTasks = allFiltered.filter(t => { try { return isBefore(parseISO(t.date), startOfDay(new Date())) && t.status !== 'done'; } catch { return false; } });
  const pendingCount = allFiltered.filter(t => t.status !== 'done').length;
  const doneCount = allFiltered.filter(t => t.status === 'done').length;

  const renderDaySection = (day: Date, team: TaskTeam, label: string, labelColor: string) => {
    const teamTasks = getTasksForDay(day, team);
    if (teamTasks.length === 0) return null;
    return (
      <div>
        <p className={cn("text-[8px] font-bold uppercase px-1 py-0.5 rounded mb-0.5", labelColor)}>{label}</p>
        <div className="space-y-0.5">
          {teamTasks.map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} />)}
        </div>
      </div>
    );
  };

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
            <button onClick={() => setFilterCategory('all')}
              className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                filterCategory === 'all' ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}>Todas</button>
            {(Object.entries(CATEGORY_CONFIG) as [TaskCategory, typeof CATEGORY_CONFIG[TaskCategory]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setFilterCategory(key)}
                className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                  filterCategory === key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                )}>{cfg.label}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Prioridade:</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterPriority('all')}
              className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                filterPriority === 'all' ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}>Todas</button>
            {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setFilterPriority(key)}
                className={cn("px-2 py-1 text-[10px] rounded-full border transition-colors",
                  filterPriority === key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                )}>{cfg.label}</button>
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
          const allDayTasks = getTasksForDay(day);
          const isT = isToday(day);
          const allDone = allDayTasks.length > 0 && allDayTasks.every(t => t.status === 'done');

          return (
            <div key={day.toISOString()} className={cn(
              "bg-card border rounded-lg overflow-hidden min-h-[200px]",
              isT && "border-[hsl(var(--info))] ring-1 ring-[hsl(var(--info))]/30",
              allDone && "border-[hsl(var(--success))]/50"
            )}>
              <div className={cn(
                "px-2 py-2 text-center border-b border-border",
                isT && "bg-[hsl(var(--info))]/10",
                allDone && "bg-[hsl(var(--success))]/10"
              )}>
                <p className="text-[10px] text-muted-foreground uppercase">{format(day, 'EEE', { locale: pt })}</p>
                <p className={cn("text-sm font-bold", isT && "text-[hsl(var(--info))]")}>{format(day, 'd')}</p>
                {allDone && <p className="text-[9px] text-[hsl(var(--success))] font-medium">✓ Tudo feito</p>}
              </div>
              <div className="p-1.5 space-y-2">
                {renderDaySection(day, 'operations', '⚙ Operations', 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]')}
                {getTasksForDay(day, 'operations').length > 0 && getTasksForDay(day, 'sales').length > 0 && (
                  <div className="border-t border-border my-1" />
                )}
                {renderDaySection(day, 'sales', '💼 Sales', 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]')}
                {allDayTasks.length === 0 && (
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
