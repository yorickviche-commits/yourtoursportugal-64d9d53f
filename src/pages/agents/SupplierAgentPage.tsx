import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, AlertTriangle, Send, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import AgentPageShell from '@/components/agents/AgentPageShell';
import EmailReviewQueue, { QueueEmail } from '@/components/agents/EmailReviewQueue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLeadsQuery, type DbLead } from '@/hooks/useLeadsQuery';
import { useLeadOperationsQuery, useUpsertLeadOperation } from '@/hooks/useLeadOperationsQuery';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { addDays, format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

interface FlatCostItem {
  id: string;
  dayNumber: number;
  description: string;
  supplier: string;
  pax: number;
  netValue: number;
  scheduleTime: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const daysUntil = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const SupplierAgentPage = () => {
  const { toast } = useToast();
  const { data: leads = [], isLoading: leadsLoading } = useLeadsQuery();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [resolvedEmails, setResolvedEmails] = useState<Record<string, string>>({});

  // Eligible leads: won OR (proposal_sent and travel within 45 days)
  const eligibleLeads = useMemo(() => {
    return leads
      .filter(l => {
        if (l.status === 'won') return true;
        if (l.status === 'proposal_sent') {
          const d = daysUntil(l.travel_dates);
          return d !== null && d >= 0 && d <= 45;
        }
        return false;
      })
      .sort((a, b) => (daysUntil(a.travel_dates) ?? 9999) - (daysUntil(b.travel_dates) ?? 9999));
  }, [leads]);

  // Auto-select first
  useEffect(() => {
    if (!selectedLeadId && eligibleLeads[0]) setSelectedLeadId(eligibleLeads[0].id);
  }, [eligibleLeads, selectedLeadId]);

  const selectedLead = eligibleLeads.find(l => l.id === selectedLeadId) || null;

  // Pull lead costing items + operations for the selected lead
  const { data: costingDays = [], isLoading: costingLoading } = useQuery({
    queryKey: ['lead_costing_data', selectedLeadId, (selectedLead as any)?.active_version ?? 0],
    queryFn: async () => {
      if (!selectedLeadId) return [];
      // Fora do detalhe da lead lê-se sempre a versão LIVE (`leads.active_version`).
      const { data, error } = await supabase
        .from('lead_costing_data')
        .select('*')
        .eq('lead_id', selectedLeadId)
        .eq('version', (selectedLead as any)?.active_version ?? 0)
        .order('day_number');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLeadId,
  });

  const { data: operations = [] } = useLeadOperationsQuery(selectedLeadId || undefined);
  const upsertLeadOp = useUpsertLeadOperation();

  const flatItems = useMemo<FlatCostItem[]>(() => {
    const result: FlatCostItem[] = [];
    costingDays.forEach((day: any) => {
      const items = Array.isArray(day.items) ? day.items : [];
      items.forEach((item: any) => {
        const id = item.id || `${day.day_number}-${(item.description || 'x')}-${Math.random().toString(36).slice(2, 6)}`;
        result.push({
          id,
          dayNumber: day.day_number,
          description: item.description || item.activity || 'Serviço',
          supplier: item.supplier || '',
          pax: item.numAdults || item.num_adults || 0,
          netValue: item.netTotal || item.unitCost || item.unit_cost || 0,
          scheduleTime: item.scheduleTime || item.schedule_time || '',
        });
      });
    });
    return result;
  }, [costingDays]);

  // Items that need a booking request
  const opsByKey = useMemo(() => {
    const map: Record<string, any> = {};
    operations.forEach((op: any) => { map[op.item_key] = op; });
    return map;
  }, [operations]);

  const pendingItems = useMemo(() => {
    return flatItems.filter(it => {
      if (!it.supplier) return false;
      const status = opsByKey[it.id]?.booking_status;
      return !status || status === 'neutral' || status === 'not_requested' || status === 'declined' || status === 'waitlisted';
    });
  }, [flatItems, opsByKey]);

  // Resolve supplier emails (lookup once per supplier name)
  useEffect(() => {
    const unique = Array.from(new Set(pendingItems.map(i => i.supplier).filter(Boolean)));
    const missing = unique.filter(name => !(name in resolvedEmails));
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const name of missing) {
        try {
          const { data: s } = await supabase
            .from('suppliers').select('contact_email')
            .ilike('name', `%${name}%`).maybeSingle();
          if (s?.contact_email) {
            updates[name] = s.contact_email;
            continue;
          }
          const { data: p } = await supabase
            .from('partners').select('contact_email')
            .ilike('name', `%${name}%`).maybeSingle();
          updates[name] = p?.contact_email || '';
        } catch {
          updates[name] = '';
        }
      }
      setResolvedEmails(prev => ({ ...prev, ...updates }));
    })();
  }, [pendingItems, resolvedEmails]);

  // Build email queue
  const startDate = selectedLead?.travel_dates || null;
  const getDayDate = (dayNumber: number) => {
    if (!startDate) return '';
    try { return format(addDays(parseISO(startDate), dayNumber - 1), "EEEE, d MMM yyyy", { locale: pt }); }
    catch { return ''; }
  };

  const queueEmails: QueueEmail[] = useMemo(() => {
    if (!selectedLead) return [];
    const code = selectedLead.lead_code || selectedLead.id.slice(0, 8);
    return pendingItems.map(item => {
      const activityDate = getDayDate(item.dayNumber);
      const bodyText = `Dear ${item.supplier || '[Supplier Name]'},

We would like to request a booking for the following service:

Service: ${item.description}
Date: ${activityDate || '[Date]'}
Time: ${item.scheduleTime || '[Time TBD]'}
Number of people: ${item.pax}
Total value: €${item.netValue.toFixed(2)}
Booking reference: ${code}

Please confirm availability and send us the confirmation.

Best regards,
Your Tours Portugal
reservas@yourtours.pt`;
      const bodyHtml = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">${
        escapeHtml(bodyText).replace(/\n/g, '<br>')
      }</div>`;
      return {
        key: item.id,
        to: resolvedEmails[item.supplier] || '',
        subject: `Booking Request — ${item.description} — ${code}`,
        bodyHtml,
        recipientLabel: item.supplier,
        serviceLabel: item.description,
        contextNote: `Dia ${item.dayNumber}${item.scheduleTime ? ' · ' + item.scheduleTime : ''} · ${item.pax} pax · €${item.netValue.toFixed(0)}`,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingItems, selectedLead, resolvedEmails]);

  const handleSendOne = async (email: QueueEmail): Promise<boolean> => {
    if (!selectedLeadId) return false;
    // Find corresponding item to get day_number
    const item = pendingItems.find(p => p.id === email.key);
    if (!item) return false;
    try {
      const { data, error } = await supabase.functions.invoke('send-booking-email', {
        body: { to: email.to, subject: email.subject, html: email.bodyHtml, attachments: [] },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Falha no envio');

      await upsertLeadOp.mutateAsync({
        lead_id: selectedLeadId,
        item_key: email.key,
        day_number: item.dayNumber,
        booking_status: 'requested',
      });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  const travelLabel = (l: DbLead) => {
    const d = daysUntil(l.travel_dates);
    if (d === null) return 'datas?';
    if (d < 0) return `Partiu há ${Math.abs(d)}d`;
    if (d === 0) return 'Parte hoje';
    return `D-${d}`;
  };

  const missingEmailCount = queueEmails.filter(q => !q.to.trim()).length;

  return (
    <AgentPageShell
      icon={Briefcase}
      name="FSE Supplier Pre-Booker"
      role="Detecta serviços com fornecedor definido sem pedido de reserva enviado e prepara os emails 1 a 1 para o teu envio."
      accent="from-emerald-500/15 to-emerald-500/5"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3">
        {/* Lead list */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="px-3 py-2 border-b text-xs font-semibold flex items-center justify-between">
            <span>Leads elegíveis</span>
            <Badge variant="outline" className="text-[10px]">{eligibleLeads.length}</Badge>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {leadsLoading ? (
              <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> A carregar…
              </div>
            ) : eligibleLeads.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground italic">Sem leads que precisem de pré-booking.</p>
            ) : eligibleLeads.map(l => (
              <button
                key={l.id}
                onClick={() => { setSelectedLeadId(l.id); setQueueOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-muted/30 transition-colors flex items-start gap-2',
                  selectedLeadId === l.id && 'bg-emerald-50 border-l-2 border-emerald-500',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{l.client_name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{travelLabel(l)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{l.destination} · {l.pax} pax · {l.status}</p>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Detail / action area */}
        <div className="space-y-3">
          {!selectedLead ? (
            <div className="rounded-lg border bg-white p-6 text-center text-xs text-muted-foreground">
              Seleciona uma lead à esquerda.
            </div>
          ) : queueOpen ? (
            <EmailReviewQueue
              emails={queueEmails}
              onSend={handleSendOne}
              onClose={() => setQueueOpen(false)}
              onAllDone={() => toast({ title: 'Lote concluído', description: 'Todos os pedidos foram processados.' })}
            />
          ) : (
            <>
              {/* AI summary card */}
              <div className="rounded-lg border bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{selectedLead.client_name} — {selectedLead.destination}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {travelLabel(selectedLead)} · {selectedLead.pax} pax · status: {selectedLead.status}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-md bg-emerald-50/60 border border-emerald-200 p-3 text-xs">
                  <p className="font-semibold text-emerald-800 mb-1">Diagnóstico do agente</p>
                  {costingLoading ? (
                    <p className="text-muted-foreground">A analisar custos…</p>
                  ) : flatItems.length === 0 ? (
                    <p className="text-amber-700 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      Sem itens de custo definidos. Abre o separador Custos no detalhe da lead para popular o budget primeiro.
                    </p>
                  ) : pendingItems.length === 0 ? (
                    <p className="text-emerald-800 flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" />
                      Todos os serviços com fornecedor já têm pedido de reserva enviado. Nada a fazer aqui.
                    </p>
                  ) : (
                    <>
                      <p>
                        Esta lead tem <span className="font-bold">{pendingItems.length}</span> serviço{pendingItems.length === 1 ? '' : 's'} com fornecedor definido <span className="font-medium">sem pedido de reserva enviado</span>.
                      </p>
                      <p className="mt-1">
                        Recomendação: enviar pré-bookings agora para garantir disponibilidade antes da partida.
                      </p>
                      {missingEmailCount > 0 && (
                        <p className="mt-1 text-amber-700">
                          ⚠ {missingEmailCount} email{missingEmailCount === 1 ? '' : 's'} sem destinatário resolvido — vais precisar de preencher manualmente.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {pendingItems.length > 0 && (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="text-xs" asChild>
                      <a href={`/leads/${selectedLead.id}?tab=operations`}>Abrir lead</a>
                    </Button>
                    <Button size="sm" className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setQueueOpen(true)}>
                      <Send className="h-3.5 w-3.5" />
                      Preparar {pendingItems.length} email{pendingItems.length === 1 ? '' : 's'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Items table */}
              {pendingItems.length > 0 && (
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b text-xs font-semibold">Serviços a reservar</div>
                  <div className="divide-y">
                    {pendingItems.map(it => (
                      <div key={it.id} className="px-3 py-2 grid grid-cols-[40px_1fr_1fr_60px_70px_120px] gap-2 items-center text-xs">
                        <span className="text-muted-foreground">D{it.dayNumber}</span>
                        <span className="font-medium truncate" title={it.description}>{it.description}</span>
                        <span className="text-muted-foreground truncate" title={it.supplier}>{it.supplier}</span>
                        <span className="text-center">{it.pax}p</span>
                        <span className="text-right font-semibold">€{it.netValue.toFixed(0)}</span>
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded text-center truncate',
                          resolvedEmails[it.supplier]
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700',
                        )} title={resolvedEmails[it.supplier] || 'Email não encontrado'}>
                          {resolvedEmails[it.supplier] || '— sem email'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AgentPageShell>
  );
};

export default SupplierAgentPage;
