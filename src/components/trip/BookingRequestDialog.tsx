import { useRef, useState } from 'react';
import { Mail, Loader2, Send, Bold, Underline, Link as LinkIcon, Paperclip, Image as ImageIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUpsertTripOperation } from '@/hooks/useTripOperationsQuery';
import { useUpsertLeadOperation } from '@/hooks/useLeadOperationsQuery';
import { useCreateBookingEmail } from '@/hooks/useBookingEmailsQuery';
import { supabase } from '@/integrations/supabase/client';

interface BookingRequestDialogProps {
  operationId: string | null;
  costItemId: string;
  tripId: string;
  tripCode: string;
  activityName: string;
  activityDate: string;
  scheduleTime: string;
  supplierName: string;
  supplierEmail: string;
  pax: number;
  netValue: number;
  isLeadContext?: boolean;
  dayNumber?: number;
}

interface AttachmentItem {
  filename: string;
  mimeType: string;
  contentBase64: string;
  sizeKb: number;
}

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => {
    const result = r.result as string;
    resolve(result.split(',')[1] || '');
  };
  r.onerror = reject;
  r.readAsDataURL(file);
});

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BookingRequestDialog = ({
  operationId, costItemId, tripId, tripCode,
  activityName, activityDate, scheduleTime,
  supplierName, supplierEmail: initialSupplierEmail, pax, netValue,
  isLeadContext = false, dayNumber = 1,
}: BookingRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const createEmailLog = useCreateBookingEmail();
  const upsertTripOp = useUpsertTripOperation();
  const upsertLeadOp = useUpsertLeadOperation();

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assunto padrão: Ref YT · FSE · Data · Pedido de Reserva
  const defaultSubject = [tripCode, supplierName, activityDate, 'Pedido de Reserva']
    .map(v => (v || '').toString().trim())
    .filter(Boolean)
    .join(' · ');

  const defaultBodyText = `Bom dia,

Vimos solicitar reserva para o seguinte serviço:

Serviço: ${activityName}
Data: ${activityDate || '[data a confirmar]'}
Hora: ${scheduleTime || '[hora a confirmar]'}
Nº de pessoas: ${pax}
Valor acordado: €${netValue.toFixed(2)}
Referência: ${tripCode}

Agradecemos a confirmação de disponibilidade e o envio da confirmação de reserva.

Obrigado e bom trabalho,
Your Tours Portugal
reservas@yourtours.pt`;

  const defaultBodyHtml = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">${
    escapeHtml(defaultBodyText).replace(/\n/g, '<br>')
  }</div>`;

  const [to, setTo] = useState(initialSupplierEmail);
  const [subject, setSubject] = useState(defaultSubject);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const AI_PROMPTS = [
    'Pedido de disponibilidade para este serviço',
    'Confirmar reserva já falada por telefone',
    'Alterar horário do serviço',
    'Alterar número de pax',
    'Pedir tarifa net e condições de pagamento',
    'Reconfirmação 48h antes do serviço',
    'Pedido de fatura do serviço',
  ];

  const runAiCompose = async (instruction: string) => {
    setAiLoading(true);
    try {
      const context = [
        `Referência YT: ${tripCode}`,
        `Fornecedor (FSE): ${supplierName || 'desconhecido'}`,
        `Serviço: ${activityName}`,
        `Data: ${activityDate || 'a confirmar'}`,
        `Hora: ${scheduleTime || 'a confirmar'}`,
        `Pax: ${pax}`,
        `Valor net acordado: €${netValue.toFixed(2)}`,
      ].join('\n');
      const prompt = `Escreve um email operacional em PORTUGUÊS DE PORTUGAL para um fornecedor (FSE) da Your Tours Portugal.
Objetivo: ${instruction}

Contexto do serviço:
${context}

Regras: tom direto e cordial (estilo founder), parágrafos curtos, sem floreados, incluir sempre os dados do serviço relevantes, terminar com pedido de ação claro e assinatura "Your Tours Portugal · reservas@yourtours.pt".
Devolve APENAS o corpo do email em texto simples, sem assunto e sem comentários.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: [{ role: 'user', content: prompt }] },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || (data as any)?.error;
      if (!reply) throw new Error('Sem resposta da AI');
      if (editorRef.current) {
        editorRef.current.innerHTML = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">${
          escapeHtml(String(reply).trim()).replace(/\n/g, '<br>')
        }</div>`;
      }
      toast({ title: 'Rascunho AI inserido', description: 'Revê e edita antes de enviar.' });
    } catch (err: any) {
      toast({ title: 'Erro na AI', description: err.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpen = async (isOpen: boolean) => {
    if (isOpen) {
      let email = initialSupplierEmail;
      if (!email && supplierName) {
        try {
          const { data: supplier } = await supabase
            .from('suppliers').select('contact_email')
            .ilike('name', `%${supplierName}%`).maybeSingle();
          if (supplier?.contact_email) email = supplier.contact_email;
          else {
            const { data: partner } = await supabase
              .from('partners').select('contact_email')
              .ilike('name', `%${supplierName}%`).maybeSingle();
            if (partner?.contact_email) email = partner.contact_email;
          }
        } catch { /* ignore */ }
      }
      setTo(email);
      setSubject(defaultSubject);
      setAttachments([]);
      // Reset editor on next tick (after mount)
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = defaultBodyHtml;
      }, 0);
    }
    setOpen(isOpen);
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const onInsertLink = () => {
    const url = window.prompt('URL do link:', 'https://');
    if (!url) return;
    exec('createLink', url);
    // open in new tab
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const a = (sel.anchorNode as HTMLElement).parentElement?.closest('a');
      if (a) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    }
  };

  const onPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (!file) return;
      const b64 = await fileToBase64(file);
      const dataUri = `data:${file.type};base64,${b64}`;
      exec('insertHTML', `<img src="${dataUri}" alt="" style="max-width:100%;height:auto;display:block;margin:8px 0" />`);
    }
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const next: AttachmentItem[] = [];
    for (const f of files) {
      const b64 = await fileToBase64(f);
      next.push({
        filename: f.name,
        mimeType: f.type || 'application/octet-stream',
        contentBase64: b64,
        sizeKb: Math.round(f.size / 1024),
      });
    }
    setAttachments(prev => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onInsertInlineImage = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      const b64 = await fileToBase64(f);
      const dataUri = `data:${f.type};base64,${b64}`;
      exec('insertHTML', `<img src="${dataUri}" alt="" style="max-width:100%;height:auto;display:block;margin:8px 0" />`);
    };
    inp.click();
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: 'Email do fornecedor em falta', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const html = editorRef.current?.innerHTML || defaultBodyHtml;
      const { data: sendData, error: sendError } = await supabase.functions.invoke('send-booking-email', {
        body: { to, subject, html, attachments },
      });
      if (sendError || (sendData as any)?.error) {
        throw new Error((sendData as any)?.error || sendError?.message || 'Falha ao enviar email');
      }

      // Store a plain-text excerpt in the log for readability
      const plain = (editorRef.current?.innerText || '').slice(0, 8000);

      if (isLeadContext) {
        const result = await upsertLeadOp.mutateAsync({
          lead_id: tripId,
          item_key: costItemId,
          day_number: dayNumber,
          booking_status: 'requested',
        });
        const leadOpId = (result as any)?.id;
        if (leadOpId) {
          await createEmailLog.mutateAsync({
            lead_operation_id: leadOpId, supplier_email: to, subject, body: plain,
          });
        }
      } else {
        const op = await upsertTripOp.mutateAsync({
          cost_item_id: costItemId, trip_id: tripId, booking_status: 'requested',
        });
        await createEmailLog.mutateAsync({
          operation_id: op.id, supplier_email: to, subject, body: plain,
        });
      }

      toast({ title: 'Email enviado', description: `Pedido enviado para ${to} via reservas@yourtours.pt` });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-muted rounded" title="Enviar pedido de reserva">
          <Send className="h-3 w-3 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Pedido de Reserva — {activityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Para</label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@fornecedor.pt" className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Assunto</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-xs" />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Corpo do email</label>

            {/* AI compose helper */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <select
                className="h-7 text-[11px] border rounded px-1.5 bg-background max-w-[260px]"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
              >
                <option value="">Sugestões de prompt…</option>
                {AI_PROMPTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1"
                disabled={aiLoading}
                onClick={() => runAiCompose(aiPrompt || 'Pedido de disponibilidade para este serviço')}
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI — Compor
              </Button>
              <span className="text-[10px] text-muted-foreground">Gera em PT e mantém-se editável</span>
            </div>
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 border border-b-0 rounded-t-md bg-muted/30 px-1.5 py-1">
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')}
                className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Bold (Ctrl+B)">
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')}
                className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Underline (Ctrl+U)">
                <Underline className="h-3.5 w-3.5" />
              </button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={onInsertLink}
                className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Inserir link">
                <LinkIcon className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={onInsertInlineImage}
                className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Inserir imagem no corpo">
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
                className="h-6 w-6 grid place-items-center rounded hover:bg-muted" title="Anexar ficheiro">
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <span className="ml-auto text-[10px] text-muted-foreground pr-1">Cola screenshots (Ctrl+V)</span>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onPaste={onPaste}
              className="min-h-[220px] max-h-[400px] overflow-y-auto border rounded-b-md p-3 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: 1.5 }}
            />
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />

            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-[11px]">
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{a.filename}</span>
                    <span className="text-muted-foreground">({a.sizeKb} KB)</span>
                    <button
                      onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleSend} disabled={sending} className="text-xs gap-1">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Enviar & Atualizar Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingRequestDialog;
