import { useState } from 'react';
import { Mail, Loader2, Copy, Check, ChevronRight, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LeadContext {
  clientName: string;
  email: string;
  phone?: string;
  destination: string;
  travelDates: string;
  pax: number;
  status: string;
  budgetLevel: string;
  travelStyle?: string[];
  comfortLevel?: string;
  magicQuestion?: string;
  notes?: string;
  leadId?: string;
}

interface EmailComposerDialogProps {
  lead: LeadContext;
  children?: React.ReactNode;
}

const EMAIL_TEMPLATES = [
  { key: 'new_inquiry', label: '1. Nova Consulta', stage: 'Sales', description: 'Resposta inicial + discovery questions' },
  { key: 'proposal_followup', label: '2. Follow-up Proposta (24h)', stage: 'Sales', description: 'Verificar se recebeu a proposta' },
  { key: 'followup_3days', label: '3. Follow-up 3 dias', stage: 'Sales', description: 'Sugestão extra de valor' },
  { key: 'followup_7days', label: '4. Follow-up 7 dias', stage: 'Sales', description: 'Manter datas reservadas?' },
  { key: 'breakup', label: '5. Break-up Email', stage: 'Sales', description: 'Último contacto, porta aberta' },
  { key: 'booking_confirmed', label: '6. Booking Confirmado', stage: 'Ops', description: 'Recap completo + instruções' },
  { key: 'supplier_confirmation', label: '7. Confirmação Fornecedor', stage: 'Ops', description: 'Detalhes de reserva ao FSE' },
  { key: 'guide_briefing', label: '8. Briefing Guia', stage: 'Ops', description: 'Briefing completo do tour' },
  { key: 'post_tour_review', label: '9. Pós-Tour Review', stage: 'Ops', description: 'Pedido de feedback + review' },
];

type Step = 'select_template' | 'confirm_details' | 'preview';

const EmailComposerDialog = ({ lead, children }: EmailComposerDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('select_template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [senderName, setSenderName] = useState('Yorick');
  const [loading, setLoading] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string; internal_notes: any } | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setStep('select_template');
    setSelectedTemplate(null);
    setCustomNotes('');
    setGeneratedEmail(null);
    setCopied(false);
  };

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplate(key);
    setStep('confirm_details');
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: {
          templateKey: selectedTemplate,
          leadContext: {
            ...lead,
            senderName,
          },
          customNotes,
        },
      });
      if (error) throw error;
      if (data?.email) {
        setGeneratedEmail(data.email);
        setEditedSubject(data.email.subject);
        setEditedBody(data.email.body);
        setStep('preview');
      }
    } catch (e: any) {
      console.error('Email generation error:', e);
      toast({ title: 'Erro na geração', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    // Build Gmail-compatible HTML
    const htmlBody = editedBody
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');

    const html = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${htmlBody}</div>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([editedBody], { type: 'text/plain' }),
        }),
      ]);
      setCopied(true);
      toast({ title: 'Copiado!', description: 'Email pronto para colar no Gmail (Ctrl+V)' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback to plain text
      await navigator.clipboard.writeText(editedBody);
      setCopied(true);
      toast({ title: 'Copiado (texto)', description: 'Colado como texto simples' });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCopySubject = async () => {
    await navigator.clipboard.writeText(editedSubject);
    toast({ title: 'Subject copiado!' });
  };

  const selectedTemplateInfo = EMAIL_TEMPLATES.find(t => t.key === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <Mail className="h-3 w-3" /> Compor Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[hsl(var(--info))]" />
            Email Composer — {lead.clientName}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select template */}
        {step === 'select_template' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">Seleciona o tipo de email para este lead:</p>
            
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sales Pipeline</p>
            {EMAIL_TEMPLATES.filter(t => t.stage === 'Sales').map(t => (
              <button key={t.key} onClick={() => handleSelectTemplate(t.key)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-[hsl(var(--info))] hover:bg-[hsl(var(--info)/0.05)] transition-colors text-left group">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--info))]" />
              </button>
            ))}

            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-4">Operations Pipeline</p>
            {EMAIL_TEMPLATES.filter(t => t.stage === 'Ops').map(t => (
              <button key={t.key} onClick={() => handleSelectTemplate(t.key)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-[hsl(var(--info))] hover:bg-[hsl(var(--info)/0.05)] transition-colors text-left group">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--info))]" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Confirm context */}
        {step === 'confirm_details' && selectedTemplateInfo && (
          <div className="space-y-4">
            <div className="bg-[hsl(var(--info)/0.08)] rounded-lg p-3 border border-[hsl(var(--info)/0.2)]">
              <p className="text-xs font-bold text-[hsl(var(--info))]">{selectedTemplateInfo.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedTemplateInfo.description}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Contexto do Lead (auto-preenchido)</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{lead.clientName}</span>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground">Destino:</span> <span className="font-medium">{lead.destination}</span>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground">Datas:</span> <span className="font-medium">{lead.travelDates}</span>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground">Pax:</span> <span className="font-medium">{lead.pax} adultos</span>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground">Budget:</span> <span className="font-medium">{lead.budgetLevel}</span>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <span className="text-muted-foreground">Status:</span> <span className="font-medium">{lead.status}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Quem assina? (Sender)</label>
              <div className="flex gap-2 mt-1">
                {['Yorick', 'Pascal', 'Jolanta'].map(name => (
                  <button key={name} onClick={() => setSenderName(name)}
                    className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors",
                      senderName === name
                        ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}>
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Notas adicionais para o AI (opcional)</label>
              <Textarea className="mt-1 text-xs" rows={3} placeholder="Ex: Mencionar o desconto de 10% que discutimos... ou que o cliente prefere contacto por WhatsApp..."
                value={customNotes} onChange={e => setCustomNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStep('select_template')}>← Voltar</Button>
              <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white"
                onClick={handleGenerate} disabled={loading}>
                {loading ? <><Loader2 className="h-3 w-3 animate-spin" /> A gerar...</> : <><Sparkles className="h-3 w-3" /> Gerar Email</>}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Edit */}
        {step === 'preview' && generatedEmail && (
          <div className="space-y-4">
            {/* Subject */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground">Subject</label>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={handleCopySubject}>
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <Input className="text-sm font-medium" value={editedSubject} onChange={e => setEditedSubject(e.target.value)} />
            </div>

            {/* Body - editable */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email Body</label>
              <Textarea className="text-sm leading-relaxed font-[Arial,sans-serif] min-h-[280px]"
                value={editedBody} onChange={e => setEditedBody(e.target.value)} />
            </div>

            {/* Internal notes */}
            {generatedEmail.internal_notes && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 border border-dashed border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Notas Internas (não enviadas)</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <p><span className="text-muted-foreground">Stage:</span> {generatedEmail.internal_notes.pipeline_stage}</p>
                  <p><span className="text-muted-foreground">Score:</span> {generatedEmail.internal_notes.lead_score_estimate}/100</p>
                  <p><span className="text-muted-foreground">Assigned:</span> {generatedEmail.internal_notes.assigned_to}</p>
                  <p><span className="text-muted-foreground">Next:</span> {generatedEmail.internal_notes.suggested_next_action}</p>
                </div>
                {generatedEmail.internal_notes.missing_info?.length > 0 && (
                  <p className="text-xs text-[hsl(var(--warning))]">⚠ Missing: {generatedEmail.internal_notes.missing_info.join(', ')}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStep('confirm_details')}>← Editar contexto</Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={handleGenerate} disabled={loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : '🔄 Regenerar'}
                </Button>
                <Button size="sm" className={cn("text-xs gap-1 min-w-[140px]",
                  copied ? "bg-[hsl(var(--stable))] text-white" : "bg-[hsl(var(--info))] text-white")}
                  onClick={handleCopy}>
                  {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar para Gmail</>}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmailComposerDialog;
