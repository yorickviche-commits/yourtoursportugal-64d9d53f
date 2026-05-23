import { useState, useMemo } from 'react';
import { Mail, Send, Loader2, Clock, ChevronRight, Paperclip, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EMAIL_TEMPLATES, renderTemplate, type EmailTemplate, type TemplateContext } from '@/data/emailTemplates';
import { buildProposalPdfBase64, buildProposalEmailText, type ProposalLite } from '@/lib/proposalPdf';

interface Props {
  scope: 'lead' | 'trip';
  entityId: string;          // lead.id or trip.id
  recipientEmail?: string;   // client email
  context: TemplateContext;
}

interface EmailLogRow {
  id: string;
  subject: string;
  body: string;
  supplier_email: string | null;
  sent_at: string;
  email_category: string | null;
}

const CommunicationsTab = ({ scope, entityId, recipientEmail, context }: Props) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);

  const filterField = scope === 'lead' ? 'lead_id' : 'trip_id';

  // Latest proposal for this lead/trip — used to auto-attach Travel Plan & weblink
  const { data: latestProposal } = useQuery({
    queryKey: ['latest_proposal', scope, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const col = scope === 'lead' ? 'lead_id' : 'booking_id';
      const { data } = await supabase
        .from('proposals')
        .select('id, title, client_name, date_range, participants, summary_text, total_value_eur, public_token, days')
        .eq(col, entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as ProposalLite | null) || null;
    },
    enabled: !!entityId,
  });

  const proposalWeblink = latestProposal?.public_token
    ? `${window.location.origin}/proposal/${latestProposal.public_token}`
    : '';

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['comms_log', scope, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from('booking_emails_log')
        .select('id, subject, body, supplier_email, sent_at, email_category')
        .eq(filterField, entityId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EmailLogRow[];
    },
    enabled: !!entityId,
  });

  const templates = useMemo(
    () => EMAIL_TEMPLATES.filter(t => t.group === (scope === 'lead' ? 'sales' : 'ops')),
    [scope],
  );

  const isProposalTemplate = selected?.key === 'sales_proposal';

  const openTemplate = (t: EmailTemplate) => {
    const rendered = renderTemplate(t, context);
    let finalBody = rendered.body;
    // Auto-inject interactive weblink for proposal sends
    if (t.key === 'sales_proposal' && proposalWeblink) {
      const linkBlock = `\n\n— Interactive Travel Plan (mobile-friendly):\n${proposalWeblink}\n\nThe full PDF version is attached for your records.`;
      // Insert before the signature ("Warmly,")
      if (finalBody.includes('Warmly,')) {
        finalBody = finalBody.replace('Warmly,', `${linkBlock}\n\nWarmly,`);
      } else {
        finalBody = `${finalBody}${linkBlock}`;
      }
    }
    setSelected(t);
    setTo(recipientEmail || '');
    setSubject(rendered.subject);
    setBody(finalBody);
    setAttachPdf(t.key === 'sales_proposal' && !!latestProposal);
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: 'Destinatário em falta', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const attachments: Array<{ filename: string; mimeType: string; contentBase64: string }> = [];
      if (isProposalTemplate && attachPdf && latestProposal) {
        const { base64, filename } = buildProposalPdfBase64(latestProposal, proposalWeblink);
        attachments.push({ filename, mimeType: 'application/pdf', contentBase64: base64 });
      }

      const { data: sendData, error: sendError } = await supabase.functions.invoke('send-booking-email', {
        body: { to, subject, body, attachments },
      });
      if (sendError || (sendData as any)?.error) {
        throw new Error((sendData as any)?.error || sendError?.message || 'Falha ao enviar');
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('booking_emails_log').insert({
        [filterField]: entityId,
        supplier_email: to,
        subject,
        body,
        email_category: selected?.key,
        sent_by: user?.id || null,
      } as any);

      toast({
        title: 'Email enviado',
        description: `${to}${attachments.length ? ' · Travel Plan PDF anexo' : ''}`,
      });
      qc.invalidateQueries({ queryKey: ['comms_log', scope, entityId] });
      setSelected(null);
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            {scope === 'lead' ? 'Comunicações de Vendas' : 'Comunicações Operacionais'}
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Envia diretamente da caixa <strong>reservas@yourtours.pt</strong>. Cada envio fica registado abaixo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
          {templates.map(t => (
            <button
              key={t.key}
              onClick={() => openTemplate(t)}
              className="text-left p-2.5 rounded border border-border hover:border-primary hover:bg-muted/40 transition group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{t.description}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Histórico ({history.length})</h2>
          <span className="text-[10px] text-muted-foreground">Mais recente primeiro</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem comunicações registadas.</p>
        ) : (
          <div className="divide-y divide-border">
            {history.map(h => {
              const tpl = EMAIL_TEMPLATES.find(t => t.key === h.email_category);
              return (
                <details key={h.id} className="px-4 py-2.5 group">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {tpl && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            {tpl.label}
                          </span>
                        )}
                        <span className="text-xs font-medium truncate">{h.subject}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{new Date(h.sent_at).toLocaleString('pt-PT')}</span>
                        {h.supplier_email && <span>→ {h.supplier_email}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground group-open:rotate-90 transition" />
                  </summary>
                  <pre className="text-[11px] mt-2 whitespace-pre-wrap font-sans text-muted-foreground bg-muted/30 p-2 rounded">
                    {h.body}
                  </pre>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" /> {selected?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-medium">Para</label>
              <Input value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs" placeholder="cliente@email.com" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-medium">Assunto</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-medium">Corpo</label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} className="text-xs min-h-[260px] font-mono" />
            </div>

            {isProposalTemplate && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                {proposalWeblink ? (
                  <div className="flex items-center gap-2 text-[11px]">
                    <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium">Weblink interativo:</span>
                    <a href={proposalWeblink} target="_blank" rel="noopener" className="text-primary truncate hover:underline">
                      {proposalWeblink}
                    </a>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-700">
                    Sem proposta gerada para esta lead — cria uma proposta primeiro para incluir weblink + PDF.
                  </div>
                )}
                <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                  <Checkbox
                    checked={attachPdf}
                    onCheckedChange={(v) => setAttachPdf(!!v)}
                    disabled={!latestProposal}
                  />
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Anexar PDF do Travel Plan automaticamente</span>
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)} className="text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleSend} disabled={sending} className="text-xs gap-1">
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Enviar via reservas@yourtours.pt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunicationsTab;
