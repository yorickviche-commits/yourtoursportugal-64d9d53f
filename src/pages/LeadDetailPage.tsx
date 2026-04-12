import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, FileText, ClipboardList, Eye, FileIcon, Mail, Clock, Loader2, ChevronDown, ChevronRight, Plus, Copy, Upload, ExternalLink } from 'lucide-react';
// AgentPipelineButton removed from header
import AppLayout from '@/components/AppLayout';
import { useLeadQuery, useUpdateLead, useCreateLead, useDeleteLead } from '@/hooks/useLeadsQuery';
import { logActivity } from '@/hooks/useActivityLog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import TagSelect from '@/components/TagSelect';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadStatus } from '@/types/leads';
import TravelPlannerEditor, { PlannerDay, PlannerItem, PeriodKey, emptyPeriods, genId } from '@/components/trip/TravelPlannerEditor';
import TravelPlanProposal from '@/components/trip/TravelPlanProposal';
import { useProposalsQuery, useCreateProposal } from '@/hooks/useProposalsQuery';
import { toast } from 'sonner';
import ItineraryEditor from '@/components/itinerary/ItineraryEditor';
import EditableCostingTable, { CostingDayData, CostingItem } from '@/components/trip/EditableCostingTable';
import LeadCostingEditor, { LeadCostingDay, LeadCostItem } from '@/components/trip/LeadCostingEditor';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EmailComposerDialog from '@/components/leads/EmailComposerDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ItemNotesDialog from '@/components/trip/ItemNotesDialog';
import BookingRequestDialog from '@/components/trip/BookingRequestDialog';
import { useLeadOperationsQuery, useUpsertLeadOperation, DbLeadOperation } from '@/hooks/useLeadOperationsQuery';
import BookingEmailHistory from '@/components/trip/BookingEmailHistory';

type DetailTab = 'dados_gerais' | 'travel_planner' | 'custos' | 'propostas' | 'operacoes';

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'dados_gerais', label: 'Dados Gerais' },
  { key: 'travel_planner', label: 'Travel Planner' },
  { key: 'custos', label: 'Custos' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'operacoes', label: 'Operações' },
];

const CATEGORIAS = ['Premium & Boutique', 'Standard', 'Luxury', 'Budget', 'Adventure'];
const DESTINOS = ['Porto & Douro Valley', 'Lisbon & Sintra', 'Algarve', 'Azores', 'Madeira', 'Minho', 'Alentejo', 'Silver Coast'];
const IDIOMAS = ['EN', 'PT', 'FR', 'ES', 'DE', 'IT', 'NL'];
const ORIGENS = ['website', 'AI Simulation', 'referral', 'partner', 'social_media', 'direct'];

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function MonthYearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Parse existing value — could be "2026-05" or a date string or "Maio 2026"
  const now = new Date();
  let selectedMonth = now.getMonth();
  let selectedYear = now.getFullYear();

  if (value) {
    // Try YYYY-MM format
    const ym = value.match(/^(\d{4})-(\d{2})/);
    if (ym) { selectedYear = parseInt(ym[1]); selectedMonth = parseInt(ym[2]) - 1; }
    else {
      // Try "Month Year" format
      const mi = MONTHS.findIndex(m => value.toLowerCase().includes(m.toLowerCase()));
      if (mi >= 0) selectedMonth = mi;
      const yr = value.match(/\d{4}/);
      if (yr) selectedYear = parseInt(yr[0]);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);

  return (
    <div className="flex gap-1.5">
      <select
        className="h-8 text-xs border rounded-md px-2 bg-background flex-1"
        value={selectedMonth}
        onChange={e => {
          const m = parseInt(e.target.value);
          onChange(`${selectedYear}-${String(m + 1).padStart(2, '0')}`);
        }}
      >
        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select
        className="h-8 text-xs border rounded-md px-2 bg-background w-[80px]"
        value={selectedYear}
        onChange={e => {
          const y = parseInt(e.target.value);
          onChange(`${y}-${String(selectedMonth + 1).padStart(2, '0')}`);
        }}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

const BOOKING_OPTIONS = [
  { value: 'not_requested', label: 'Não Pedido', className: 'bg-muted text-muted-foreground' },
  { value: 'requested', label: 'Pedido', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  { value: 'confirmed', label: 'Confirmado', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
  { value: 'declined', label: 'Recusado', className: 'bg-destructive/15 text-destructive' },
  { value: 'cancelled', label: 'Cancelado', className: 'bg-destructive/15 text-destructive' },
  { value: 'waitlisted', label: 'Em Espera', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
];

const PAYMENT_OPTIONS = [
  { value: 'not_paid', label: 'Não Pago', className: 'bg-destructive/15 text-destructive' },
  { value: 'partially_paid', label: 'Parcialmente Pago', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  { value: 'paid', label: 'Pago', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
  { value: 'refunded', label: 'Reembolsado', className: 'bg-purple-100 text-purple-700' },
];

const INVOICE_OPTIONS = [
  { value: 'no_invoice', label: 'Sem Fatura', className: 'bg-muted text-muted-foreground' },
  { value: 'invoice_requested', label: 'Pedida', className: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' },
  { value: 'invoice_received', label: 'Recebida', className: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' },
  { value: 'invoice_approved', label: 'Aprovada', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
  { value: 'invoice_paid', label: 'Paga', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' },
];

interface FlatCostItem {
  id: string;
  dayNumber: number;
  dayTitle: string;
  description: string;
  supplier: string;
  pax: number;
  netValue: number;
}

const OperacoesTab = ({ activeVersion, leadId, leadCode }: { activeVersion: number; leadId: string; leadCode: string }) => {
  const { data: costingDays = [] } = useQuery({
    queryKey: ['lead_costing_data', leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_costing_data').select('*').eq('lead_id', leadId).order('day_number');
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  const { data: operations = [], isLoading: opsLoading } = useLeadOperationsQuery(leadId);
  const upsertOp = useUpsertLeadOperation();
  const { toast: opsToast } = useToast();
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadItemKey, setActiveUploadItemKey] = useState<string | null>(null);

  // Map operations by item_key
  const opsMap = useMemo(() => {
    const map: Record<string, DbLeadOperation> = {};
    operations.forEach(op => { map[op.item_key] = op; });
    return map;
  }, [operations]);

  // Flatten costing days into grouped items
  const itemsByDay = useMemo(() => {
    const result: { day: number; title: string; items: FlatCostItem[] }[] = [];
    costingDays.forEach((day: any) => {
      const rawItems = Array.isArray(day.items) ? day.items : [];
      const items: FlatCostItem[] = rawItems.map((item: any) => ({
        id: item.id || `${day.day_number}-${Math.random().toString(36).slice(2)}`,
        dayNumber: day.day_number,
        dayTitle: day.title || `Dia ${day.day_number}`,
        description: item.description || item.activity || '—',
        supplier: item.supplier || '',
        pax: item.numAdults || item.num_adults || 0,
        netValue: item.netTotal || item.unitCost || item.unit_cost || 0,
      }));
      if (items.length > 0) result.push({ day: day.day_number, title: day.title || `Dia ${day.day_number}`, items });
    });
    return result;
  }, [costingDays]);

  const allItems = useMemo(() => itemsByDay.flatMap(d => d.items), [itemsByDay]);
  const totalItems = allItems.length;
  const confirmedCount = allItems.filter(ci => opsMap[ci.id]?.booking_status === 'confirmed').length;
  const paidCount = allItems.filter(ci => opsMap[ci.id]?.payment_status === 'paid').length;
  const invoicedCount = allItems.filter(ci => ['invoice_received', 'invoice_approved', 'invoice_paid'].includes(opsMap[ci.id]?.invoice_status || '')).length;

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const handleOpFieldChange = useCallback(async (itemKey: string, dayNumber: number, field: string, value: any) => {
    try {
      await upsertOp.mutateAsync({
        lead_id: leadId,
        item_key: itemKey,
        day_number: dayNumber,
        [field]: value,
      });
    } catch (err: any) {
      opsToast({ title: 'Erro ao guardar', description: err.message, variant: 'destructive' });
    }
  }, [upsertOp, leadId, opsToast]);

  const handleInvoiceUpload = async (itemKey: string, dayNumber: number, file: File) => {
    setUploadingId(itemKey);
    try {
      const ext = file.name.split('.').pop();
      const path = `invoices/leads/${leadId}/${itemKey}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('supplier-files').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('supplier-files').getPublicUrl(path);

      await upsertOp.mutateAsync({
        lead_id: leadId,
        item_key: itemKey,
        day_number: dayNumber,
        invoice_file_url: publicUrl,
        invoice_file_name: file.name,
        invoice_status: 'invoice_received',
      });

      opsToast({ title: 'Fatura carregada com sucesso' });
    } catch (err: any) {
      opsToast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  if (opsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">A carregar operações...</span>
      </div>
    );
  }

  if (costingDays.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Sem dados de custos. Gere custos no separador "Custos" primeiro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && activeUploadItemKey) {
            const item = allItems.find(i => i.id === activeUploadItemKey);
            if (item) handleInvoiceUpload(activeUploadItemKey, item.dayNumber, file);
          }
          e.target.value = '';
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">Operações</h3>
        <span className="text-xs text-muted-foreground">Baseado na versão aceite (V{activeVersion})</span>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-3 border rounded-t-lg bg-muted/20 flex items-center gap-6 flex-wrap">
        <h2 className="text-sm font-semibold">Gestão Operacional</h2>
        <div className="flex items-center gap-4 ml-auto text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
            <span>Confirmados: {confirmedCount}/{totalItems}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--info))]" />
            <span>Pagos: {paidCount}/{totalItems}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />
            <span>Faturas: {invoicedCount}/{totalItems}</span>
          </div>
        </div>
      </div>

      <div className="border border-t-0 rounded-b-lg overflow-hidden">
        {itemsByDay.map(({ day, title, items: dayItems }) => {
          const expanded = expandedDays.has(day);
          const dayConfirmed = dayItems.filter(ci => opsMap[ci.id]?.booking_status === 'confirmed').length;

          return (
            <div key={day} className="border-b last:border-b-0">
              <Collapsible open={expanded} onOpenChange={() => toggleDay(day)}>
                <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left bg-muted/5">
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <span className="text-xs text-[hsl(var(--success))] font-medium">Dia {day}</span>
                    <span className="text-xs text-[hsl(var(--info))] font-semibold ml-2">— {title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{dayConfirmed}/{dayItems.length} confirmados</span>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    {/* Header row */}
                    <div className="grid grid-cols-[100px_2fr_1fr_60px_90px_130px_120px_120px_50px_50px_40px_40px] gap-1 text-[10px] font-medium text-white uppercase bg-[hsl(var(--info))]/80 px-2 py-2 rounded-t">
                      <div>Hora</div>
                      <div>Atividade</div>
                      <div>Fornecedor</div>
                      <div className="text-center">Pax</div>
                      <div className="text-center">NET (€)</div>
                      <div className="text-center">Reserva</div>
                      <div className="text-center">Pagamento</div>
                      <div className="text-center">Fatura</div>
                      <div className="text-center">📎</div>
                      <div className="text-center">📝</div>
                      <div className="text-center">✉️</div>
                      <div className="text-center">📨</div>
                    </div>

                    {/* Rows */}
                    <div className="border border-t-0 rounded-b divide-y">
                      {dayItems.map(item => {
                        const op = opsMap[item.id];
                        const scheduleTime = op?.schedule_time || '';
                        const bookingStatus = op?.booking_status || 'not_requested';
                        const paymentStatus = op?.payment_status || 'not_paid';
                        const invoiceStatus = op?.invoice_status || 'no_invoice';
                        const invoiceUrl = op?.invoice_file_url;
                        const invoiceName = op?.invoice_file_name;

                        const bookingOpt = BOOKING_OPTIONS.find(o => o.value === bookingStatus);
                        const paymentOpt = PAYMENT_OPTIONS.find(o => o.value === paymentStatus);
                        const invoiceOpt = INVOICE_OPTIONS.find(o => o.value === invoiceStatus);

                        return (
                          <div key={item.id} className="grid grid-cols-[100px_2fr_1fr_60px_90px_130px_120px_120px_50px_50px_40px_40px] gap-1 px-2 py-2 items-center text-xs hover:bg-muted/10">
                            {/* Schedule Time */}
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <Input
                                className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 w-16"
                                defaultValue={scheduleTime}
                                onBlur={e => handleOpFieldChange(item.id, item.dayNumber, 'schedule_time', e.target.value || null)}
                                placeholder="--:--"
                              />
                            </div>

                            {/* Activity name */}
                            <div className="text-xs font-medium truncate" title={item.description}>
                              {item.description}
                            </div>

                            {/* Supplier */}
                            <div className="text-xs text-muted-foreground truncate" title={item.supplier}>
                              {item.supplier || '—'}
                            </div>

                            {/* Pax */}
                            <div className="text-center text-xs">{item.pax || 0}</div>

                            {/* NET Value */}
                            <div className="text-center text-xs font-semibold">€{Number(item.netValue || 0).toFixed(0)}</div>

                            {/* Booking Status */}
                            <div>
                              <Select value={bookingStatus} onValueChange={v => handleOpFieldChange(item.id, item.dayNumber, 'booking_status', v)}>
                                <SelectTrigger className={cn("h-7 text-[10px] border-0 shadow-none rounded-full px-2", bookingOpt?.className)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BOOKING_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      <span className={opt.className.replace(/bg-[^ ]+ /, '')}>{opt.label}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Payment Status */}
                            <div>
                              <Select value={paymentStatus} onValueChange={v => handleOpFieldChange(item.id, item.dayNumber, 'payment_status', v)}>
                                <SelectTrigger className={cn("h-7 text-[10px] border-0 shadow-none rounded-full px-2", paymentOpt?.className)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      <span className={opt.className.replace(/bg-[^ ]+ /, '')}>{opt.label}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Invoice Status */}
                            <div>
                              <Select value={invoiceStatus} onValueChange={v => handleOpFieldChange(item.id, item.dayNumber, 'invoice_status', v)}>
                                <SelectTrigger className={cn("h-7 text-[10px] border-0 shadow-none rounded-full px-2", invoiceOpt?.className)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INVOICE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      <span className={opt.className.replace(/bg-[^ ]+ /, '')}>{opt.label}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Invoice Upload */}
                            <div className="flex items-center justify-center">
                              {uploadingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              ) : invoiceUrl ? (
                                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-muted rounded" title={invoiceName || 'Ver fatura'}>
                                  <FileText className="h-3 w-3 text-[hsl(var(--success))]" />
                                </a>
                              ) : (
                                <button
                                  className="p-1 hover:bg-muted rounded"
                                  title="Upload fatura"
                                  onClick={() => { setActiveUploadItemKey(item.id); fileInputRef.current?.click(); }}
                                >
                                  <Upload className="h-3 w-3 text-muted-foreground" />
                                </button>
                              )}
                            </div>

                            {/* Notes */}
                            <div className="flex items-center justify-center">
                              <ItemNotesDialog entityType="lead_cost_item" entityId={item.id} label={item.description} />
                            </div>

                            {/* Booking Request Email */}
                            <div className="flex items-center justify-center">
                              <BookingRequestDialog
                                operationId={op?.id || null}
                                costItemId={item.id}
                                tripId={leadId}
                                tripCode={leadCode}
                                activityName={item.description}
                                activityDate={`Dia ${item.dayNumber}`}
                                scheduleTime={scheduleTime}
                                supplierName={item.supplier}
                                supplierEmail=""
                                pax={item.pax}
                                netValue={item.netValue}
                                isLeadContext={true}
                                dayNumber={item.dayNumber}
                              />
                            </div>

                            {/* Email History */}
                            <div className="flex items-center justify-center">
                              <BookingEmailHistory
                                leadOperationId={op?.id || undefined}
                                label={item.description}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'Novo', color: 'bg-muted text-muted-foreground' },
  { value: 'contacted', label: 'Contactado', color: 'bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]' },
  { value: 'qualified', label: 'Qualificado', color: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' },
  { value: 'proposal_sent', label: 'Proposta Enviada', color: 'bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]' },
  { value: 'negotiation', label: 'Negociação', color: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' },
  { value: 'won', label: 'Ganho ✓', color: 'bg-[hsl(var(--stable)/0.15)] text-[hsl(var(--stable))]' },
  { value: 'lost', label: 'Perdido', color: 'bg-destructive/15 text-destructive' },
];

const statusColors: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  revision_requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-purple-100 text-purple-700',
};
const statusLabels: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviada', approved: 'Aprovada',
  revision_requested: 'Alterações pedidas', confirmed: 'Confirmada',
};

const LeadProposalsTab = ({ leadId, clientName }: { leadId: string; clientName: string }) => {
  const { data: allProposals = [], isLoading } = useProposalsQuery();
  const proposals = allProposals.filter(p => p.lead_id === leadId);
  const navigate = useNavigate();
  const createProposal = useCreateProposal();

  const handleNew = async () => {
    const token = `ytp-${Date.now().toString(36)}`;
    const result = await createProposal.mutateAsync({
      public_token: token,
      client_name: clientName || 'Cliente',
      title: 'Nova Proposta',
      lead_id: leadId,
      status: 'draft',
      days: [],
      map_stops: [],
      language: 'pt',
    });
    if (result?.id) navigate(`/proposals/${result.id}/edit`);
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/proposal/${token}`);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Propostas desta Lead</h2>
        <Button onClick={handleNew} size="sm" disabled={createProposal.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Nova Proposta
        </Button>
      </div>
      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">A carregar...</div>
      ) : proposals.length === 0 ? (
        <div className="text-muted-foreground text-sm py-8 text-center">Nenhuma proposta criada para esta lead</div>
      ) : (
        <div className="space-y-2">
          {proposals.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/proposals/${p.id}`)}
              className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[p.status] || statusColors.draft)}>
                      {statusLabels[p.status] || p.status}
                    </span>
                    {p.booking_ref && <span className="text-xs text-muted-foreground font-mono">{p.booking_ref}</span>}
                  </div>
                  <h3 className="text-sm font-semibold truncate">{p.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {p.date_range && <span>{p.date_range}</span>}
                    {p.participants && <span>• {p.participants}</span>}
                    <span>• {new Date(p.created_at).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); copyLink(p.public_token); }} className="p-2 hover:bg-muted rounded-lg" title="Copiar link">
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <a href={`/proposal/${p.public_token}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="p-2 hover:bg-muted rounded-lg" title="Ver proposta">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLeadQuery(id);
  const updateLeadMutation = useUpdateLead();
  const createLeadMutation = useCreateLead();
  const deleteLeadMutation = useDeleteLead();
  const [activeTab, setActiveTab] = useState<DetailTab>('dados_gerais');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, any>>({});
  const [plannerDays, setPlannerDays] = useState<PlannerDay[]>([]);
  const [costingDays, setCostingDays] = useState<LeadCostingDay[]>([]);
  // plannerSubTab removed — unified view
  const [finalPrice, setFinalPrice] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load persisted planner data
  const { data: savedPlannerDays } = useQuery({
    queryKey: ['lead_planner', id, lead?.active_version],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('lead_planner_data')
        .select('*')
        .eq('lead_id', id)
        .eq('version', lead?.active_version ?? 0)
        .order('day_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!lead,
  });

  // Load persisted costing data
  const { data: savedCostingDays } = useQuery({
    queryKey: ['lead_costing', id, lead?.active_version],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('lead_costing_data')
        .select('*')
        .eq('lead_id', id)
        .eq('version', lead?.active_version ?? 0)
        .order('day_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!lead,
  });

  // Hydrate planner from DB
  useEffect(() => {
    if (savedPlannerDays && savedPlannerDays.length > 0 && plannerDays.length === 0) {
      setPlannerDays(savedPlannerDays.map((d: any) => {
        // If saved with period structure
        if (d.activities && typeof d.activities === 'object' && !Array.isArray(d.activities) && d.activities.morning) {
          return {
            day: d.day_number,
            title: d.title || '',
            date: d.description || '',
            periods: {
              morning: { label: 'Manhã', items: (d.activities.morning?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
              lunch: { label: 'Almoço', items: (d.activities.lunch?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
              afternoon: { label: 'Tarde', items: (d.activities.afternoon?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
              night: { label: 'Noite', items: (d.activities.night?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
            },
          };
        }
        // Legacy flat activities format
        const legacyItems = Array.isArray(d.activities) ? d.activities : [];
        return {
          day: d.day_number,
          title: d.title || '',
          date: d.description || '',
          periods: {
            morning: { label: 'Manhã', items: legacyItems.filter((_: any, i: number) => i === 0).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
            lunch: { label: 'Almoço', items: legacyItems.filter((_: any, i: number) => i === 1).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
            afternoon: { label: 'Tarde', items: legacyItems.filter((_: any, i: number) => i === 2).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
            night: { label: 'Noite', items: legacyItems.filter((_: any, i: number) => i >= 3).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
          },
        };
      }));
    }
  }, [savedPlannerDays]);

  // Hydrate costing from DB
  useEffect(() => {
    if (savedCostingDays && savedCostingDays.length > 0 && costingDays.length === 0) {
      setCostingDays(savedCostingDays.map((d: any) => ({
        day: d.day_number,
        title: d.title || `Dia ${d.day_number}`,
        date: d.description || '',
        items: Array.isArray(d.items) ? d.items.map((item: any) => ({
          id: item.id || `ci-${Math.random().toString(36).slice(2, 7)}`,
          description: item.description || item.activity || '',
          supplier: item.supplier || '',
          pricingType: item.pricingType || 'total',
          numAdults: item.numAdults ?? item.nrPeople ?? 0,
          priceAdults: item.priceAdults ?? item.netCost ?? 0,
          numChildren: item.numChildren ?? 0,
          priceChildren: item.priceChildren ?? 0,
          netTotal: item.netTotal ?? 0,
          marginPercent: item.marginPercent ?? 30,
          pvpTotal: item.pvpTotal ?? item.pvp ?? 0,
          profit: item.profit ?? 0,
          status: item.status || 'neutro',
          notes: item.notes || [],
        })) : [],
      })));
    }
  }, [savedCostingDays]);

  const [formState, setFormState] = useState({
    clientName: '', email: '', phone: '', travelDates: '', travelEndDate: '',
    numberOfDays: 0, datesType: 'estimated' as 'concrete' | 'estimated' | 'flexible',
    pax: 2, paxChildren: 0, paxInfants: 0, budgetLevel: '', notes: '', salesOwner: '',
  });
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('new');
  const [categoria, setCategoria] = useState<string[]>([]);
  const [destino, setDestino] = useState<string[]>([]);
  const [idioma, setIdioma] = useState<string[]>(['EN']);
  const [origem, setOrigem] = useState<string[]>([]);
  const [travelStyles, setTravelStyles] = useState<string[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);

  // Save planner data to DB
  const savePlannerData = useCallback(async (days: PlannerDay[]) => {
    if (!id || !lead) return;
    try {
      await supabase.from('lead_planner_data').delete().eq('lead_id', id).eq('version', activeVersion);
      if (days.length > 0) {
        await supabase.from('lead_planner_data').insert(
          days.map(d => ({
            lead_id: id,
            version: activeVersion,
            day_number: d.day,
            title: d.title,
            description: d.date || '',
            activities: d.periods as any,
            images: [] as any,
          }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['lead_planner', id] });
    } catch (e) {
      console.error('Failed to save planner data:', e);
    }
  }, [id, lead, activeVersion, queryClient]);

  // Save costing data to DB
  const saveCostingData = useCallback(async (days: LeadCostingDay[]) => {
    if (!id || !lead) return;
    try {
      await supabase.from('lead_costing_data').delete().eq('lead_id', id).eq('version', activeVersion);
      if (days.length > 0) {
        await supabase.from('lead_costing_data').insert(
          days.map(d => ({
            lead_id: id,
            version: activeVersion,
            day_number: d.day,
            title: d.title,
            items: (d.items || []) as any,
          }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['lead_costing', id] });
    } catch (e) {
      console.error('Failed to save costing data:', e);
    }
  }, [id, lead, activeVersion, queryClient]);

  // Sync form from DB lead
  useEffect(() => {
    if (!lead) return;
    setFormState({
      clientName: lead.client_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      travelDates: lead.travel_dates || '',
      travelEndDate: lead.travel_end_date || '',
      numberOfDays: lead.number_of_days || 0,
      datesType: (lead.dates_type as any) || 'estimated',
      pax: lead.pax || 2,
      paxChildren: lead.pax_children || 0,
      paxInfants: lead.pax_infants || 0,
      budgetLevel: lead.budget_level || '',
      notes: lead.notes || '',
      salesOwner: lead.sales_owner || '',
    });
    setLeadStatus((lead.status as LeadStatus) || 'new');
    setCategoria(lead.comfort_level ? [lead.comfort_level] : []);
    setDestino(lead.destination ? lead.destination.split(', ').filter(Boolean) : []);
    setOrigem(lead.source === 'ai_simulation' ? ['AI Simulation'] : lead.source ? [lead.source] : []);
    setTravelStyles(Array.isArray(lead.travel_style) ? lead.travel_style : []);
    setActiveVersion(lead.active_version || 0);
  }, [lead]);

  const updateFormField = (key: string, value: any) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!lead) return;
    try {
      await updateLeadMutation.mutateAsync({
        id: lead.id,
        updates: {
          client_name: formState.clientName,
          email: formState.email,
          phone: formState.phone,
          travel_dates: formState.travelDates,
          travel_end_date: formState.travelEndDate,
          number_of_days: formState.numberOfDays,
          dates_type: formState.datesType,
          pax: formState.pax,
          pax_children: formState.paxChildren,
          pax_infants: formState.paxInfants,
          budget_level: formState.budgetLevel,
          notes: formState.notes,
          sales_owner: formState.salesOwner,
          status: leadStatus,
          destination: destino.join(', ') || 'A definir',
          comfort_level: categoria[0] || '',
          travel_style: travelStyles,
          source: (origem[0]?.toLowerCase().replace(/ /g, '_') || lead.source) as any,
          active_version: activeVersion,
        },
      });
      await logActivity('lead_updated', 'lead', lead.id, { client_name: formState.clientName });
      toast({ title: 'Simulação guardada!', description: `${formState.clientName} atualizado com sucesso.` });
    } catch (err: any) {
      toast({ title: 'Erro ao guardar', description: err.message, variant: 'destructive' });
    }
  }, [lead, formState, leadStatus, destino, categoria, travelStyles, origem, activeVersion, updateLeadMutation, toast]);

  const handleDuplicate = useCallback(async () => {
    if (!lead) return;
    try {
      const newLead = await createLeadMutation.mutateAsync({
        client_name: lead.client_name,
        email: lead.email,
        phone: lead.phone,
        destination: lead.destination,
        travel_dates: lead.travel_dates,
        travel_end_date: lead.travel_end_date,
        number_of_days: lead.number_of_days,
        dates_type: lead.dates_type,
        pax: lead.pax,
        pax_children: lead.pax_children,
        pax_infants: lead.pax_infants,
        status: 'new',
        source: lead.source,
        budget_level: lead.budget_level,
        sales_owner: lead.sales_owner,
        notes: lead.notes,
        travel_style: lead.travel_style as string[],
        comfort_level: lead.comfort_level,
        magic_question: lead.magic_question,
        active_version: 0,
      });
      await logActivity('lead_duplicated', 'lead', newLead.id, { source_lead: lead.id });
      toast({ title: 'Lead duplicada!', description: `Nova simulação ${newLead.lead_code} criada.` });
      navigate(`/leads/${newLead.id}`);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }, [lead, createLeadMutation, navigate, toast]);

  const handleNewVersion = useCallback(async () => {
    if (!lead) return;
    const newVersion = activeVersion + 1;
    setActiveVersion(newVersion);
    await updateLeadMutation.mutateAsync({ id: lead.id, updates: { active_version: newVersion } });
    await logActivity('lead_new_version', 'lead', lead.id, { version: newVersion });
    toast({ title: `Versão V${newVersion} criada` });
  }, [lead, activeVersion, updateLeadMutation, toast]);

  const handleRemove = useCallback(async () => {
    if (!lead) return;
    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      await logActivity('lead_deleted', 'lead', lead.id, { client_name: lead.client_name });
      toast({ title: 'Simulação removida' });
      navigate('/leads');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }, [lead, deleteLeadMutation, navigate, toast]);

  const generateAI = async (type: 'travel_planner' | 'budget' | 'digital_itinerary') => {
    if (!lead) return;
    setAiLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          leadData: {
            clientName: formState.clientName, destination: destino.join(', '),
            travelDates: formState.travelDates,
            travelEndDate: formState.travelEndDate || undefined,
            datesType: formState.datesType,
            numberOfDays: formState.numberOfDays || undefined,
            pax: formState.pax, paxChildren: formState.paxChildren, paxInfants: formState.paxInfants,
            travelStyles, comfortLevel: categoria[0] || '',
            budgetLevel: formState.budgetLevel, magicQuestion: lead.magic_question,
            notes: formState.notes,
          },
          type,
        },
      });
      if (error) throw error;
      setAiResults(prev => ({ ...prev, [type]: data.result }));
      if (type === 'travel_planner' && data.result.days) {
        const newDays: PlannerDay[] = data.result.days.map((d: any, i: number) => ({
          day: d.day || i + 1,
          title: d.title || '',
          date: d.date || '',
          periods: {
            morning: { label: 'Manhã', items: (d.periods?.morning?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
            lunch: { label: 'Almoço', items: (d.periods?.lunch?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
            afternoon: { label: 'Tarde', items: (d.periods?.afternoon?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
            night: { label: 'Noite', items: (d.periods?.night?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
          },
        }));
        setPlannerDays(newDays);
        savePlannerData(newDays);
      }
      if (type === 'budget' && data.result.days) {
        // Budget AI not used — costing mirrors planner structure
      }
      toast({ title: 'AI gerou com sucesso', description: `Modelo usado: ${data.modelUsed}` });
    } catch (e: any) {
      toast({ title: 'Erro na geração AI', description: e.message, variant: 'destructive' });
    } finally {
      setAiLoading(null);
    }
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="ml-2 text-sm text-muted-foreground">A carregar...</span></div></AppLayout>;
  }

  if (!lead) {
    return <AppLayout><div className="text-center py-20"><p className="text-muted-foreground">Simulação não encontrada</p><Link to="/leads" className="text-[hsl(var(--info))] text-sm hover:underline mt-2 inline-block">Voltar</Link></div></AppLayout>;
  }

  const currentStatusConfig = LEAD_STATUSES.find(s => s.value === leadStatus) || LEAD_STATUSES[0];

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <Link to="/leads" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Voltar às simulações
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {lead.lead_code} - {formState.email} - {destino.join(', ') || lead.destination} - adt:{formState.pax} - chl:{formState.paxChildren} - inf:{formState.paxInfants}
              </h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn("text-sm font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity", currentStatusConfig.color)}>
                    [ {currentStatusConfig.label} ] <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {LEAD_STATUSES.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => setLeadStatus(s.value)} className={cn("text-xs cursor-pointer", leadStatus === s.value && "font-bold")}>{s.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs">Pagamento</Button>
              <div className="bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1.5 rounded">NOT PAID 0€ - {formState.budgetLevel}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-0">
            {DETAIL_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px", activeTab === tab.key ? "border-[hsl(var(--info))] text-[hsl(var(--info))]" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <EmailComposerDialog lead={{ clientName: formState.clientName, email: formState.email, phone: formState.phone, destination: destino.join(', '), travelDates: formState.travelDates, pax: formState.pax, status: leadStatus, budgetLevel: formState.budgetLevel, travelStyle: travelStyles, comfortLevel: categoria[0], magicQuestion: lead.magic_question, notes: formState.notes, leadId: lead.id }}>
              <button className="text-xs text-[hsl(var(--info))] hover:text-foreground transition-colors font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Email</button>
            </EmailComposerDialog>
          </div>
        </div>

        {/* Dados Gerais */}
        {activeTab === 'dados_gerais' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: activeVersion + 1 }, (_, i) => i).map(v => (
                  <button key={v} onClick={() => setActiveVersion(v)} className={cn("px-2.5 py-1 text-xs rounded border transition-colors", activeVersion === v ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground hover:text-foreground")}>V{v}</button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">🔒 Versão · V{activeVersion}</span>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleDuplicate} disabled={createLeadMutation.isPending}>
                <Copy className="h-3 w-3" /> Duplicar
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleNewVersion}>
                <Plus className="h-3 w-3" /> Nova Versão
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Informação geral</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº VI</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.lead_code} readOnly />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Criador da Simulação</label>
                  <Input className="h-8 text-xs mt-1" value={formState.salesOwner} onChange={e => updateFormField('salesOwner', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Data</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={new Date(lead.created_at).toLocaleString('pt-PT')} readOnly />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados do cliente</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-[10px] text-muted-foreground uppercase">Nome</label><Input className="h-8 text-xs mt-1" value={formState.clientName} onChange={e => updateFormField('clientName', e.target.value)} /></div>
                <div><label className="text-[10px] text-muted-foreground uppercase">E-mail</label><Input className="h-8 text-xs mt-1" type="email" value={formState.email} onChange={e => updateFormField('email', e.target.value)} /></div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Telefone</label><Input className="h-8 text-xs mt-1" value={formState.phone} onChange={e => updateFormField('phone', e.target.value)} /></div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados da viagem</h3>
              <div className="grid grid-cols-3 gap-4">
                <TagSelect label="Categoria" value={categoria} options={CATEGORIAS} onChange={setCategoria} />
                <TagSelect label="Destino" value={destino} options={DESTINOS} onChange={setDestino} multiple />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Tipo de Datas</label>
                  <div className="flex gap-1 mt-1">
                    {(['concrete', 'estimated', 'flexible'] as const).map(dt => (
                      <button key={dt} onClick={() => updateFormField('datesType', dt)} className={cn("px-2.5 py-1.5 text-[10px] rounded border transition-colors", formState.datesType === dt ? dt === 'concrete' ? "bg-[hsl(var(--success))] text-white border-[hsl(var(--success))]" : dt === 'estimated' ? "bg-[hsl(var(--warning))] text-white border-[hsl(var(--warning))]" : "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground")}>
                        {dt === 'concrete' ? 'Concretas' : dt === 'estimated' ? 'Estimadas' : 'Flexível (dias)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                {formState.datesType === 'concrete' && (<>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Data Início</label>
                    <Input className="h-8 text-xs mt-1" type="date" value={formState.travelDates} onChange={e => {
                      const startVal = e.target.value;
                      updateFormField('travelDates', startVal);
                      // Auto-calc numberOfDays
                      if (startVal && formState.travelEndDate) {
                        const diff = Math.ceil((new Date(formState.travelEndDate).getTime() - new Date(startVal).getTime()) / 86400000) + 1;
                        if (diff > 0) updateFormField('numberOfDays', diff);
                      }
                    }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Data Fim</label>
                    <Input className="h-8 text-xs mt-1" type="date" value={formState.travelEndDate} onChange={e => {
                      const endVal = e.target.value;
                      updateFormField('travelEndDate', endVal);
                      if (formState.travelDates && endVal) {
                        const diff = Math.ceil((new Date(endVal).getTime() - new Date(formState.travelDates).getTime()) / 86400000) + 1;
                        if (diff > 0) updateFormField('numberOfDays', diff);
                      }
                    }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nº de Dias</label>
                    <Input className="h-8 text-xs mt-1 bg-muted/50" type="number" value={formState.numberOfDays} readOnly />
                  </div>
                </>)}
                {formState.datesType === 'estimated' && (<>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Mês Previsto</label>
                    <div className="mt-1">
                      <MonthYearPicker
                        value={formState.travelDates}
                        onChange={(val) => updateFormField('travelDates', val)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nº de Dias</label>
                    <Input className="h-8 text-xs mt-1" type="number" min={1} value={formState.numberOfDays} onChange={e => updateFormField('numberOfDays', parseInt(e.target.value) || 0)} />
                  </div>
                </>)}
                {formState.datesType === 'flexible' && (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nº de Dias</label>
                    <Input className="h-8 text-xs mt-1" type="number" min={1} value={formState.numberOfDays} onChange={e => updateFormField('numberOfDays', parseInt(e.target.value) || 0)} />
                  </div>
                )}
                <div><label className="text-[10px] text-muted-foreground uppercase">Nº de adultos</label><Input className="h-8 text-xs mt-1" type="number" value={formState.pax} onChange={e => updateFormField('pax', parseInt(e.target.value) || 1)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">Nº de jovens</label><Input className="h-8 text-xs mt-1" type="number" value={formState.paxChildren} onChange={e => updateFormField('paxChildren', parseInt(e.target.value) || 0)} /></div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Nº de crianças</label><Input className="h-8 text-xs mt-1" type="number" value={formState.paxInfants} onChange={e => updateFormField('paxInfants', parseInt(e.target.value) || 0)} /></div>
                <TagSelect label="Idioma" value={idioma} options={IDIOMAS} onChange={setIdioma} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">Budget total (€)</label><Input className="h-8 text-xs mt-1" value={formState.budgetLevel} onChange={e => updateFormField('budgetLevel', e.target.value)} /></div>
                <TagSelect label="Origem do Itinerário" value={origem} options={ORIGENS} onChange={setOrigem} />
                <div><label className="text-[10px] text-muted-foreground uppercase">Desconto</label><Input className="h-8 text-xs mt-1" defaultValue="" /></div>
              </div>
            </div>

            <TagSelect label="Estilos de viagem" value={travelStyles} options={['Food & Wine', 'Culture & History', 'Nature & Adventure', 'Beach & Relax', 'City Break', 'Road Trip', 'Wellness', 'Photography']} onChange={setTravelStyles} multiple />

            {lead.magic_question && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">✨ O que tornaria esta viagem inesquecível?</h3>
                <p className="text-sm text-foreground italic">"{lead.magic_question}"</p>
              </div>
            )}

            <div><label className="text-[10px] text-muted-foreground uppercase">Preferências / Notas</label><Textarea className="mt-1 text-xs" rows={3} value={formState.notes} onChange={e => updateFormField('notes', e.target.value)} /></div>

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={handleRemove} disabled={deleteLeadMutation.isPending}>
                <Trash2 className="h-3 w-3" /> Remover
              </Button>
              <Button size="sm" className="text-xs gap-1" onClick={handleSave} disabled={updateLeadMutation.isPending}>
                {updateLeadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
              </Button>
            </div>
          </div>
        )}

        {/* Travel Planner */}
        {activeTab === 'travel_planner' && (
          <TravelPlanProposal
            leadId={lead.id}
            leadCode={lead.lead_code}
            clientName={formState.clientName}
            destination={destino.join(', ') || lead.destination || ''}
            travelDates={formState.travelDates}
            travelEndDate={formState.travelEndDate}
            numberOfDays={formState.numberOfDays}
            datesType={formState.datesType}
            pax={formState.pax}
            paxChildren={formState.paxChildren}
            paxInfants={formState.paxInfants}
            travelStyles={travelStyles}
            comfortLevel={categoria[0] || ''}
            budgetLevel={formState.budgetLevel}
            magicQuestion={lead.magic_question || undefined}
            notes={formState.notes}
          />
        )}

        {/* Custos */}
        {activeTab === 'custos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Orçamentação & Margens</h3>
            </div>
            <div className="bg-muted/50 rounded-lg border p-3 text-xs space-y-1">
              <p><span className="font-medium">Pax:</span> {formState.pax} adultos + {formState.paxChildren} crianças · <span className="font-medium">Destino:</span> {destino.join(', ') || 'A definir'}</p>
              <p><span className="font-medium">Planner:</span> {plannerDays.length} dias definidos</p>
            </div>
            <LeadCostingEditor
              costingDays={costingDays}
              onChange={setCostingDays}
              onSave={async (days) => {
                await saveCostingData(days);
                toast({ title: 'Custos guardados!', description: `${days.length} dias salvos.` });
              }}
              saving={false}
              plannerDays={plannerDays}
              pax={formState.pax}
              paxChildren={formState.paxChildren}
              destination={destino.join(', ') || lead?.destination || ''}
            />
          </div>
        )}

        {/* Propostas */}
        {activeTab === 'propostas' && lead && <LeadProposalsTab leadId={lead.id} clientName={formState.clientName} />}

        {/* Operações */}
        {activeTab === 'operacoes' && lead && <OperacoesTab activeVersion={activeVersion} leadId={lead.id} leadCode={lead.lead_code} />}
      </div>
    </AppLayout>
  );
};

export default LeadDetailPage;
