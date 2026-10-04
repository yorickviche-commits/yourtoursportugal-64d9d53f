import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
    const ch = supabase.channel('jarvis_runs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, () => qc.invalidateQueries({ queryKey: ['jarvis_runs'] }))
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">JARVIS · YTP AI Agent Live Map</h1>
            <p className="text-sm text-muted-foreground">Departamento → Agente → Tarefa → Ferramenta. Silêncio nunca aprova.</p>
          </div>
          <Button asChild variant={pending ? 'destructive' : 'outline'} size="sm">
            <Link to="/agents/approvals">Fila de aprovações · {pending}</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Tarefas ativas', `${active} / ${tasks.length}`, 'text-success'],
            ['Parciais', String(partial), 'text-warning'],
            ['Falhas hoje', String(failedToday), failedToday ? 'text-destructive' : 'text-muted-foreground'],
            ['À espera de aprovação', String(pending), pending ? 'text-destructive' : 'text-muted-foreground'],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-md border bg-card p-3">
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {agents.map(a => {
            const ts = tasks.filter(t => t.agent_id === a.id);
            const shown = ts.filter(visible);
            if (!shown.length && (statusFilter !== 'all' || onlyMine)) return null;
            return (
              <div key={a.id} className={cn('rounded-lg border bg-card', a.code === 'A0' && 'md:col-span-2 xl:col-span-4')}>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold">{a.code} · {a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.owner_name ?? '—'}{a.backup_name ? ` · subst. ${a.backup_name}` : ''}</div>
                  </div>
                  <Badge variant="outline">{ts.filter(t => t.status === 'ativo').length}/{ts.length}</Badge>
                </div>
                <div className={cn('p-2 grid gap-1.5', a.code === 'A0' && 'sm:grid-cols-2 xl:grid-cols-3')}>
                  {shown.map(t => {
                    const st = runState(runsByTask[t.code] ?? []);
                    return (
                      <button key={t.id} onClick={() => setSelected(t)}
                        className="text-left rounded-md border px-2.5 py-2 hover:bg-accent min-h-11 flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">{t.code}</span>
                        <span className="text-sm flex-1 leading-tight">{t.name}</span>
                        {st && <span className={cn('text-[10px] px-1.5 rounded', st === 'falhou' ? 'bg-destructive/15 text-destructive' : st === 'a correr' ? 'bg-info/15 text-info' : 'bg-success/15 text-success')}>{st}</span>}
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0', STATUS_TONE[t.status])}>N{t.level_current}→N{t.level_ceiling}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
