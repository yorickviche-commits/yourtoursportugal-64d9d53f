import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, SkipForward, ChevronLeft, ChevronRight, CheckCircle2, Bold, Underline, Link as LinkIcon, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface QueueEmail {
  key: string;                 // unique id
  to: string;
  subject: string;
  bodyHtml: string;
  recipientLabel: string;      // e.g. supplier name
  serviceLabel: string;        // e.g. activity name
  contextNote?: string;        // e.g. "Dia 1 · 08:15 · 4 pax · €125"
}

interface Props {
  emails: QueueEmail[];
  /** Called when the user presses Send for one email. Resolve true on success. */
  onSend: (email: QueueEmail) => Promise<boolean>;
  onClose?: () => void;
  /** Optional callback fired when all done */
  onAllDone?: () => void;
}

const EmailReviewQueue = ({ emails, onSend, onClose, onAllDone }: Props) => {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  const [idx, setIdx] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, 'pending' | 'sent' | 'skipped'>>({});
  const [sending, setSending] = useState(false);
  const [editedSubjects, setEditedSubjects] = useState<Record<string, string>>({});
  const [editedTos, setEditedTos] = useState<Record<string, string>>({});
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});

  const total = emails.length;
  const sentCount = Object.values(statuses).filter(s => s === 'sent').length;
  const skippedCount = Object.values(statuses).filter(s => s === 'skipped').length;
  const current = emails[idx];

  useEffect(() => {
    if (!current || !editorRef.current) return;
    editorRef.current.innerHTML = editedBodies[current.key] ?? current.bodyHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, current?.key]);

  useEffect(() => {
    if (total > 0 && sentCount + skippedCount === total) onAllDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentCount, skippedCount, total]);

  if (!current) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-medium">Fila vazia</p>
        <p className="text-xs text-muted-foreground mt-1">Não há emails para preparar.</p>
        {onClose && <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={onClose}>Fechar</Button>}
      </div>
    );
  }

  const captureBody = () => {
    if (current && editorRef.current) {
      setEditedBodies(prev => ({ ...prev, [current.key]: editorRef.current!.innerHTML }));
    }
  };

  const goto = (i: number) => {
    captureBody();
    setIdx(Math.max(0, Math.min(total - 1, i)));
  };

  const handleSend = async () => {
    captureBody();
    const to = editedTos[current.key] ?? current.to;
    const subject = editedSubjects[current.key] ?? current.subject;
    const bodyHtml = editorRef.current?.innerHTML ?? current.bodyHtml;
    if (!to.trim()) {
      toast({ title: 'Email do destinatário em falta', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const ok = await onSend({ ...current, to, subject, bodyHtml });
      if (ok) {
        setStatuses(p => ({ ...p, [current.key]: 'sent' }));
        toast({ title: `Enviado para ${current.recipientLabel}` });
        // advance
        if (idx < total - 1) setIdx(idx + 1);
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => {
    setStatuses(p => ({ ...p, [current.key]: 'skipped' }));
    if (idx < total - 1) setIdx(idx + 1);
  };

  const handleSendAllRemaining = async () => {
    captureBody();
    setSending(true);
    try {
      for (let i = idx; i < total; i++) {
        const e = emails[i];
        if (statuses[e.key] === 'sent' || statuses[e.key] === 'skipped') continue;
        const to = editedTos[e.key] ?? e.to;
        const subject = editedSubjects[e.key] ?? e.subject;
        const bodyHtml = i === idx ? (editorRef.current?.innerHTML ?? e.bodyHtml) : (editedBodies[e.key] ?? e.bodyHtml);
        if (!to.trim()) {
          setStatuses(p => ({ ...p, [e.key]: 'skipped' }));
          continue;
        }
        const ok = await onSend({ ...e, to, subject, bodyHtml });
        setStatuses(p => ({ ...p, [e.key]: ok ? 'sent' : 'skipped' }));
      }
      toast({ title: 'Lote de emails processado' });
    } catch (err: any) {
      toast({ title: 'Erro no envio em massa', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };
  const insertLink = () => {
    const url = window.prompt('URL:', 'https://');
    if (url) exec('createLink', url);
  };

  const currentStatus = statuses[current.key] || 'pending';

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      {/* Top bar */}
      <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 text-[hsl(var(--info))]" />
          <span className="text-sm font-semibold">Email {idx + 1} de {total}</span>
          <span className="text-xs text-muted-foreground truncate">— {current.recipientLabel}</span>
          {currentStatus === 'sent' && <Badge className="bg-emerald-500/15 text-emerald-700 text-[10px]">Enviado</Badge>}
          {currentStatus === 'skipped' && <Badge variant="outline" className="text-[10px]">Saltado</Badge>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>✓ {sentCount}</span>
          <span>⏭ {skippedCount}</span>
          <span>· {total - sentCount - skippedCount} pendentes</span>
        </div>
      </div>

      {/* Service context */}
      <div className="px-4 py-2 border-b bg-blue-50/40 text-xs">
        <span className="font-medium">{current.serviceLabel}</span>
        {current.contextNote && <span className="text-muted-foreground"> · {current.contextNote}</span>}
      </div>

      {/* Fields */}
      <div className="p-4 space-y-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-medium">Para</label>
          <Input
            value={editedTos[current.key] ?? current.to}
            onChange={e => setEditedTos(p => ({ ...p, [current.key]: e.target.value }))}
            placeholder="email@fornecedor.pt"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-medium">Assunto</label>
          <Input
            value={editedSubjects[current.key] ?? current.subject}
            onChange={e => setEditedSubjects(p => ({ ...p, [current.key]: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase font-medium">Corpo</label>
          <div className="flex items-center gap-1 border border-b-0 rounded-t-md bg-muted/30 px-1.5 py-1">
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')}
              className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Bold">
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')}
              className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Underline">
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={insertLink}
              className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Link">
              <LinkIcon className="h-3.5 w-3.5" />
            </button>
            <span className="ml-auto text-[10px] text-muted-foreground pr-1">Edita livremente antes de enviar</span>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[260px] max-h-[420px] overflow-y-auto border rounded-b-md p-3 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: 1.5 }}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => goto(idx - 1)} disabled={idx === 0}>
            <ChevronLeft className="h-3 w-3" /> Anterior
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => goto(idx + 1)} disabled={idx === total - 1}>
            Próximo <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={handleSkip} disabled={sending}>
            <SkipForward className="h-3 w-3" /> Saltar
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSendAllRemaining} disabled={sending}>
            Enviar restantes
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSend} disabled={sending || currentStatus === 'sent'}>
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Enviar
          </Button>
        </div>
      </div>

      {/* Mini queue map */}
      <div className="px-4 py-2 border-t flex items-center gap-1 overflow-x-auto bg-white">
        {emails.map((e, i) => {
          const s = statuses[e.key] || 'pending';
          return (
            <button
              key={e.key}
              onClick={() => goto(i)}
              className={cn(
                'shrink-0 px-2 py-1 rounded text-[10px] border transition-colors',
                i === idx ? 'border-foreground bg-foreground/5 font-medium' : 'border-transparent hover:bg-muted',
                s === 'sent' && 'text-emerald-700',
                s === 'skipped' && 'text-muted-foreground line-through',
              )}
              title={e.recipientLabel}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EmailReviewQueue;
