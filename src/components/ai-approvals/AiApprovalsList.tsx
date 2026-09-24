import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Pencil, Loader2, Mail, CreditCard, Truck, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/hooks/useActivityLog';
import { eur } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface QueueItem {
  id: string; type: 'client_email' | 'fse_email' | 'payment_link';
  lead_id: string | null; lead_code: string | null; title: string; subtitle: string | null;
  payload: Record<string, any>; status: string; created_at: string; error: string | null; result: any;
}

const TYPE_META = {
  client_email: { label: 'Email cliente', icon: Mail },
  fse_email: { label: 'Email FSE', icon: Truck },
  payment_link: { label: 'Link pagamento', icon: CreditCard },
} as const;

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
  approved: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]',
  executed: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
  failed: 'bg-[hsl(var(--urgent))]/15 text-[hsl(var(--urgent))]',
  rejected: 'bg-muted text-muted-foreground',
};
const STATUS_PT: Record<string, string> = { pending: 'Pendente', approved: 'Aprovado', executed: 'Executado', failed: 'Falhou', rejected: 'Rejeitado' };

export const useAiQueue = (leadId?: string) =>
  useQuery({
    queryKey: ['ai_action_queue', leadId ?? 'all'],
    queryFn: async () => {
      let q = (supabase.from('ai_action_queue' as any) as any).select('*').order('created_at', { ascending: false }).limit(200);
      if (leadId) q = q.eq('lead_id', leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as QueueItem[];
    },
    refetchInterval: 30000,
  });

async function fnError(error: any, data: any) {
  let msg = error?.message;
  try { const p = await error?.context?.json?.(); if (p?.error) msg = String(p.error); } catch { /* keep */ }
  if (data?.error) msg = String(data.error);
  return msg;
}

async function toBase64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function execute(item: QueueItem, p: Record<string, any>) {
  if (item.type === 'payment_link') {
    const { data: lead } = await supabase.from('leads').select('travel_dates, travel_end_date').eq('id', item.lead_id!).maybeSingle();
    const body = {
      action: 'create', lead_id: item.lead_id, proposal_id: p.proposal_id ?? null,
      title: p.description || item.title, trip_ref: p.trip_ref ?? item.lead_code,
      start_date: p.start_date || (lead as any)?.travel_dates, end_date: p.end_date || (lead as any)?.travel_end_date || p.start_date,
      amount_cents: Math.round(Number(p.amount_eur) * 100), currency: 'EUR', deposit_cents: p.deposit_cents ?? null,
    };
    const { data, error } = await supabase.functions.invoke('wetravel-create-payment-link', { body });
    if (error || (data as any)?.error) throw new Error(await fnError(error, data));
    return { payment_link: (data as any)?.payment_link ?? null };
  }
  if (!p.to) throw new Error('Sem destinatário');
  const attachments: any[] = [];
  for (const a of p.attachments || []) {
    if (!a?.path) continue;
    const { data: blob, error } = await supabase.storage.from('travel-plan-pdfs').download(a.path);
    if (error || !blob) throw new Error(`Anexo ${a.filename}: ${error?.message}`);
    attachments.push({ filename: a.filename, mimeType: 'application/pdf', contentBase64: await toBase64(blob) });
  }
  const { data, error } = await supabase.functions.invoke('send-booking-email', {
    body: { to: p.to, subject: p.subject, html: p.html, cc: (p.cc || []).join(', ') || undefined, bcc: (p.bcc || []).join(', ') || undefined, attachments },
  });
  if (error || (data as any)?.error) throw new Error(await fnError(error, data));
  // Mirror to Communications (activity) and NetHunt as the UI does
  if (item.lead_id) {
    await logActivity('email_sent', 'lead', item.lead_id, { to: p.to, subject: p.subject, via: 'Aprovações AI' });
    const { data: l } = await supabase.from('leads').select('nethunt_record_id').eq('id', item.lead_id).maybeSingle();
    if ((l as any)?.nethunt_record_id) {
      await supabase.functions.invoke('nethunt-push', { body: { entity: 'comment', id: item.lead_id, changes: { text: `📧 Email enviado (${TYPE_META[item.type].label}) para ${p.to}: ${p.subject}` } } }).catch(() => null);
    }
  }
  return { sent: true, message_id: (data as any)?.id ?? null };
}

function Preview({ item, p }: { item: QueueItem; p: Record<string, any> }) {
  if (item.type === 'payment_link') {
    return (
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Montante</span><p className="font-semibold text-sm">{eur(Number(p.amount_eur) || 0)}</p></div>
        <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{p.kind}</p></div>
        <div><span className="text-muted-foreground">PVP total</span><p>{eur(Number(p.total_pvp_eur) || 0)}</p></div>
        <div><span className="text-muted-foreground">Descrição</span><p>{p.description}</p></div>
        {p.requires_ceo_approval && <p className="col-span-2 text-[hsl(var(--urgent))] font-medium">Acima de 8.000,00€ — requer aprovação do CEO</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-xs space-y-0.5">
        <p><span className="text-muted-foreground">Para:</span> {p.to || <span className="text-[hsl(var(--urgent))]">sem email</span>}{p.cc?.length ? ` · cc ${p.cc.join(', ')}` : ''}</p>
        <p><span className="text-muted-foreground">Assunto:</span> <strong>{p.subject}</strong></p>
        {(p.attachments || []).map((a: any) => (
          <a key={a.filename} href={a.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[hsl(var(--info))] hover:underline mr-3"><Paperclip className="h-3 w-3" />{a.filename}</a>
        ))}
      </div>
      <iframe title="preview" sandbox="" srcDoc={p.html || ''} className="w-full h-72 rounded border bg-background" />
    </div>
  );
}

function Card({ item }: { item: QueueItem }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(item.status === 'pending');
  const [draft, setDraft] = useState<Record<string, any>>(item.payload || {});
  const [busy, setBusy] = useState<string | null>(null);
  const Meta = TYPE_META[item.type];

  const setStatus = async (updates: Record<string, any>) => {
    const { error } = await (supabase.from('ai_action_queue' as any) as any).update(updates).eq('id', item.id);
    if (error) throw error;
  };

  const approve = async () => {
    setBusy('approve');
    try {
      const { data: u } = await supabase.auth.getUser();
      if (item.status !== 'approved') await setStatus({ status: 'approved', payload: draft, reviewed_by: u.user?.id, reviewed_at: new Date().toISOString() });
      try {
        const result = await execute(item, draft);
        await setStatus({ status: 'executed', result, error: null });
        toast({ title: item.type === 'payment_link' ? 'Link de pagamento criado' : 'Email enviado' });
      } catch (e: any) {
        await setStatus({ status: 'failed', error: e.message });
        toast({ title: 'Falhou a execução', description: e.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null); qc.invalidateQueries({ queryKey: ['ai_action_queue'] });
    }
  };

  const reject = async () => {
    setBusy('reject');
    try {
      const { data: u } = await supabase.auth.getUser();
      await setStatus({ status: 'rejected', reviewed_by: u.user?.id, reviewed_at: new Date().toISOString() });
      toast({ title: 'Rejeitado' });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    finally { setBusy(null); qc.invalidateQueries({ queryKey: ['ai_action_queue'] }); }
  };

  const actionable = ['pending', 'failed', 'approved'].includes(item.status);

  return (
    <div className="bg-card rounded-lg border">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left p-3 flex items-start gap-3">
        <Meta.icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {Meta.label} · {new Date(item.created_at).toLocaleString('pt-PT')}
            {item.lead_id && <> · <Link onClick={e => e.stopPropagation()} to={`/leads/${item.lead_id}`} className="text-[hsl(var(--info))] hover:underline">{item.lead_code}</Link></>}
          </p>
          {item.error && <p className="text-xs text-[hsl(var(--urgent))] mt-1">{item.error}</p>}
        </div>
        <Badge className={cn('shrink-0 border-0', STATUS_CLS[item.status])}>{STATUS_PT[item.status] ?? item.status}</Badge>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3">
          {editing ? (
            item.type === 'payment_link' ? (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.01" value={draft.amount_eur ?? ''} onChange={e => setDraft({ ...draft, amount_eur: Number(e.target.value) })} placeholder="Montante €" />
                <Input value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Descrição" />
              </div>
            ) : (
              <div className="space-y-2">
                <Input value={draft.to ?? ''} onChange={e => setDraft({ ...draft, to: e.target.value })} placeholder="Para" />
                <Input value={draft.subject ?? ''} onChange={e => setDraft({ ...draft, subject: e.target.value })} placeholder="Assunto" />
                <Textarea rows={10} className="font-mono text-xs" value={draft.html ?? ''} onChange={e => setDraft({ ...draft, html: e.target.value })} />
              </div>
            )
          ) : <Preview item={item} p={draft} />}
          {actionable && (
            <div className="flex flex-wrap gap-2 sticky bottom-0 bg-card pt-1">
              <Button size="sm" onClick={approve} disabled={!!busy} className="min-h-[44px] sm:min-h-0 bg-[hsl(var(--success))] text-primary-foreground hover:opacity-90">
                {busy === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar e executar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(e => !e)} disabled={!!busy} className="min-h-[44px] sm:min-h-0">
                <Pencil className="h-3.5 w-3.5" /> {editing ? 'Pré-visualizar' : 'Editar'}
              </Button>
              {item.status !== 'approved' && (
                <Button size="sm" variant="outline" onClick={reject} disabled={!!busy} className="min-h-[44px] sm:min-h-0">
                  {busy === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Rejeitar
                </Button>
              )}
            </div>
          )}
          {item.status === 'executed' && item.result?.payment_link?.checkout_url && (
            <a href={item.result.payment_link.checkout_url} target="_blank" rel="noreferrer" className="text-xs text-[hsl(var(--info))] hover:underline">Abrir link WeTravel →</a>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiApprovalsList({ leadId, compact }: { leadId?: string; compact?: boolean }) {
  const { data = [], isLoading } = useAiQueue(leadId);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  if (isLoading) return <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  const pending = data.filter(i => ['pending', 'approved', 'failed'].includes(i.status));
  const done = data.filter(i => !['pending', 'approved', 'failed'].includes(i.status));
  if (compact && !data.length) return null;
  const list = tab === 'pending' ? pending : done;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'pending' ? 'default' : 'outline'} onClick={() => setTab('pending')}>A aguardar ({pending.length})</Button>
        <Button size="sm" variant={tab === 'done' ? 'default' : 'outline'} onClick={() => setTab('done')}>Histórico ({done.length})</Button>
      </div>
      {list.map(i => <Card key={i.id} item={i} />)}
      {!list.length && <div className="bg-card rounded-lg border p-6 text-center text-sm text-muted-foreground">Nada {tab === 'pending' ? 'a aguardar aprovação' : 'no histórico'}.</div>}
    </div>
  );
}
