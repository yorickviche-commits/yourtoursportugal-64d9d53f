import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Upload, Clock, FileText, Loader2, Save, Plus, Trash2, FileDown } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { cn, formatDayLabelPT } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { openSupplierFileByUrl } from '@/lib/supplierFileUrl';
import { useToast } from '@/hooks/use-toast';
import { useLeadOperationsQuery, useSaveLeadOperations, useUpsertLeadOperation, DbLeadOperation } from '@/hooks/useLeadOperationsQuery';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { triggerCalendarSync } from '@/hooks/useCalendarSync';
import ItemNotesDialog from '@/components/trip/ItemNotesDialog';
import BookingRequestDialog from '@/components/trip/BookingRequestDialog';
import BookingEmailHistory from '@/components/trip/BookingEmailHistory';
import SupplierSearchDropdown from '@/components/trip/SupplierSearchDropdown';
import LeadOpsAnalyticsPanel from '@/components/leads/LeadOpsAnalyticsPanel';
import GuidePlanningDialog from '@/components/leads/GuidePlanningDialog';


import {
  BOOKING_OPTIONS, PAYMENT_OPTIONS, INVOICE_OPTIONS,
  normalizeBookingStatus, normalizePaymentStatus, normalizeInvoiceStatus,
  type OpsRow,
} from '@/components/leads/opsConstants';

export { BOOKING_OPTIONS, PAYMENT_OPTIONS, INVOICE_OPTIONS };
export type { OpsRow };


const GRID = 'grid grid-cols-[84px_minmax(220px,2.4fr)_150px_54px_84px_96px_124px_120px_116px_44px_44px_36px_36px_28px] gap-1';

const PERIOD_ORDER = ['morning', 'lunch', 'afternoon', 'night'] as const;

const slug = (s: string) =>
  (s || 'item')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');




interface Props {
  activeVersion: number;
  leadId: string;
  leadCode: string;
  pvpTotal?: number;
  startDate?: string | null;
}

const LeadOperationsEditor = ({ activeVersion, leadId, leadCode, pvpTotal = 0, startDate = null }: Props) => {

  const { toast } = useToast();

  const { data: plannerDays = [], isLoading: plannerLoading } = useQuery({
    queryKey: ['lead_planner_ops', leadId, activeVersion],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_planner_data')
        .select('*')
        .eq('lead_id', leadId)
        .eq('version', activeVersion)
        .order('day_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });

  const { data: costingDays = [] } = useQuery({
    queryKey: ['lead_costing_ops', leadId, activeVersion],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_costing_data')
        .select('*')
        .eq('lead_id', leadId)
        .eq('version', activeVersion)
        .order('day_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });

  const { data: operations = [], isLoading: opsLoading } = useLeadOperationsQuery(leadId);
  const saveOps = useSaveLeadOperations();
  const upsertOp = useUpsertLeadOperation();

  const [rows, setRows] = useState<OpsRow[]>([]);
  const [deletedKeys, setDeletedKeys] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null);
  const initialized = useRef(false);
  const [guidePdfOpen, setGuidePdfOpen] = useState(false);


  const dayTitles = useMemo(() => {
    const map: Record<number, string> = {};
    plannerDays.forEach((d: any) => { map[d.day_number] = d.title || `Dia ${d.day_number}`; });
    costingDays.forEach((d: any) => { if (!map[d.day_number]) map[d.day_number] = d.title || `Dia ${d.day_number}`; });
    return map;
  }, [plannerDays, costingDays]);

  // Costing lookup: day + normalized title -> {supplier, pax, net}
  const costingLookup = useMemo(() => {
    const map: Record<string, { supplier: string; pax: number; net: number }> = {};
    costingDays.forEach((day: any) => {
      const items = Array.isArray(day.items) ? day.items : [];
      items.forEach((it: any) => {
        const title = it.description || it.activity || '';
        const entry = {
          supplier: it.supplier || '',
          pax: Number(it.numAdults ?? it.num_adults ?? 0) || 0,
          net: Number(it.netTotal ?? it.unitCost ?? it.unit_cost ?? 0) || 0,
        };
        map[`${day.day_number}|${norm(title)}`] = entry;
      });
    });
    return map;
  }, [costingDays]);

  // Build merged rows once data is loaded
  useEffect(() => {
    if (initialized.current) return;
    if (plannerLoading || opsLoading) return;
    if (plannerDays.length === 0 && costingDays.length === 0 && operations.length === 0) return;

    const opsMap: Record<string, DbLeadOperation> = {};
    operations.forEach(op => { opsMap[op.item_key] = op; });

    const built: OpsRow[] = [];
    const usedKeys = new Set<string>();

    const pushRow = (dayNumber: number, title: string, source: 'planner' | 'manual', keyOverride?: string) => {
      let key = keyOverride || `d${dayNumber}-${slug(title)}`;
      let suffix = 2;
      while (usedKeys.has(key)) { key = `${keyOverride || `d${dayNumber}-${slug(title)}`}-${suffix++}`; }
      usedKeys.add(key);
      const op = opsMap[key];
      const cost = costingLookup[`${dayNumber}|${norm(title)}`];
      built.push({
        itemKey: key,
        dayNumber,
        source,
        activityTitle: op?.activity_title ?? title,
        supplier: op?.supplier ?? cost?.supplier ?? '',
        pax: op?.pax ?? cost?.pax ?? 0,
        netValue: cost?.net ?? Number(op?.net_value ?? 0) ?? 0,
        realCost: op?.real_cost != null ? Number(op.real_cost) : null,
        scheduleTime: op?.schedule_time || '',
        bookingStatus: normalizeBookingStatus(op?.booking_status),
        paymentStatus: normalizePaymentStatus(op?.payment_status),
        invoiceStatus: normalizeInvoiceStatus(op?.invoice_status),
        invoiceUrl: op?.invoice_file_url || null,
        invoiceName: op?.invoice_file_name || null,
        opId: op?.id,
      });
    };

    // 1) Planner structure
    plannerDays.forEach((day: any) => {
      const periods = (day.activities || {}) as Record<string, { items?: { title?: string }[] }>;
      PERIOD_ORDER.forEach(pk => {
        const items = periods?.[pk]?.items || [];
        items.forEach((it: any) => {
          const title = (it?.title || '').trim();
          if (!title) return;
          pushRow(day.day_number, title, 'planner');
        });
      });
    });

    // 2) Fallback to costing when planner has no items
    if (built.length === 0) {
      costingDays.forEach((day: any) => {
        const items = Array.isArray(day.items) ? day.items : [];
        items.forEach((it: any) => {
          const title = (it.description || it.activity || '').trim();
          if (!title) return;
          pushRow(day.day_number, title, 'planner');
        });
      });
    }

    // 3) Saved manual rows (and orphan saved rows)
    operations
      .filter(op => !usedKeys.has(op.item_key))
      .sort((a, b) => (a.day_number - b.day_number) || (a.sort_order - b.sort_order))
      .forEach(op => {
        usedKeys.add(op.item_key);
        built.push({
          itemKey: op.item_key,
          dayNumber: op.day_number,
          source: (op.source as 'planner' | 'manual') === 'manual' ? 'manual' : 'planner',
          activityTitle: op.activity_title || '—',
          supplier: op.supplier || '',
          pax: op.pax ?? 0,
          netValue: Number(op.net_value ?? 0),
          realCost: op.real_cost != null ? Number(op.real_cost) : null,
          scheduleTime: op.schedule_time || '',
          bookingStatus: normalizeBookingStatus(op.booking_status),
          paymentStatus: normalizePaymentStatus(op.payment_status),
          invoiceStatus: normalizeInvoiceStatus(op.invoice_status),
          invoiceUrl: op.invoice_file_url,
          invoiceName: op.invoice_file_name,
          opId: op.id,
        });
      });

    setRows(built);
    initialized.current = true;
  }, [plannerDays, costingDays, operations, plannerLoading, opsLoading, costingLookup]);

  const updateRow = useCallback((itemKey: string, patch: Partial<OpsRow>) => {
    setRows(prev => prev.map(r => (r.itemKey === itemKey ? { ...r, ...patch } : r)));
    setDirty(true);
  }, []);

  const addRow = useCallback((dayNumber: number) => {
    const key = `d${dayNumber}-manual-${Math.random().toString(36).slice(2, 10)}`;
    setRows(prev => [...prev, {
      itemKey: key,
      dayNumber,
      source: 'manual',
      activityTitle: '',
      supplier: '',
      pax: 0,
      netValue: 0,
      realCost: null,
      scheduleTime: '',
      bookingStatus: 'neutral',
      paymentStatus: 'neutral',
      invoiceStatus: 'not_received',
      invoiceUrl: null,
      invoiceName: null,
    }]);
    setDirty(true);
  }, []);

  const removeRow = useCallback((itemKey: string) => {
    setRows(prev => prev.filter(r => r.itemKey !== itemKey));
    setDeletedKeys(prev => [...prev, itemKey]);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await saveOps.mutateAsync({
        leadId,
        deletedKeys,
        rows: rows.map((r, idx) => ({
          item_key: r.itemKey,
          day_number: r.dayNumber,
          schedule_time: r.scheduleTime || null,
          booking_status: r.bookingStatus,
          payment_status: r.paymentStatus,
          invoice_status: r.invoiceStatus,
          invoice_file_url: r.invoiceUrl,
          invoice_file_name: r.invoiceName,
          activity_title: r.activityTitle,
          supplier: r.supplier || null,
          pax: r.pax || 0,
          net_value: r.netValue || 0,
          real_cost: r.realCost,
          sort_order: idx,
          source: r.source,
        })),
      });
      setDeletedKeys([]);
      setDirty(false);
      triggerCalendarSync(leadId, 'update');
      toast({ title: 'Operações gravadas' });
    } catch (err: any) {
      toast({ title: 'Erro ao gravar', description: err.message, variant: 'destructive' });
      throw err;
    }
  }, [saveOps, leadId, rows, deletedKeys, toast]);

  const guard = useUnsavedChangesGuard(dirty, handleSave);

  // Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, handleSave]);

  const handleInvoiceUpload = async (row: OpsRow, file: File) => {
    setUploadingId(row.itemKey);
    try {
      const ext = file.name.split('.').pop();
      const path = `invoices/leads/${leadId}/${row.itemKey}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('supplier-files').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('supplier-files').getPublicUrl(path);

      await upsertOp.mutateAsync({
        lead_id: leadId,
        item_key: row.itemKey,
        day_number: row.dayNumber,
        activity_title: row.activityTitle,
        invoice_file_url: publicUrl,
        invoice_file_name: file.name,
        invoice_status: 'received',
      });
      updateRow(row.itemKey, { invoiceUrl: publicUrl, invoiceName: file.name, invoiceStatus: 'received' });
      setDirty(false);
      toast({ title: 'Fatura carregada com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const rowsByDay = useMemo(() => {
    const days = Array.from(new Set(rows.map(r => r.dayNumber))).sort((a, b) => a - b);
    return days.map(day => ({
      day,
      title: dayTitles[day] || `Dia ${day}`,
      items: rows.filter(r => r.dayNumber === day),
    }));
  }, [rows, dayTitles]);

  const totalItems = rows.length;
  const confirmedCount = rows.filter(r => r.bookingStatus === 'booked').length;
  const paidCount = rows.filter(r => r.paymentStatus === 'paid').length;
  const invoicedCount = rows.filter(r => r.invoiceStatus === 'received').length;

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  if (plannerLoading || opsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">A carregar operações...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground">Sem itens. Gere o Travel Planner ou adicione linhas manualmente.</p>
        <Button size="sm" variant="outline" onClick={() => addRow(1)}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar linha (Dia 1)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && activeUploadKey) {
            const row = rows.find(r => r.itemKey === activeUploadKey);
            if (row) handleInvoiceUpload(row, file);
          }
          e.target.value = '';
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">Operações</h3>
          <span className="text-xs text-muted-foreground">
            {rowsByDay.length} dias · {totalItems} rubricas
          </span>
          <button type="button" onClick={() => setExpandedDays(new Set(rowsByDay.map(d => d.day)))} className="text-[10px] text-[hsl(var(--info))] hover:underline">Expandir</button>
          <button type="button" onClick={() => setExpandedDays(new Set())} className="text-[10px] text-[hsl(var(--info))] hover:underline">Colapsar</button>
        </div>
        <span className="text-xs text-muted-foreground">Itens do Travel Planner (V{activeVersion}) — editáveis</span>
      </div>

      {/* Summary + Save */}
      <div className="px-4 py-3 border rounded-t-lg bg-muted/20 flex items-center gap-4 flex-wrap sticky top-0 z-10">
        <h2 className="text-sm font-semibold">Gestão Operacional</h2>
        <div className="flex items-center gap-4 text-[10px] ml-auto">
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
        {dirty && <span className="text-[10px] text-[hsl(var(--warning))] font-medium">Alterações não gravadas</span>}
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setGuidePdfOpen(true)}>
          <FileDown className="h-3 w-3" /> Planning do Guia (PDF)
        </Button>
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSave} disabled={!dirty || saveOps.isPending}>
          {saveOps.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Gravar
        </Button>
      </div>


      <div className="border border-t-0 rounded-b-lg overflow-hidden">
        {rowsByDay.map(({ day, title, items: dayItems }) => {
          const expanded = expandedDays.has(day);
          const dayConfirmed = dayItems.filter(r => r.bookingStatus === 'confirmed').length;
          const dayNet = dayItems.reduce((s, r) => s + (r.netValue || 0), 0);
          const dayReal = dayItems.reduce((s, r) => s + (r.realCost ?? 0), 0);

          return (
            <div key={day} className="border-b last:border-b-0">
              <Collapsible open={expanded} onOpenChange={() => toggleDay(day)}>
                <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left bg-muted/5">
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <div>
                      <span className="text-xs text-[hsl(var(--success))] font-medium">Dia {day}</span>
                      <span className="text-xs text-[hsl(var(--info))] font-semibold ml-2">— {title}</span>
                    </div>
                    {formatDayLabelPT(startDate, day) && (
                      <p className="text-[10px] text-muted-foreground capitalize">{formatDayLabelPT(startDate, day)}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mr-3">
                    NET €{dayNet.toFixed(0)} · Real €{dayReal.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mr-3">{dayItems.length} rubricas</span>
                  <span className="text-[10px] text-muted-foreground">{dayConfirmed}/{dayItems.length} confirmados</span>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 overflow-x-auto">
                    {/* Header row */}
                    <div className={cn(GRID, 'min-w-[1150px] text-[10px] font-medium text-white uppercase bg-[hsl(var(--info))]/80 px-2 py-2 rounded-t')}>
                      <div>Hora</div>
                      <div>Atividade</div>
                      <div>FSE</div>
                      <div className="text-center">Pax</div>
                      <div className="text-center">NET (€)</div>
                      <div className="text-center">Real (€)</div>
                      <div className="text-center">Reserva</div>
                      <div className="text-center">Pagamento</div>
                      <div className="text-center">Fatura</div>
                      <div className="text-center">📎</div>
                      <div className="text-center">📝</div>
                      <div className="text-center">✉️</div>
                      <div className="text-center">📨</div>
                      <div />
                    </div>

                    {/* Rows */}
                    <div className="border border-t-0 rounded-b divide-y min-w-[1150px]">
                      {dayItems.map(row => {
                        const bookingOpt = BOOKING_OPTIONS.find(o => o.value === row.bookingStatus);
                        const paymentOpt = PAYMENT_OPTIONS.find(o => o.value === row.paymentStatus);
                        const invoiceOpt = INVOICE_OPTIONS.find(o => o.value === row.invoiceStatus);
                        const overBudget = row.realCost != null && row.netValue > 0 && row.realCost > row.netValue;

                        return (
                          <div key={row.itemKey} className={cn(GRID, 'px-2 py-2 items-start text-xs hover:bg-muted/10')}>
                            {/* Hora */}
                            <div className="flex items-center gap-1 pt-1">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <Input
                                className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 w-14"
                                value={row.scheduleTime}
                                onChange={e => updateRow(row.itemKey, { scheduleTime: e.target.value })}
                                placeholder="--:--"
                              />
                            </div>

                            {/* Atividade — editável, multi-linha, bem visível */}
                            <div>
                              <Textarea
                                className="min-h-[44px] text-[13px] font-semibold leading-snug resize-y border-transparent bg-transparent hover:border-input focus-visible:border-input px-2 py-1 whitespace-pre-wrap break-words"
                                value={row.activityTitle}
                                onChange={e => updateRow(row.itemKey, { activityTitle: e.target.value })}
                                placeholder="Nome da atividade"
                                rows={2}
                              />
                            </div>

                            {/* FSE */}
                            <div className="pt-0.5">
                              <SupplierSearchDropdown
                                value={row.supplier}
                                onChange={v => updateRow(row.itemKey, { supplier: v })}
                              />
                            </div>

                            {/* Pax */}
                            <div className="pt-1">
                              <Input
                                type="number"
                                className="h-7 text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
                                value={row.pax || 0}
                                onChange={e => updateRow(row.itemKey, { pax: Number(e.target.value) || 0 })}
                              />
                            </div>

                            {/* NET (fixo do costing) */}
                            <div className="text-center text-xs font-semibold pt-2 text-muted-foreground" title="Valor NET do Costing (fixo)">
                              €{Number(row.netValue || 0).toFixed(0)}
                            </div>

                            {/* Custo real */}
                            <div className="pt-1">
                              <Input
                                type="number"
                                step="0.01"
                                className={cn(
                                  'h-7 text-xs text-center font-semibold',
                                  overBudget ? 'text-destructive' : 'text-[hsl(var(--success))]'
                                )}
                                value={row.realCost ?? ''}
                                placeholder="—"
                                onChange={e => updateRow(row.itemKey, {
                                  realCost: e.target.value === '' ? null : Number(e.target.value),
                                })}
                              />
                            </div>

                            {/* Reserva */}
                            <div className="pt-1">
                              <Select value={row.bookingStatus} onValueChange={v => updateRow(row.itemKey, { bookingStatus: v })}>
                                <SelectTrigger className={cn('h-7 text-[10px] border-0 shadow-none rounded-full px-2', bookingOpt?.className)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BOOKING_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Pagamento */}
                            <div className="pt-1">
                              <Select value={row.paymentStatus} onValueChange={v => updateRow(row.itemKey, { paymentStatus: v })}>
                                <SelectTrigger className={cn('h-7 text-[10px] border-0 shadow-none rounded-full px-2', paymentOpt?.className)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Fatura */}
                            <div className="pt-1">
                              <Select value={row.invoiceStatus} onValueChange={v => updateRow(row.itemKey, { invoiceStatus: v })}>
                                <SelectTrigger className={cn('h-7 text-[10px] border-0 shadow-none rounded-full px-2', invoiceOpt?.className)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INVOICE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Upload fatura */}
                            <div className="flex items-center justify-center pt-2">
                              {uploadingId === row.itemKey ? (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              ) : row.invoiceUrl ? (
                                <button type="button" onClick={() => openSupplierFileByUrl(row.invoiceUrl)} className="p-1 hover:bg-muted rounded" title={row.invoiceName || 'Ver fatura'}>
                                  <FileText className="h-3 w-3 text-[hsl(var(--success))]" />
                                </button>

                              ) : (
                                <button
                                  className="p-1 hover:bg-muted rounded"
                                  title="Upload fatura"
                                  onClick={() => { setActiveUploadKey(row.itemKey); fileInputRef.current?.click(); }}
                                >
                                  <Upload className="h-3 w-3 text-muted-foreground" />
                                </button>
                              )}
                            </div>

                            {/* Notas */}
                            <div className="flex items-center justify-center pt-1.5">
                              <ItemNotesDialog entityType="lead_cost_item" entityId={row.itemKey} label={row.activityTitle} />
                            </div>

                            {/* Pedido de reserva */}
                            <div className="flex items-center justify-center pt-1.5">
                              <BookingRequestDialog
                                operationId={row.opId || null}
                                costItemId={row.itemKey}
                                tripId={leadId}
                                tripCode={leadCode}
                                activityName={row.activityTitle}
                                activityDate={`Dia ${row.dayNumber}`}
                                scheduleTime={row.scheduleTime}
                                supplierName={row.supplier}
                                supplierEmail=""
                                pax={row.pax}
                                netValue={row.netValue}
                                isLeadContext={true}
                                dayNumber={row.dayNumber}
                              />
                            </div>

                            {/* Histórico de emails */}
                            <div className="flex items-center justify-center pt-1.5">
                              <BookingEmailHistory leadOperationId={row.opId || undefined} label={row.activityTitle} />
                            </div>

                            {/* Eliminar linha */}
                            <div className="flex items-center justify-center pt-1.5">
                              <button
                                className="p-1 hover:bg-destructive/10 rounded"
                                title="Eliminar linha"
                                onClick={() => removeRow(row.itemKey)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive/70" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs gap-1" onClick={() => addRow(day)}>
                      <Plus className="h-3 w-3" /> Adicionar linha
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>

      {/* Indicadores e gráficos de custos/margem */}
      <LeadOpsAnalyticsPanel rows={rows} pvpTotal={pvpTotal} dayTitles={dayTitles} />

      <GuidePlanningDialog
        open={guidePdfOpen}
        onOpenChange={setGuidePdfOpen}
        leadId={leadId}
        leadCode={leadCode}
        rows={rows}
        dayTitles={dayTitles}
      />



      {/* Aviso de alterações não gravadas */}
      <AlertDialog open={guard.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não gravadas</AlertDialogTitle>
            <AlertDialogDescription>
              Tem alterações nas Operações que ainda não foram gravadas. Quer gravar antes de sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={guard.cancel} disabled={guard.saving}>Continuar a editar</Button>
            <Button variant="outline" onClick={guard.discard} disabled={guard.saving}>Sair sem gravar</Button>
            <Button onClick={guard.saveAndLeave} disabled={guard.saving}>
              {guard.saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Gravar e sair
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default LeadOperationsEditor;
