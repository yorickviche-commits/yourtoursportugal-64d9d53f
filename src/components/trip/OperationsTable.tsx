import { useState, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Eye, Upload, Clock, Paperclip, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { DbCostItem } from '@/hooks/useCostItemsQuery';
import { useTripOperationsQuery, useUpsertTripOperation, DbTripOperation } from '@/hooks/useTripOperationsQuery';
import ItemNotesDialog from './ItemNotesDialog';
import BookingRequestDialog from './BookingRequestDialog';
import BookingEmailHistory from './BookingEmailHistory';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

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

interface OperationsTableProps {
  costItems: DbCostItem[];
  tripId: string;
  tripCode: string;
  startDate?: string | null;
}

const OperationsTable = ({ costItems, tripId, tripCode, startDate }: OperationsTableProps) => {
  const { data: operations = [], isLoading } = useTripOperationsQuery(tripId);
  const upsertOp = useUpsertTripOperation();
  const { toast } = useToast();
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadCostId, setActiveUploadCostId] = useState<string | null>(null);

  // Map operations by cost_item_id for quick lookup
  const opsMap = useMemo(() => {
    const map: Record<string, DbTripOperation> = {};
    operations.forEach(op => { map[op.cost_item_id] = op; });
    return map;
  }, [operations]);

  // Group cost items by day
  const itemsByDay = useMemo(() => {
    const grouped: Record<number, DbCostItem[]> = {};
    costItems.forEach(item => {
      const day = item.day_number || 1;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(item);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([day, items]) => ({ day: Number(day), items }));
  }, [costItems]);

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const getDayDate = (dayNumber: number): string => {
    if (!startDate) return '';
    try {
      const date = addDays(parseISO(startDate), dayNumber - 1);
      return format(date, "EEEE, d MMMM yyyy", { locale: pt });
    } catch { return ''; }
  };

  const handleOpFieldChange = useCallback(async (costItemId: string, field: string, value: any) => {
    try {
      await upsertOp.mutateAsync({
        cost_item_id: costItemId,
        trip_id: tripId,
        [field]: value,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao guardar', description: err.message, variant: 'destructive' });
    }
  }, [upsertOp, tripId, toast]);

  const handleInvoiceUpload = async (costItemId: string, file: File) => {
    setUploadingId(costItemId);
    try {
      const ext = file.name.split('.').pop();
      const path = `invoices/${tripId}/${costItemId}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('supplier-files').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('supplier-files').getPublicUrl(path);

      await upsertOp.mutateAsync({
        cost_item_id: costItemId,
        trip_id: tripId,
        invoice_file_url: publicUrl,
        invoice_file_name: file.name,
        invoice_status: 'invoice_received',
      });

      toast({ title: 'Fatura carregada com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const getItemNet = (item: DbCostItem): number => {
    const pricingType = item.pricing_type || 'total';
    if (pricingType === 'per_person') {
      return (item.price_adults || 0) * (item.num_adults || 0);
    }
    return item.unit_cost || 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">A carregar operações...</span>
      </div>
    );
  }

  if (costItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Sem itens de custo. Adicione itens no separador "Custos" primeiro.</p>
      </div>
    );
  }

  // Summary stats
  const totalItems = costItems.length;
  const confirmedCount = costItems.filter(ci => opsMap[ci.id]?.booking_status === 'confirmed').length;
  const paidCount = costItems.filter(ci => opsMap[ci.id]?.payment_status === 'paid').length;
  const invoicedCount = costItems.filter(ci => ['invoice_received', 'invoice_approved', 'invoice_paid'].includes(opsMap[ci.id]?.invoice_status || '')).length;

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
          if (file && activeUploadCostId) handleInvoiceUpload(activeUploadCostId, file);
          e.target.value = '';
        }}
      />

      {/* Summary bar */}
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-6 flex-wrap">
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

      {itemsByDay.map(({ day, items: dayItems }) => {
        const expanded = expandedDays.has(day);
        const dayDate = getDayDate(day);
        const dayConfirmed = dayItems.filter(ci => opsMap[ci.id]?.booking_status === 'confirmed').length;

        return (
          <div key={day} className="border-b last:border-b-0">
            <Collapsible open={expanded} onOpenChange={() => toggleDay(day)}>
              <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left bg-muted/5">
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1">
                  <span className="text-xs text-[hsl(var(--success))] font-medium">Dia {day}</span>
                  {dayDate && <span className="text-xs text-muted-foreground ml-2">— {dayDate}</span>}
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
                      const netValue = getItemNet(item);

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
                              onBlur={e => handleOpFieldChange(item.id, 'schedule_time', e.target.value || null)}
                              placeholder="--:--"
                            />
                          </div>

                          {/* Activity name (read-only from costs) */}
                          <div className="text-xs font-medium truncate" title={item.description}>
                            {item.description || '—'}
                          </div>

                          {/* Supplier (read-only from costs) */}
                          <div className="text-xs text-muted-foreground truncate" title={item.supplier || ''}>
                            {item.supplier || '—'}
                          </div>

                          {/* Pax (read-only from costs) */}
                          <div className="text-center text-xs">
                            {item.num_adults || 0}
                          </div>

                          {/* NET Value (read-only from costs) */}
                          <div className="text-center text-xs font-semibold">
                            €{netValue.toFixed(0)}
                          </div>

                          {/* Booking Status */}
                          <div>
                            <Select value={bookingStatus} onValueChange={v => handleOpFieldChange(item.id, 'booking_status', v)}>
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
                            <Select value={paymentStatus} onValueChange={v => handleOpFieldChange(item.id, 'payment_status', v)}>
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
                            <Select value={invoiceStatus} onValueChange={v => handleOpFieldChange(item.id, 'invoice_status', v)}>
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
                          <div className="flex items-center justify-center gap-0.5">
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
                                onClick={() => { setActiveUploadCostId(item.id); fileInputRef.current?.click(); }}
                              >
                                <Upload className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>

                          {/* Notes */}
                          <div className="flex items-center justify-center">
                            <ItemNotesDialog entityType="cost_item" entityId={item.id} label={item.description} />
                          </div>

                          {/* Booking Request Email */}
                          <div className="flex items-center justify-center">
                            <BookingRequestDialog
                              operationId={op?.id || null}
                              costItemId={item.id}
                              tripId={tripId}
                              tripCode={tripCode}
                              activityName={item.description || ''}
                              activityDate={getDayDate(item.day_number)}
                              scheduleTime={scheduleTime}
                              supplierName={item.supplier || ''}
                              supplierEmail=""
                              pax={item.num_adults || 0}
                              netValue={netValue}
                            />
                          </div>

                          {/* Email History */}
                          <div className="flex items-center justify-center">
                            <BookingEmailHistory
                              operationId={op?.id || undefined}
                              label={item.description || ''}
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
  );
};

export default OperationsTable;
