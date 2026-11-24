import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X, Pencil, Clock, RefreshCw, ExternalLink, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import YtRefBadge from '@/components/crm/YtRefBadge';
import StageBadge from '@/components/crm/StageBadge';
import { useDecisions } from '@/hooks/useDecisions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { executeAiQueueItem, type QueueItem } from '@/components/ai-approvals/AiApprovalsList';
import { DECISION_SIDES, decisionAge, decisionTripStart, groupDecisions, preparedObject, snoozeDate, type Decision, type DecisionFilter } from '@/lib/decisions';
import { lisbonToday } from '@/lib/workbench/rules';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const eur = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
const minutes = (stamp: string | number | null | undefined, now: number) => stamp ? Math.max(0, Math.floor((now - (typeof stamp === 'number' ? stamp : Date.parse(stamp))) / 60000)) : null;
const shortDate = (s: string) => new Date(s + 'T12:00:00Z').toLocaleDateString('pt-PT');

function Prepared({ decision }: { decision: Decision }) {
  const p = preparedObject(decision.prepared);
  const amount = p.amount_eur ?? p.amount ?? p.valor ?? (p.amount_cents == null ? undefined : Number(p.amount_cents) / 100);
  const links = [p.gmail_draft_url, p.draft_url, p.proof_url, ...(Array.isArray(p.evidence_urls) ? p.evidence_urls : [])]
    .filter((url): url is string => typeof url === 'string' && /^https:\/\//i.test(url));
  return <div className="space-y-2 text-sm break-words">
    {amount != null && <p className="text-lg font-semibold">{eur(Number(amount))}</p>}
    {p.to && <p><span className="text-muted-foreground">Para:</span> {p.to}</p>}
    {['client_email', 'fse_email'].includes(decision.kind) && !p.to && <p className="text-warning-foreground">Falta o email do destinatário</p>}
    {p.subject && <p className="font-medium">{p.subject}</p>}
    {(p.next_step || p.description) && <p>{p.next_step || p.description}</p>}
    {p.due_date && <p>Prazo: {shortDate(p.due_date)}</p>}
    {links.length > 0 && <div className="flex flex-wrap gap-2">{links.map((url, i) => <Button key={`${url}-${i}`} variant="outline" className="min-h-11" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />{i === 0 && (p.gmail_draft_url || p.draft_url) ? 'Rascunho Gmail' : `Prova ${i + 1}`}</a></Button>)}</div>}
    {p.html && <details className="border-t border-border pt-2"><summary className="cursor-pointer min-h-11 flex items-center gap-2"><ChevronDown className="h-4 w-4" />Pré-visualização do email</summary><iframe title={`Email ${decision.title}`} sandbox="" srcDoc={String(p.html)} className="w-full h-72 border border-border rounded-md bg-background" /></details>}
    {!amount && !p.subject && !p.description && !p.next_step && !p.html && !links.length && <p className="text-muted-foreground">Sem rascunho ou prova anexada</p>}
  </div>;
}

export default function DecisionsQueue() {
  const query = useDecisions();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<DecisionFilter>('all');
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ action: 'approve' | 'reject' | 'activate'; items: Decision[] } | null>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [date, setDate] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const rows = query.data?.rows || [];
  const open = rows.filter(d => d.status === 'open');
  const candidates = rows.filter(d => ['open', 'snoozed'].includes(d.status) && d.candidate_rule);
  const shown = open.filter(d => filter === 'all' || d.side === filter);
  const snoozed = rows.filter(d => d.status === 'snoozed' && (filter === 'all' || d.side === filter));
  const closed = rows.filter(d => d.status === 'auto_closed' && (filter === 'all' || d.side === filter));
  const failed = rows.filter(d => d.status === 'failed' && (filter === 'all' || d.side === filter));
  const simulation = query.data?.control?.auto_close_enabled !== true;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await qc.invalidateQueries({ queryKey: ['cockpit-decisions'] }); await qc.invalidateQueries({ queryKey: ['workbench'] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível guardar'); }
    finally { setBusy(false); }
  };
  const action = async (d: Decision, name: string, params: { p_until?: string; p_prepared?: any; p_note?: string } = {}) => {
    if (name === 'resume') {
      const { error } = await supabase.rpc('resume_decision', { p_id: d.id });
      if (error) throw error;
      return;
    }
    const { error } = await supabase.rpc('decision_action', { p_id: d.id, p_action: name, ...params });
    if (error) throw error;
  };
  const snooze = (d: Decision, days: number) => {
    const day = new Date(Date.parse(lisbonToday() + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
    void run(async () => { await action(d, 'snooze', { p_until: snoozeDate(day) }); toast.success('Cartão adiado'); });
  };
  const commit = async () => {
    if (!confirm) return;
    const requested = confirm;
    if (requested.action === 'reject' && !note.trim()) { toast.error('Indica o motivo da rejeição'); return; }
    await run(async () => {
      if (requested.action === 'activate') {
        const { data, error } = await supabase.rpc('activate_decision_auto_close');
        if (error) throw error;
        toast.success(`${preparedObject(data).closed || 0} cartões fechados; regras automáticas ativadas`);
      } else {
        let completed = 0;
        for (const d of requested.items) {
          try {
            await action(d, requested.action, { p_note: requested.action === 'reject' ? note : undefined });
            // Same human-click execution function as Aprovações AI, unchanged.
            if (requested.action === 'approve' && d.source_table === 'ai_action_queue') {
              const item: QueueItem = { id: d.source_id, type: d.kind as QueueItem['type'], lead_id: d.lead_id, lead_code: d.yt_ref, title: d.title, subtitle: d.why, payload: preparedObject(d.prepared), status: 'approved', created_at: d.created_at, error: null, result: null };
              try {
                const result = await executeAiQueueItem(item, item.payload);
                const { error } = await supabase.from('ai_action_queue').update({ status: 'executed', result, error: null }).eq('id', d.source_id).eq('status', 'approved');
                if (error) throw error;
              } catch (e) {
                const message = e instanceof Error ? e.message : 'Falhou a execução';
                const { error } = await supabase.from('ai_action_queue').update({ status: 'failed', error: message }).eq('id', d.source_id).eq('status', 'approved');
                if (error) throw error;
                throw new Error(message);
              }
            }
            completed++;
          } catch (e) { throw new Error(`${completed}/${requested.items.length} tratados. ${e instanceof Error ? e.message : 'Erro'}; os restantes não foram alterados.`); }
        }
        toast.success(`${completed} ${completed === 1 ? 'decisão registada' : 'decisões registadas'}`);
      }
      setConfirm(null); setNote('');
      await qc.invalidateQueries({ queryKey: ['ai_action_queue'] });
      await qc.invalidateQueries({ queryKey: ['finance_batch'] });
    });
  };
  const card = (d: Decision) => {
    const age = decisionAge(d.created_at, now);
    const checked = minutes(d.checked_at, now);
    return <article key={d.id} data-decision-id={d.id} className="border border-border rounded-lg bg-card p-4 space-y-3 min-w-0">
      <div className="flex flex-wrap justify-between items-start gap-2"><h4 className="font-semibold text-sm break-words flex-1 min-w-0">{d.title}</h4><Badge variant={age.urgent ? 'destructive' : 'secondary'}>{age.label}</Badge></div>
      <p className="text-sm break-words">{d.why}</p><Prepared decision={d} />
      <p className="text-xs text-muted-foreground break-words">{checked == null ? 'Ainda não verificado' : `Verificado há ${checked} min — contra ${d.checked_note || 'TCC'}`}</p>
      {d.candidate_reason && <p className="text-sm text-warning-foreground">Possivelmente obsoleto: {d.candidate_reason}</p>}
      {editing === d.id && <div className="space-y-3 border-t border-border pt-3">
        {['client_email', 'fse_email'].includes(d.kind) ? <>
          <Input className="min-h-11 text-base" aria-label="Destinatário" type="email" value={draft.to || ''} onChange={e => setDraft({ ...draft, to: e.target.value })} />
          <Input className="min-h-11 text-base" aria-label="Assunto" value={draft.subject || ''} onChange={e => setDraft({ ...draft, subject: e.target.value })} />
          <Textarea className="text-base min-h-40" aria-label="Email preparado" value={draft.html || ''} onChange={e => setDraft({ ...draft, html: e.target.value })} />
        </> : d.kind === 'payment_link' ? <>
          <Input className="min-h-11 text-base" aria-label="Valor em euros" type="number" min="0.01" step="0.01" value={draft.amount_eur ?? ''} onChange={e => setDraft({ ...draft, amount_eur: Number(e.target.value), amount_cents: Math.round(Number(e.target.value) * 100) })} />
          <Textarea className="text-base" aria-label="Descrição" value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} />
        </> : <Textarea className="text-base" aria-label="Próxima ação" value={draft.next_step || draft.description || ''} onChange={e => setDraft({ ...draft, [d.kind === 'task' ? 'description' : 'next_step']: e.target.value })} />}
        <div className="flex gap-2"><Button className="min-h-11" disabled={busy} onClick={() => void run(async () => { await action(d, 'edit', { p_prepared: draft }); setEditing(null); toast.success('Preparação guardada'); })}>Guardar</Button><Button className="min-h-11" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button></div>
      </div>}
      {d.status === 'open' && <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <Button className="min-h-11" disabled={busy} onClick={() => { setConfirm({ action: 'approve', items: [d] }); setNote(''); }}><Check className="h-4 w-4 mr-1" />Aprovar</Button>
        <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { setConfirm({ action: 'reject', items: [d] }); setNote(''); }}><X className="h-4 w-4 mr-1" />Rejeitar</Button>
        {d.kind === 'finance_item' ? <Button className="min-h-11" variant="outline" asChild><Link to="/cockpit?view=finance"><Pencil className="h-4 w-4 mr-1" />Rever finanças</Link></Button> : <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { setEditing(editing === d.id ? null : d.id); setDraft(preparedObject(d.prepared)); }}><Pencil className="h-4 w-4 mr-1" />Editar</Button>}
        <Popover><PopoverTrigger asChild><Button className="min-h-11" variant="outline" disabled={busy}><Clock className="h-4 w-4 mr-1" />Adiar</Button></PopoverTrigger><PopoverContent className="w-64 space-y-2" align="end"><Button className="w-full min-h-11" variant="outline" onClick={() => snooze(d, 1)}>Amanhã</Button><Button className="w-full min-h-11" variant="outline" onClick={() => snooze(d, 3)}>Daqui a 3 dias</Button><Input className="min-h-11 text-base" aria-label="Data para adiar" type="date" min={lisbonToday()} value={date} onChange={e => setDate(e.target.value)} /><Button className="w-full min-h-11" disabled={!date || busy} onClick={() => void run(async () => { await action(d, 'snooze', { p_until: snoozeDate(date) }); toast.success('Cartão adiado'); })}>Adiar para esta data</Button></PopoverContent></Popover>
      </div>}
      {d.status === 'snoozed' && <div className="flex flex-wrap gap-2 items-center"><Badge variant="outline">Adiado até {new Date(d.snooze_until || '').toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}</Badge><Button className="min-h-11" variant="outline" disabled={busy} onClick={() => void run(() => action(d, 'resume'))}>Retomar</Button></div>}
      {d.status === 'auto_closed' && <><p className="text-sm">{d.closed_reason}</p><Button className="min-h-11" variant="outline" disabled={busy} onClick={() => void run(async () => { await action(d, 'reopen'); toast.success('Cartão reaberto; fica disponível durante 24 horas'); })}><RotateCcw className="h-4 w-4 mr-1" />Reabrir</Button></>}
    </article>;
  };
  const updated = minutes(query.data?.loadedAt, now);
  return <section aria-label="Precisa de ti" className="space-y-4 min-w-0">
    <div className="flex flex-wrap gap-3 justify-between items-center"><div><h2 className="text-xl font-bold">Precisa de ti ({open.length})</h2><p className="text-xs text-muted-foreground">Atualizado {updated == null ? '—' : `há ${updated} min`} · última corrida do Orquestrador {query.data?.orchestrated ? `às ${new Date(query.data.orchestrated).toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' })}` : 'não registada'}</p></div><Button variant="outline" size="icon" className="h-11 w-11" title="Atualizar decisões" aria-label="Atualizar decisões" disabled={busy || query.isFetching} onClick={() => void run(query.refresh)}><RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} /></Button></div>
    {query.error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a fila: {(query.error as Error).message}</p>}
    {simulation && candidates.length > 0 && <div role="status" className="bg-warning-muted border border-warning rounded-md p-3 space-y-2"><p className="font-medium text-sm">{candidates.length} cartões obsoletos encontrados</p><div className="flex flex-wrap gap-2"><Button className="min-h-11" variant="outline" onClick={() => setCandidatesOpen(!candidatesOpen)}>Ver lista</Button>{isAdmin && <Button className="min-h-11" disabled={busy} onClick={() => setConfirm({ action: 'activate', items: candidates })}>Fechar todos</Button>}</div>{candidatesOpen && <ul className="space-y-2 text-sm">{candidates.map(d => <li key={d.id}><strong>{d.yt_ref || 'Sem file'} · {d.title}</strong><p>{d.candidate_reason}</p></li>)}</ul>}</div>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar decisões">{Object.entries(DECISION_SIDES).map(([key, label]) => <Button key={key} variant={filter === key ? 'default' : 'outline'} className="min-h-11" onClick={() => setFilter(key as DecisionFilter)}>{label} ({open.filter(d => key === 'all' || d.side === key).length})</Button>)}</div>
    {query.isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}</div> : !shown.length && <div className="py-8 space-y-2 text-center"><Check className="h-7 w-7 text-success mx-auto" /><p className="font-semibold">Nada à tua espera</p><p className="text-sm text-muted-foreground">{query.data?.todayClosed || 0} cartões fechados automaticamente hoje</p></div>}
    {groupDecisions(shown).map(items => {
      const first = items[0]; if (!first) return null;
      const trip = decisionTripStart(first);
      const days = trip ? Math.floor((Date.parse(trip) - Date.parse(lisbonToday())) / 86400000) : null;
      return <div key={first.lead_id || first.id} className="space-y-3 border-t border-border pt-4"><div className="flex flex-wrap gap-2 items-center">
        {first.lead_id ? <Link to={`/leads/${first.lead_id}`}><YtRefBadge value={first.yt_ref || 'File'} /></Link> : <YtRefBadge value={first.yt_ref || 'Sem file'} />}
        <h3 className="font-semibold text-sm break-words">{first.leads?.client_name || 'Sem cliente associado'}</h3>
        {first.leads?.nethunt_stage && <StageBadge stage={first.leads.nethunt_stage} />}
        <span className="text-xs text-muted-foreground">{trip ? `${shortDate(trip)} · ${days === 0 ? 'hoje' : days != null && days > 0 ? `em ${days} dias` : 'data passada'}` : 'Viagem sem data'}</span>
      </div><div className="flex flex-wrap gap-2"><Button className="min-h-11 text-xs" variant="outline" disabled={busy} onClick={() => { setConfirm({ action: 'approve', items }); setNote(''); }}>Aprovar tudo desta file ({items.length})</Button><Button className="min-h-11 text-xs" variant="outline" disabled={busy} onClick={() => { setConfirm({ action: 'reject', items }); setNote(''); }}>Rejeitar tudo desta file ({items.length})</Button></div><div className="space-y-3">{items.map(card)}</div></div>;
    })}
    {snoozed.length > 0 && <details className="border-t border-border pt-3"><summary className="cursor-pointer min-h-11 font-medium">Adiado ({snoozed.length})</summary><div className="space-y-3 mt-3">{snoozed.map(card)}</div></details>}
    {failed.length > 0 && <details className="border-t border-border pt-3"><summary className="cursor-pointer min-h-11 text-destructive font-medium">Falhou a execução ({failed.length})</summary><div className="space-y-3 mt-3">{failed.map(d => <div key={d.id}>{card(d)}<Button variant="link" className="min-h-11" asChild><Link to="/approvals/ai">Rever em Aprovações AI</Link></Button></div>)}</div></details>}
    <details className="border-t border-border pt-3"><summary className="cursor-pointer min-h-11 font-medium">Fechado automaticamente (últimos 7 dias) · {closed.length}</summary><div className="space-y-3 mt-3">{closed.length ? closed.map(card) : <p className="text-sm text-muted-foreground">Sem fechos automáticos.</p>}</div></details>
    <AlertDialog open={!!confirm}><AlertDialogContent className="max-h-[85dvh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>{confirm?.action === 'activate' ? 'Fechar cartões obsoletos e ativar as regras?' : `${confirm?.action === 'approve' ? 'Aprovar' : 'Rejeitar'} ${confirm?.items.length || 0} cartão(ões)?`}</AlertDialogTitle><AlertDialogDescription>{confirm?.action === 'activate' ? 'Daqui em diante, a fila fecha cartões obsoletos automaticamente. Os registos originais são preservados.' : confirm?.action === 'approve' && confirm.items.some(d => d.source_table === 'ai_action_queue') ? 'Os emails serão enviados e os links criados pelo mesmo processo de Aprovações AI. Itens financeiros ficam aprovados para execução pelo Tesoureiro.' : 'A decisão será registada nas respetivas origens.'}</AlertDialogDescription></AlertDialogHeader>
      {confirm?.action !== 'activate' && <ul className="text-sm space-y-2">{confirm?.items.map(d => <li key={d.id}>{d.yt_ref} · {d.title}</li>)}</ul>}
      {confirm?.action === 'reject' && <Textarea className="text-base" aria-label="Motivo da rejeição" placeholder="Motivo da rejeição" value={note} onChange={e => setNote(e.target.value)} />}
      <AlertDialogFooter><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</Button><Button className="min-h-11" disabled={busy || confirm?.action === 'reject' && !note.trim()} onClick={() => void commit()}>{busy ? 'A guardar…' : confirm?.action === 'activate' ? 'Confirmar fecho e ativar' : confirm?.action === 'approve' ? 'Confirmar aprovação' : 'Confirmar rejeição'}</Button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section>;
}