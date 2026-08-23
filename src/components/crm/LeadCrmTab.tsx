import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  ExternalLink, RefreshCw, MessageSquare, Mail, Phone, CalendarDays, FileText,
  History, MessagesSquare, Loader2, Plus, CheckCircle2, Circle, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  NETHUNT_STAGES, SOURCE_OPTIONS, netHuntRecordUrl,
  useLeadTimeline, useNHTasks, usePushLead, useAddComment,
  useCreateNHTask, useUpdateNHTask, useSyncNow, useLeadGmail, fetchGmailBody,
} from '@/hooks/useNetHunt';

const TYPE_FILTERS = [
  { key: 'all', label: 'Todos', icon: History },
  { key: 'email', label: 'Emails', icon: Mail },
  { key: 'comment', label: 'Comentários', icon: MessageSquare },
  { key: 'call', label: 'Chamadas', icon: Phone },
  { key: 'chat', label: 'WhatsApp / Chats', icon: MessagesSquare },
  { key: 'calendar', label: 'Calendário', icon: CalendarDays },
  { key: 'file', label: 'Ficheiros', icon: FileText },
  { key: 'field_change', label: 'Alterações', icon: History },
];

const TYPE_STYLE: Record<string, { icon: any; color: string }> = {
  email: { icon: Mail, color: 'text-[hsl(var(--info))]' },
  comment: { icon: MessageSquare, color: 'text-[hsl(var(--warning))]' },
  call: { icon: Phone, color: 'text-[hsl(var(--success))]' },
  chat: { icon: MessagesSquare, color: 'text-[hsl(var(--success))]' },
  calendar: { icon: CalendarDays, color: 'text-primary' },
  file: { icon: FileText, color: 'text-muted-foreground' },
  field_change: { icon: History, color: 'text-muted-foreground' },
};

const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

interface Props { leadId: string }

export default function LeadCrmTab({ leadId }: Props) {
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const { data: lead, isLoading, refetch } = useQuery({
    queryKey: ['lead-crm', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, client_name, email, yt_id, lead_code, status, nethunt_record_id, nethunt_stage, nethunt_synced_at, trip_start, trip_finish, close_date, source, client_type')
        .eq('id', leadId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const timeline = useLeadTimeline(leadId);
  const tasks = useNHTasks(leadId);
  const pushLead = usePushLead();
  const addComment = useAddComment();
  const syncNow = useSyncNow();
  const gmail = useLeadGmail(lead?.email, lead?.yt_id);
  const [bodies, setBodies] = useState<Record<string, string>>({});

  // NetHunt's API does not expose emails, so Gmail history is merged in as email events.
  const events = useMemo(() => {
    const mails = (gmail.data || []).map(m => ({
      id: `gmail:${m.id}`,
      event_type: 'email',
      event_time: m.date,
      subject: m.subject || '(sem assunto)',
      snippet: `${m.direction === 'IN' ? '↓' : '↑'} ${m.from} — ${m.snippet}`,
      creator_email: m.direction === 'IN' ? m.from : m.to,
      body_html: bodies[m.id] || null,
      gmail_id: m.id,
      gmail_url: m.url,
    })) as any[];
    const list = [...(timeline.data || []) as any[], ...mails]
      .sort((a, b) => (b.event_time || '').localeCompare(a.event_time || ''));
    if (filter === 'all') return list;
    return list.filter(e => e.event_type === filter);
  }, [timeline.data, gmail.data, bodies, filter]);

  const openWithBody = async (ev: any) => {
    const expanded = openEvent === ev.id;
    setOpenEvent(expanded ? null : ev.id);
    if (!expanded && ev.gmail_id && !bodies[ev.gmail_id]) {
      try {
        const html = await fetchGmailBody(ev.gmail_id);
        setBodies(prev => ({ ...prev, [ev.gmail_id]: html || '<em>Sem corpo disponível.</em>' }));
      } catch {
        setBodies(prev => ({ ...prev, [ev.gmail_id]: '<em>Não foi possível carregar o email.</em>' }));
      }
    }
  };

  const save = (changes: Record<string, unknown>) => {
    pushLead.mutate({ id: leadId, changes }, {
      onSuccess: () => { refetch(); toast({ title: 'Sincronizado com o NetHunt' }); },
      onError: (e: any) => toast({ title: 'Erro ao sincronizar', description: e.message, variant: 'destructive' }),
    });
  };

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>;
  if (!lead) return <p className="text-xs text-muted-foreground">Lead não encontrada.</p>;

  const linked = !!lead.nethunt_record_id;
  const hasHistory = (timeline.data?.length ?? 0) > 0 || (gmail.data?.length ?? 0) > 0;

  if (!linked && !hasHistory) {
    return (
      <div className="bg-card border rounded-lg p-6 text-center space-y-3">
        <p className="text-sm font-medium">Esta lead ainda não está ligada a um record do NetHunt.</p>
        <p className="text-xs text-muted-foreground">A ligação é feita automaticamente pela referência YT ({lead.yt_id || '—'}) na próxima sincronização.</p>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
          {syncNow.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Sincronizar agora
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{lead.client_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{lead.yt_id || lead.lead_code}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {lead.nethunt_synced_at
                ? `Sincronizado ${formatDistanceToNow(new Date(lead.nethunt_synced_at), { addSuffix: true, locale: pt })}`
                : 'Nunca sincronizado'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => { syncNow.mutate(); refetch(); timeline.refetch(); }} disabled={syncNow.isPending}>
            {syncNow.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Sincronizar
          </Button>
          {linked && (
            <a href={netHuntRecordUrl(lead.nethunt_record_id)} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="text-xs"><ExternalLink className="h-3 w-3 mr-1" /> Abrir no NetHunt</Button>
            </a>
          )}
        </div>
      </div>

      {/* Editable fields */}
      <div className="bg-card border rounded-lg p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Stage</label>
          <Select value={lead.nethunt_stage || ''} onValueChange={v => save({ nethunt_stage: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecionar stage" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="text-[10px]">SALES</SelectLabel>
                {NETHUNT_STAGES.SALES.map(s => <SelectItem key={s} value={s} className="text-xs">{s.replace('SALES - ', '')}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="text-[10px]">OPERATIONS</SelectLabel>
                {NETHUNT_STAGES.OPERATIONS.map(s => <SelectItem key={s} value={s} className="text-xs">{s.replace('OPERATIONS - ', '')}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {([
          ['trip_start', 'Trip Start'],
          ['trip_finish', 'Trip Finish'],
          ['close_date', 'Close date'],
        ] as const).map(([key, label]) => (
          <div key={key}>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">{label}</label>
            <Input type="date" defaultValue={lead[key] || ''} className="h-9 text-xs"
              onBlur={e => { if (e.target.value !== (lead[key] || '')) save({ [key]: e.target.value || null }); }} />
          </div>
        ))}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Source</label>
          <Select value={lead.source || ''} onValueChange={v => save({ source: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">B2B / B2C</label>
          <Select value={lead.client_type || ''} onValueChange={v => save({ client_type: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="B2B" className="text-xs">B2B Client</SelectItem>
              <SelectItem value="B2C" className="text-xs">B2C Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tasks */}
      <LeadTasks leadId={leadId} tasks={tasks.data || []} loading={tasks.isLoading} />

      {/* Comment box */}
      <div className="bg-card border rounded-lg p-4 space-y-2">
        <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
          placeholder="Escrever comentário no NetHunt..." className="text-xs" />
        <div className="flex justify-end">
          <Button size="sm" className="text-xs" disabled={!comment.trim() || addComment.isPending}
            onClick={() => addComment.mutate({ leadId, text: comment.trim() }, {
              onSuccess: () => { setComment(''); timeline.refetch(); toast({ title: 'Comentário criado no NetHunt' }); },
              onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
            })}>
            {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />} Comentar
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card border rounded-lg">
        <div className="px-4 py-3 border-b flex items-center gap-1 overflow-x-auto">
          {TYPE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn('px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="divide-y">
          {(timeline.isLoading || gmail.isLoading) && <div className="p-4"><Skeleton className="h-16 w-full" /></div>}
          {events.map(ev => {
            const st = TYPE_STYLE[ev.event_type] || TYPE_STYLE.field_change;
            const Icon = st.icon;
            const expanded = openEvent === ev.id;
            return (
              <div key={ev.id} className="px-4 py-3 hover:bg-muted/30">
                <button className="w-full text-left flex items-start gap-3"
                  onClick={() => openWithBody(ev)}>
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', st.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium truncate">{ev.subject || ev.creator_name || ev.event_type}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {ev.event_time ? format(new Date(ev.event_time), 'dd/MM/yyyy HH:mm') : ''}
                      </span>
                      {ev.gmail_id && <Badge variant="outline" className="text-[9px]">Gmail</Badge>}
                    </div>
                    {ev.snippet && <p className={cn('text-[11px] text-muted-foreground mt-0.5', !expanded && 'line-clamp-2')}>{ev.snippet}</p>}
                    {ev.creator_email && <p className="text-[10px] text-muted-foreground mt-0.5">{ev.creator_email}</p>}
                  </div>
                </button>
                {expanded && (
                  <div className="mt-2 pl-7 space-y-2">
                    {ev.body_html ? (
                      <div className="text-[11px] prose prose-sm max-w-none text-foreground [&_a]:text-[hsl(var(--info))] [&_img]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: ev.body_html }} />
                    ) : ev.gmail_id ? (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> A carregar email...</p>
                    ) : null}
                    {ev.gmail_url && (
                      <a href={ev.gmail_url} target="_blank" rel="noreferrer" className="text-[10px] text-[hsl(var(--info))] inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Abrir no Gmail
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!timeline.isLoading && !gmail.isLoading && events.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Sem eventos para este filtro.</p>
          )}
        </div>
      </div>

    </div>
  );
}

function LeadTasks({ leadId, tasks, loading }: { leadId: string; tasks: any[]; loading: boolean }) {
  const { toast } = useToast();
  const createTask = useCreateNHTask();
  const updateTask = useUpdateNHTask();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due: '', allDay: false, priority: 'medium', assignee: '' });

  const create = () => {
    if (!form.title.trim()) return;
    createTask.mutate({
      title: form.title.trim(),
      description: form.description,
      due_at: form.due ? new Date(form.due).toISOString() : null,
      all_day: form.allDay,
      priority: form.priority,
      assignee_emails: form.assignee ? form.assignee.split(',').map(s => s.trim()).filter(Boolean) : [],
      lead_id: leadId,
    }, {
      onSuccess: () => { setOpen(false); setForm({ title: '', description: '', due: '', allDay: false, priority: 'medium', assignee: '' }); toast({ title: 'Task criada no NetHunt' }); },
      onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="bg-card border rounded-lg">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tasks NetHunt</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="text-xs"><Plus className="h-3 w-3 mr-1" /> Nova task</Button></DialogTrigger>
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
      <div className="divide-y">
        {loading && <div className="p-4"><Skeleton className="h-10 w-full" /></div>}
        {tasks.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
            <button onClick={() => updateTask.mutate({ id: t.id, changes: { completed: !t.completed } })}>
              {t.completed ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-medium truncate', t.completed && 'line-through text-muted-foreground')}>{t.title}</p>
              {t.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{t.description}</p>}
            </div>
            {t.due_at && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(t.due_at), 'dd/MM HH:mm')}</span>}
            {t.assignee_emails?.length ? <span className="text-[10px] text-muted-foreground hidden sm:inline">{t.assignee_emails[0]}</span> : null}
          </div>
        ))}
        {!loading && tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sem tasks ligadas.</p>}
      </div>
    </div>
  );
}
