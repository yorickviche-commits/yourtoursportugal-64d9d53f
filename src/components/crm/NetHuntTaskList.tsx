import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, isThisWeek, isPast } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CheckCircle2, Circle, Plus, RefreshCw, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNHTasks, useCreateNHTask, useUpdateNHTask, useSyncNow, type NHTask } from '@/hooks/useNetHunt';

const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];
const PRI_STYLE: Record<string, string> = {
  high: 'bg-destructive/15 text-destructive',
  urgent: 'bg-destructive/15 text-destructive',
  medium: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
  low: 'bg-muted text-muted-foreground',
};
const PRI_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

type Group = { key: string; label: string; tasks: NHTask[] };

function groupTasks(tasks: NHTask[]): Group[] {
  const g: Record<string, NHTask[]> = { late: [], today: [], tomorrow: [], week: [], later: [], none: [], done: [] };
  for (const t of tasks) {
    if (t.completed) { g.done.push(t); continue; }
    const d = t.due_at ? new Date(t.due_at) : null;
    if (!d) g.none.push(t);
    else if (isToday(d)) g.today.push(t);
    else if (isPast(d)) g.late.push(t);
    else if (isTomorrow(d)) g.tomorrow.push(t);
    else if (isThisWeek(d, { weekStartsOn: 1 })) g.week.push(t);
    else g.later.push(t);
  }
  return [
    { key: 'late', label: 'Atrasadas', tasks: g.late },
    { key: 'today', label: 'Hoje', tasks: g.today },
    { key: 'tomorrow', label: 'Amanhã', tasks: g.tomorrow },
    { key: 'week', label: 'Esta semana', tasks: g.week },
    { key: 'later', label: 'Mais tarde', tasks: g.later },
    { key: 'none', label: 'Sem data', tasks: g.none },
    { key: 'done', label: 'Concluídas', tasks: g.done },
  ].filter(x => x.tasks.length > 0);
}

export default function NetHuntTaskList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const myEmail = (user?.email || '').toLowerCase();
  const { data: tasks = [], isLoading, dataUpdatedAt, refetch } = useNHTasks();
  const createTask = useCreateNHTask();
  const updateTask = useUpdateNHTask();
  const syncNow = useSyncNow();

  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('all');
  const [priority, setPriority] = useState('all');
  const [state, setState] = useState('open');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due: '', allDay: false, priority: 'medium', assignee: '', leadId: '' });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-min-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('id, client_name, yt_id').order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return (data || []) as { id: string; client_name: string; yt_id: string | null }[];
    },
  });
  const leadName = useMemo(() => new Map(leads.map(l => [l.id, `${l.yt_id ? l.yt_id + ' — ' : ''}${l.client_name}`])), [leads]);

  const assignees = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => (t.assignee_emails || []).forEach(e => s.add(e)));
    return Array.from(s).sort();
  }, [tasks]);

  const filtered = useMemo(() => tasks
    .filter(t => state === 'all' || (state === 'open' ? !t.completed : !!t.completed))
    .filter(t => priority === 'all' || (t.priority || 'medium') === priority)
    .filter(t => assignee === 'all'
      || (assignee === 'mine' ? (t.assignee_emails || []).some(e => e.toLowerCase() === myEmail) : (t.assignee_emails || []).includes(assignee)))
    .filter(t => !search.trim() || `${t.title} ${t.description || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      if (da !== db) return da - db;
      return (PRI_ORDER[a.priority || 'medium'] ?? 2) - (PRI_ORDER[b.priority || 'medium'] ?? 2);
    }), [tasks, state, priority, assignee, search, myEmail]);

  const groups = useMemo(() => groupTasks(filtered), [filtered]);

  const create = () => {
    if (!form.title.trim()) return;
    createTask.mutate({
      title: form.title.trim(),
      description: form.description,
      due_at: form.due ? new Date(form.due).toISOString() : null,
      all_day: form.allDay,
      priority: form.priority,
      assignee_emails: form.assignee ? form.assignee.split(',').map(s => s.trim()).filter(Boolean) : [],
      lead_id: form.leadId || null,
    }, {
      onSuccess: () => { setOpen(false); setForm({ title: '', description: '', due: '', allDay: false, priority: 'medium', assignee: '', leadId: '' }); toast({ title: 'Task criada no NetHunt' }); },
      onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const toggle = (t: NHTask) => updateTask.mutate({ id: t.id, changes: { completed: !t.completed } }, {
    onError: (e: any) => toast({ title: 'Erro ao sincronizar', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar tasks..." className="h-9 pl-8 text-xs" />
        </div>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos assignees</SelectItem>
            <SelectItem value="mine" className="text-xs">As minhas</SelectItem>
            {assignees.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Prioridade</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open" className="text-xs">Pendentes</SelectItem>
            <SelectItem value="done" className="text-xs">Concluídas</SelectItem>
            <SelectItem value="all" className="text-xs">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { syncNow.mutate(); refetch(); }} disabled={syncNow.isPending}>
          {syncNow.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {dataUpdatedAt ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: pt }) : 'Sincronizar'}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="text-xs"><Plus className="h-3 w-3 mr-1" /> Nova task</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-sm">Nova task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome da task" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-9 text-xs" />
              <Textarea placeholder="Descrição" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <Input type="datetime-local" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} className="h-9 text-xs" />
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input placeholder="Assignee (emails separados por vírgula)" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} className="h-9 text-xs" />
              <Select value={form.leadId} onValueChange={v => setForm({ ...form, leadId: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Ligar a lead (opcional)" /></SelectTrigger>
                <SelectContent>
                  {leads.map(l => <SelectItem key={l.id} value={l.id} className="text-xs">{l.yt_id ? `${l.yt_id} — ` : ''}{l.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Todo o dia</span>
                <Switch checked={form.allDay} onCheckedChange={v => setForm({ ...form, allDay: v })} />
              </div>
              <Button size="sm" className="w-full text-xs" onClick={create} disabled={createTask.isPending || !form.title.trim()}>
                {createTask.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : groups.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Sem tasks para estes filtros.</p>
      ) : groups.map(g => (
        <div key={g.key} className="bg-card border rounded-lg">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <p className="text-xs font-semibold">{g.label}</p>
            <span className="text-[10px] text-muted-foreground">{g.tasks.length}</span>
          </div>
          <div className="divide-y">
            {g.tasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                <button onClick={() => toggle(t)} className="shrink-0">
                  {t.completed ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium truncate', t.completed && 'line-through text-muted-foreground')}>{t.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.lead_id && (
                      <Link to={`/leads/${t.lead_id}`} className="text-[10px] text-[hsl(var(--info))] hover:underline">
                        {leadName.get(t.lead_id) || 'lead'} →
                      </Link>
                    )}
                    {t.creator_email && <span className="text-[10px] text-muted-foreground hidden sm:inline">{t.creator_email}</span>}
                  </div>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded hidden sm:inline', PRI_STYLE[t.priority || 'medium'])}>
                  {PRIORITIES.find(p => p.value === (t.priority || 'medium'))?.label || t.priority}
                </span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {t.due_at ? format(new Date(t.due_at), t.all_day ? 'dd/MM' : 'dd/MM HH:mm') : '—'}
                </span>
                {t.assignee_emails?.length ? <span className="text-[10px] text-muted-foreground hidden md:inline truncate max-w-[140px]">{t.assignee_emails.join(', ')}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
