import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { KanbanSquare, Table2, X } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useInternalUsers } from '@/hooks/useInternalUsers';
import { computeKPIs, useFeedbackList } from '@/hooks/useFeedbackQuery';
import { useBulkUpdateFeedback, useUpdateFeedback } from '@/hooks/useFeedbackMutations';
import FeedbackKPIs from '@/components/feedback/FeedbackKPIs';
import FeedbackBoard from '@/components/feedback/FeedbackBoard';
import FeedbackTable from '@/components/feedback/FeedbackTable';
import FeedbackDetailSheet from '@/components/feedback/FeedbackDetailSheet';
import { FEEDBACK_MODULES } from '@/lib/feedbackContext';
import {
  BOARD_COLUMNS, OPEN_STATUSES, PRIORITY_LABELS, SEVERITY_LABELS, STATUS_LABELS, TYPE_LABELS,
  type FeedbackPriority, type FeedbackSeverity, type FeedbackStatus, type FeedbackType,
} from '@/lib/feedbackConstants';

const AdminFeedbackPage = () => {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: rows = [], isLoading } = useFeedbackList();
  const { data: users = [] } = useInternalUsers();
  const update = useUpdateFeedback();
  const bulk = useBulkUpdateFeedback();

  const [view, setView] = useState<'board' | 'table'>('board');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('open');
  const [severity, setSeverity] = useState('all');
  const [module, setModule] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const openId = params.get('open');
  const setOpenId = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id); else next.delete('open');
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => rows.filter(r => {
    if (type !== 'all' && r.type !== type) return false;
    if (status === 'open' ? !OPEN_STATUSES.includes(r.status as FeedbackStatus) : status !== 'all' && r.status !== status) return false;
    if (severity !== 'all' && r.severity !== severity) return false;
    if (module !== 'all' && r.module !== module) return false;
    if (assignee !== 'all' && (assignee === 'none' ? r.assignee_id : r.assignee_id !== assignee)) return false;
    const q = search.trim().toLowerCase();
    if (q && ![r.ref, r.title, r.description, r.reporter_name, r.lead_ref]
      .some(v => (v ?? '').toString().toLowerCase().includes(q))) return false;
    return true;
  }), [rows, type, status, severity, module, assignee, search]);

  const kpis = useMemo(() => computeKPIs(rows), [rows]);

  const applyBulk = (patch: Record<string, any>) => {
    if (!selected.length) return;
    bulk.mutate({ ids: selected, patch }, {
      onSuccess: () => { toast.success(`${selected.length} reportes atualizados.`); setSelected([]); },
      onError: e => toast.error(e.message),
    });
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Só administradores têm acesso a esta página.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Feedback da Plataforma</h1>
            <p className="text-xs text-muted-foreground">Triagem de bugs, melhorias e sugestões da equipa.</p>
          </div>
          <Tabs value={view} onValueChange={v => setView(v as typeof view)}>
            <TabsList className="h-8">
              <TabsTrigger value="board" className="text-xs"><KanbanSquare className="mr-1.5 h-3.5 w-3.5" />Quadro</TabsTrigger>
              <TabsTrigger value="table" className="text-xs"><Table2 className="mr-1.5 h-3.5 w-3.5" />Tabela</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        <FeedbackKPIs kpis={kpis} />

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 w-full text-xs sm:w-56"
            placeholder="Pesquisar ref, título, reporter…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
              {(['bug', 'improvement', 'suggestion'] as FeedbackType[]).map(t => (
                <SelectItem key={t} value={t} className="text-xs">{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open" className="text-xs">Em aberto</SelectItem>
              <SelectItem value="all" className="text-xs">Todos os estados</SelectItem>
              {BOARD_COLUMNS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Toda a gravidade</SelectItem>
              {(['blocker', 'high', 'medium', 'low'] as FeedbackSeverity[]).map(s => (
                <SelectItem key={s} value={s} className="text-xs">{SEVERITY_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os módulos</SelectItem>
              {FEEDBACK_MODULES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Qualquer responsável</SelectItem>
              <SelectItem value="none" className="text-xs">Sem responsável</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-[10px]">{filtered.length} reportes</Badge>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-2">
            <span className="text-xs font-medium">{selected.length} selecionados</span>
            <Select onValueChange={v => applyBulk({ status: v })}>
              <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                {BOARD_COLUMNS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select onValueChange={v => applyBulk({ priority: v })}>
              <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                {(['p0', 'p1', 'p2', 'p3'] as FeedbackPriority[]).map(p => (
                  <SelectItem key={p} value={p} className="text-xs">{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={v => applyBulk({ assignee_id: v === 'none' ? null : v })}>
              <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">Sem responsável</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected([])}>
              <X className="mr-1 h-3 w-3" /> limpar
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-muted-foreground">A carregar…</p>
        ) : view === 'board' ? (
          <FeedbackBoard
            rows={filtered}
            onOpen={setOpenId}
            onStatusChange={(id, st) => update.mutate({ id, patch: { status: st } }, { onError: e => toast.error(e.message) })}
          />
        ) : (
          <FeedbackTable rows={filtered} selected={selected} onSelectedChange={setSelected} onOpen={setOpenId} />
        )}
      </div>

      <FeedbackDetailSheet id={openId} mode="admin" onClose={() => setOpenId(null)} />
    </AppLayout>
  );
};

export default AdminFeedbackPage;
