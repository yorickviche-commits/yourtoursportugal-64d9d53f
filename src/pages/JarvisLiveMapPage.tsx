import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Bot, CheckCircle2, Clock3, Radio, ShieldCheck, Workflow } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Task = {
  id: string; code: string; agent_id: string; name: string; status: string;
  level_current: number; level_ceiling: number; tools: string[]; human_role: string | null;
  last_run_at: string | null; sop_url: string | null;
};
type Agent = { id: string; code: string; name: string; owner_name: string | null; backup_name: string | null; sort_order: number };
type Run = { id: string; task_code: string | null; status: string; summary: string | null; error: string | null; lead_code: string | null; agent_label: string | null; started_at: string };

const STATUS_LABEL: Record<string, string> = { ativo: 'Ativo', parcial: 'Parcial', desenhado: 'Desenhado', novo: 'Novo', parado: 'Parado' };
const STATUS_TONE: Record<string, string> = {
  ativo: 'bg-success/15 text-success border-success/30',
  parcial: 'bg-warning/15 text-warning border-warning/30',
  desenhado: 'bg-info/15 text-info border-info/30',
  novo: 'bg-muted text-muted-foreground border-border',
  parado: 'bg-destructive/15 text-destructive border-destructive/30',
};

const today = () => new Date().toISOString().slice(0, 10);

const RUN_TONE: Record<string, string> = {
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  running: 'border-info/40 bg-info/10 text-info',
  completed: 'border-success/40 bg-success/10 text-success',
  success: 'border-success/40 bg-success/10 text-success',
};

function runState(runs: Run[]): 'falhou' | 'a correr' | 'feito hoje' | null {
  const r = runs[0];
  if (!r) return null;
  if (r.status === 'failed') return 'falhou';
  if (r.status === 'running') return 'a correr';
  if (r.started_at.slice(0, 10) === today()) return 'feito hoje';
  return null;
}

export default function JarvisLiveMapPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ['jarvis_agents'],
    queryFn: async () => (await supabase.from('agents').select('*').order('sort_order')).data as Agent[] ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['jarvis_tasks'],
    queryFn: async () => (await supabase.from('agent_tasks').select('*').order('sort_order')).data as Task[] ?? [],
  });
  const { data: runs = [] } = useQuery({
    queryKey: ['jarvis_runs'],
    queryFn: async () => (await supabase.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(300)).data as Run[] ?? [],
  });
  const { data: pending = 0 } = useQuery({
    queryKey: ['jarvis_pending'],
    queryFn: async () => (await supabase.from('ai_action_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending')).count ?? 0,
  });

  useEffect(() => {
    const ch = supabase.channel('jarvis_live_map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, () => qc.invalidateQueries({ queryKey: ['jarvis_runs'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_tasks' }, () => qc.invalidateQueries({ queryKey: ['jarvis_tasks'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_action_queue' }, () => qc.invalidateQueries({ queryKey: ['jarvis_pending'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const runsByTask = useMemo(() => {
    const m: Record<string, Run[]> = {};
    runs.forEach(r => { if (r.task_code) (m[r.task_code] ||= []).push(r); });
    return m;
  }, [runs]);

  const visible = (t: Task) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (onlyMine) {
      const st = runState(runsByTask[t.code] ?? []);
      return st === 'falhou' || t.level_current <= 1 && t.status === 'ativo';
    }
    return true;
  };

  const active = tasks.filter(t => t.status === 'ativo').length;
  const partial = tasks.filter(t => t.status === 'parcial').length;
  const failedToday = runs.filter(r => r.status === 'failed' && r.started_at.slice(0, 10) === today()).length;
  const runningNow = runs.filter(r => r.status === 'running').length;
  const latestRuns = runs.slice(0, 12);

  const saveTask = async (patch: Partial<Task>) => {
    if (!selected) return;
    const { error } = await supabase.from('agent_tasks').update(patch).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Cartão atualizado');
    setSelected({ ...selected, ...patch });
    qc.invalidateQueries({ queryKey: ['jarvis_tasks'] });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-info/30 bg-info/10 text-info">
                <Bot className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-success urgency-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-semibold sm:text-xl">JARVIS · Live Operations Map</h1>
                <p className="text-sm text-muted-foreground">Estado real dos agentes, tarefas e decisões humanas.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium">
              <Radio className="h-3.5 w-3.5 text-success urgency-pulse" /> LIVE · {runningNow} em execução
            </div>
            <Button asChild variant={pending ? 'destructive' : 'outline'} size="sm">
              <Link to="/agents/approvals"><ShieldCheck className="mr-1.5 h-4 w-4" />Aprovações · {pending}</Link>
            </Button>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Tarefas ativas', `${active} / ${tasks.length}`, 'text-success'],
            ['Parciais', String(partial), 'text-warning'],
            ['Falhas hoje', String(failedToday), failedToday ? 'text-destructive' : 'text-muted-foreground'],
            ['À espera de aprovação', String(pending), pending ? 'text-destructive' : 'text-muted-foreground'],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-md border bg-card p-3 shadow-sm">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className={cn('text-xl font-semibold', c)}>{v}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant={onlyMine ? 'default' : 'outline'} onClick={() => setOnlyMine(v => !v)}>Só o que precisa de mim</Button>
        </div>

        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="grid gap-3 md:grid-cols-2">
          {agents.map(a => {
            const ts = tasks.filter(t => t.agent_id === a.id);
            const shown = ts.filter(visible);
            if (!shown.length && (statusFilter !== 'all' || onlyMine)) return null;
            return (
              <div key={a.id} className={cn('overflow-hidden rounded-lg border bg-card shadow-sm', a.code === 'A0' && 'md:col-span-2')}>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><Bot className="h-4 w-4" /></div>
                    <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.code} · {a.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.owner_name ?? '—'}{a.backup_name ? ` · subst. ${a.backup_name}` : ''}</div>
                    </div>
                  </div>
                  <Badge variant="outline">{ts.filter(t => t.status === 'ativo').length}/{ts.length}</Badge>
                </div>
                <div className={cn('p-2 grid gap-1.5', a.code === 'A0' && 'sm:grid-cols-2')}>
                  {shown.map(t => {
                    const st = runState(runsByTask[t.code] ?? []);
                    return (
                      <Button key={t.id} variant="ghost" onClick={() => setSelected(t)}
                        className="h-auto min-h-11 justify-start rounded-md border px-2.5 py-2 text-left hover:bg-accent">
                        <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">{t.code}</span>
                        <span className="text-sm flex-1 leading-tight">{t.name}</span>
                        {st && <span className={cn('text-[10px] px-1.5 rounded', st === 'falhou' ? 'bg-destructive/15 text-destructive' : st === 'a correr' ? 'bg-info/15 text-info' : 'bg-success/15 text-success')}>{st}</span>}
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0', STATUS_TONE[t.status])}>N{t.level_current}→N{t.level_ceiling}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!agents.length && <div className="col-span-full rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning"><AlertTriangle className="mr-2 inline h-4 w-4" />Sem agentes disponíveis.</div>}
          </div>

          <aside className="overflow-hidden rounded-lg border bg-card shadow-sm xl:sticky xl:top-4">
            <div className="flex items-center justify-between border-b px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-info" />Atividade em direto</div>
              <Badge variant="outline">{latestRuns.length}</Badge>
            </div>
            <div className="max-h-[560px] divide-y overflow-y-auto">
              {latestRuns.map(run => (
                <div key={run.id} className="p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={cn('rounded border px-1.5 py-0.5 font-medium', RUN_TONE[run.status] ?? 'border-border text-muted-foreground')}>{run.status}</span>
                    <span className="text-muted-foreground">{new Date(run.started_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="font-medium">{run.agent_label ?? run.task_code ?? 'JARVIS'}</div>
                  <div className="mt-0.5 line-clamp-2 text-muted-foreground">{run.lead_code ? `${run.lead_code} · ` : ''}{run.summary ?? run.error ?? 'Execução registada'}</div>
                </div>
              ))}
              {!latestRuns.length && <div className="p-6 text-center text-xs text-muted-foreground"><Clock3 className="mx-auto mb-2 h-5 w-5" />À espera da primeira execução.</div>}
            </div>
            <div className="grid grid-cols-2 border-t bg-muted/30 p-2 text-center text-xs">
              <div><CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-success" /><strong>{active}</strong><br /><span className="text-muted-foreground">ativas</span></div>
              <div><Workflow className="mx-auto mb-1 h-4 w-4 text-info" /><strong>{tasks.length}</strong><br /><span className="text-muted-foreground">tarefas</span></div>
            </div>
          </aside>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{selected.code} · {selected.name}</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <Badge className={STATUS_TONE[selected.status]} variant="outline">{STATUS_LABEL[selected.status]}</Badge>
                  <Badge variant="outline">Nível N{selected.level_current} · teto N{selected.level_ceiling}</Badge>
                </div>
                <div><div className="text-xs text-muted-foreground">Humano valida</div>{selected.human_role ?? '—'}</div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Ferramentas</div>
                  <div className="flex flex-wrap gap-1">{selected.tools.map(x => <Badge key={x} variant="secondary">{x}</Badge>)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Estado</div>
                    <Select value={selected.status} onValueChange={v => saveTask({ status: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Nível atual</div>
                    <Select value={String(selected.level_current)} onValueChange={v => saveTask({ level_current: Number(v) })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{[0, 1, 2, 3].filter(n => n <= selected.level_ceiling).map(n => <SelectItem key={n} value={String(n)}>N{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Só administradores alteram cartões. O nível nunca passa o teto.</p>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Últimas execuções</div>
                  {(runsByTask[selected.code] ?? []).slice(0, 15).map(r => (
                    <div key={r.id} className="border-b py-1.5">
                      <div className="flex justify-between text-xs">
                        <span className={r.status === 'failed' ? 'text-destructive' : r.status === 'running' ? 'text-info' : 'text-success'}>{r.status}</span>
                        <span className="text-muted-foreground">{new Date(r.started_at).toLocaleString('pt-PT')}</span>
                      </div>
                      <div>{r.lead_code ? `${r.lead_code} · ` : ''}{r.summary ?? r.error ?? '—'}</div>
                    </div>
                  ))}
                  {!(runsByTask[selected.code] ?? []).length && <div className="text-muted-foreground">Sem execuções registadas.</div>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
