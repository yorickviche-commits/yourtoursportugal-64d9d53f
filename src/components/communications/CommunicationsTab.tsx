import { useState } from 'react';
import { Mail, Loader2, Clock, ChevronRight, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EmailComposerDialog, { AI_EMAIL_TEMPLATES } from '@/components/leads/EmailComposerDialog';
import type { TemplateContext } from '@/data/emailTemplates';

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

interface Props {
  scope: 'lead' | 'trip';
  entityId: string;
  recipientEmail?: string;
  context: TemplateContext;
  /** Full lead context (enables AI Email Composer for all 10 templates). */
  leadContext?: LeadContext;
}

interface EmailLogRow {
  id: string;
  subject: string;
  body: string;
  supplier_email: string | null;
  sent_at: string;
  email_category: string | null;
}

const CommunicationsTab = ({ scope, entityId, recipientEmail, context, leadContext }: Props) => {
  useToast();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTemplate, setComposerTemplate] = useState<string | null>(null);

  const filterField = scope === 'lead' ? 'lead_id' : 'trip_id';

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

  // Build a lead context from props (fallback to TemplateContext fields)
  const effectiveLead: LeadContext = leadContext || {
    clientName: context.client_name || '',
    email: recipientEmail || '',
    destination: context.destination || '',
    travelDates: context.travel_dates || '',
    pax: context.pax || 0,
    status: '',
    budgetLevel: '',
    leadId: scope === 'lead' ? entityId : undefined,
  };

  const salesTemplates = AI_EMAIL_TEMPLATES.filter(t => t.stage === 'Sales');
  const opsTemplates = AI_EMAIL_TEMPLATES.filter(t => t.stage === 'Ops');

  const openComposer = (key: string) => {
    setComposerTemplate(key);
    setComposerOpen(true);
  };

  const Section = ({ title, items }: { title: string; items: typeof AI_EMAIL_TEMPLATES }) => (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-3 pt-1">
        {items.map(t => (
          <button
            key={t.key}
            onClick={() => openComposer(t.key)}
            className="text-left p-2.5 rounded border border-border hover:border-[hsl(var(--info))] hover:bg-[hsl(var(--info)/0.05)] transition group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{t.label}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{t.description}</div>
              </div>
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[hsl(var(--info))] shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* AI Email Composer — Sales + Ops pipelines */}
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
            Email Composer AI
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Gera emails personalizados (Sales + Ops) e copia para o Gmail. Cada envio fica registado no histórico abaixo.
          </p>
        </div>
        <Section title="Sales Pipeline" items={salesTemplates} />
        <div className="border-t border-border" />
        <Section title="Operations Pipeline" items={opsTemplates} />
      </div>

      {/* History */}
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Histórico ({history.length})</h2>
          <span className="text-[10px] text-muted-foreground">Mais recente primeiro</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem comunicações registadas.</p>
        ) : (
          <div className="divide-y divide-border">
            {history.map(h => {
              const tpl = AI_EMAIL_TEMPLATES.find(t => t.key === h.email_category);
              return (
                <details key={h.id} className="px-4 py-2.5 group">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {tpl && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))] font-medium">
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

      {/* Controlled AI Email Composer */}
      <EmailComposerDialog
        lead={effectiveLead}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        initialTemplateKey={composerTemplate}
      />
    </div>
  );
};

export default CommunicationsTab;
