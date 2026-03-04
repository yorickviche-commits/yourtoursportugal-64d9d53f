import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, AlertTriangle, Clock, Plus,
  Briefcase, Users, Loader2,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTasksQuery, useCreateTask, useUpdateTask, type DbTask } from '@/hooks/useTasksQuery';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  CATEGORY_CONFIG, PRIORITY_CONFIG, TaskCard,
  type OperationalTask, type TaskCategory, type TaskPriority, type TaskStatus, type TaskTeam,
} from '@/components/dashboard/TasksBoard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type SubPage = 'sales' | 'operations';

const KANBAN_COLUMNS = [
  { key: 'pending' as const, label: 'A Fazer' },
  { key: 'in_progress' as const, label: 'Em Progresso' },
  { key: 'done' as const, label: 'Concluído' },
  { key: 'blocked' as const, label: 'Bloqueado' },
];

const dbToUiTask = (t: DbTask): OperationalTask => ({
  id: t.id,
  title: t.title,
  date: t.due_date || t.created_at.split('T')[0],
  category: (t.category as TaskCategory) || 'geral',
  priority: (t.priority as TaskPriority) || 'medium',
  status: (t.status as TaskStatus) || 'pending',
  team: (t.team as TaskTeam) || 'operations',
  tripId: t.trip_id || undefined,
  assignedTo: t.assigned_to || undefined,
});

const TasksPage = () => {
  const [subPage, setSubPage] = useState<SubPage>('operations');
  const { data: dbTasks = [], isLoading } = useTasksQuery();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>('pending');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newCategory, setNewCategory] = useState<TaskCategory>('geral');

  const tasks = useMemo(() => dbTasks.map(dbToUiTask), [dbTasks]);

  const toggleTask = (taskId: string) => {
    const task = dbTasks.find(t => t.id === taskId);
    if (!task) return;
    updateTask.mutate({ id: taskId, updates: { status: task.status === 'done' ? 'pending' : 'done' } });
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: newTitle.trim(),
        team: subPage,
        priority: newPriority,
        category: newCategory,
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0],
      });
      toast({ title: '✅ Task criada!' });
      setNewTitle('');
      setNewTaskOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const teamTasks = tasks
    .filter(t => t.team === subPage)
    .filter(t => filterPriority === 'all' || t.priority === filterPriority);

  const getColumnTasks = (status: TaskStatus) =>
    teamTasks.filter(t => t.status === status).sort((a, b) => {
      const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
    });

  const urgent = teamTasks.filter(t => t.priority === 'urgent' && t.status !== 'done');
  const pending = teamTasks.filter(t => t.status !== 'done');
  const done = teamTasks.filter(t => t.status === 'done');

  if (isLoading) {
    return <AppLayout><div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Tasks & Pipeline</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gestão de tarefas por equipa</p>
          </div>
          <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs gap-1 min-h-[44px] sm:min-h-0"><Plus className="h-3 w-3" /> Nova Task</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4 sm:mx-auto">
              <DialogHeader><DialogTitle className="text-sm">Nova Task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Título da task..." value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-10 sm:h-8 text-sm sm:text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newPriority} onValueChange={v => setNewPriority(v as TaskPriority)}>
                    <SelectTrigger className="h-10 sm:h-8 text-sm sm:text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newCategory} onValueChange={v => setNewCategory(v as TaskCategory)}>
                    <SelectTrigger className="h-10 sm:h-8 text-sm sm:text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" className="text-xs w-full min-h-[44px] sm:min-h-0" onClick={handleCreateTask} disabled={createTask.isPending || !newTitle.trim()}>
                  {createTask.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Criar Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sub-page tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button onClick={() => setSubPage('operations')}
            className={cn("px-3 sm:px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5",
              subPage === 'operations' ? "border-[hsl(var(--info))] text-[hsl(var(--info))]" : "border-transparent text-muted-foreground hover:text-foreground"
            )}><Briefcase className="h-3.5 w-3.5" /> Operations</button>
          <button onClick={() => setSubPage('sales')}
            className={cn("px-3 sm:px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5",
              subPage === 'sales' ? "border-[hsl(var(--warning))] text-[hsl(var(--warning))]" : "border-transparent text-muted-foreground hover:text-foreground"
            )}><Users className="h-3.5 w-3.5" /> Sales</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div><p className="text-lg font-bold">{urgent.length}</p><p className="text-[10px] text-muted-foreground">Urgentes</p></div>
          </div>
          <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />
            <div><p className="text-lg font-bold">{pending.length}</p><p className="text-[10px] text-muted-foreground">Pendentes</p></div>
          </div>
          <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <Circle className="h-4 w-4 text-[hsl(var(--info))]" />
            <div><p className="text-lg font-bold">{teamTasks.length}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
          </div>
          <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
            <div><p className="text-lg font-bold">{done.length}</p><p className="text-[10px] text-muted-foreground">Concluídas</p></div>
          </div>
        </div>

        {/* Kanban Board */}
        {isMobile ? (
          /* Mobile: Tab bar switching columns */
          <div>
            <div className="flex items-center gap-1 border-b border-border mb-3 overflow-x-auto">
              {KANBAN_COLUMNS.map(col => (
                <button key={col.key} onClick={() => setMobileColumn(col.key)}
                  className={cn("px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                    mobileColumn === col.key ? "border-[hsl(var(--info))] text-[hsl(var(--info))]" : "border-transparent text-muted-foreground"
                  )}>
                  {col.label} ({getColumnTasks(col.key).length})
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {getColumnTasks(mobileColumn).map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} />)}
              {getColumnTasks(mobileColumn).length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sem tasks</p>}
            </div>
          </div>
        ) : (
          /* Desktop: Side-by-side columns */
          <div className="grid grid-cols-4 gap-3">
            {KANBAN_COLUMNS.map(col => (
              <div key={col.key}>
                <div className="rounded-t-lg px-3 py-2 border border-b-0 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{col.label}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{getColumnTasks(col.key).length}</span>
                  </div>
                </div>
                <div className="bg-card border rounded-b-lg p-2 space-y-1.5 min-h-[200px]">
                  {getColumnTasks(col.key).map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} />)}
                  {getColumnTasks(col.key).length === 0 && <p className="text-[10px] text-muted-foreground text-center py-6">Sem tasks</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        <div className="bg-card rounded-lg border">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Todas as Tasks — {subPage === 'operations' ? 'Operations' : 'Sales'}</h3>
          </div>
          <div className="divide-y divide-border">
            {teamTasks.sort((a, b) => {
              const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
              if (a.status === 'done' && b.status !== 'done') return 1;
              if (a.status !== 'done' && b.status === 'done') return -1;
              return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
            }).map(task => {
              const catCfg = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.geral;
              const priCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
              const CatIcon = catCfg.icon;

              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <button onClick={() => toggleTask(task.id)} className="shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center">
                    {task.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium", task.status === 'done' && "line-through text-muted-foreground")}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CatIcon className={cn("h-3 w-3", catCfg.color)} />
                      <span className="text-[10px] text-muted-foreground">{catCfg.label}</span>
                      {task.tripId && <Link to={`/trips/${task.tripId}`} className="text-[10px] text-[hsl(var(--info))] hover:underline">trip →</Link>}
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded hidden sm:inline", priCfg.bgClass, priCfg.textClass)}>{priCfg.label}</span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">{task.date}</span>
                </div>
              );
            })}
            {teamTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sem tasks para esta equipa</p>}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TasksPage;
