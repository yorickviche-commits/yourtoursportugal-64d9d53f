import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Eye, Mail, Upload, Clock, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { DbTripItineraryItem } from '@/hooks/useTripItineraryQuery';
import ItemNotesDialog from './ItemNotesDialog';

const RESERVATION_OPTIONS = [
  { value: 'pending', label: '—', className: 'text-muted-foreground' },
  { value: 'aceite', label: '✅ Aceite', className: 'text-[hsl(var(--success))]' },
  { value: 'rejected', label: 'Rejeitada', className: 'text-destructive' },
];

const PAYMENT_OPTIONS = [
  { value: 'conta_mensal', label: 'CONTA MENSAL', className: 'text-[hsl(var(--info))] font-semibold' },
  { value: 'pago_backoffice', label: 'PAGO PELO BACKOFFICE', className: 'text-[hsl(var(--info))] font-semibold' },
  { value: 'pago_guia', label: 'PAGO PELO GUIA', className: 'text-[hsl(var(--info))] font-semibold' },
  { value: 'pago_parcialmente', label: 'PAGO PARCIALMENTE', className: 'text-[hsl(var(--success))] font-semibold' },
  { value: 'a_pagar_guia', label: 'A PAGAR PELO GUIA', className: 'text-[hsl(var(--urgent))] font-semibold' },
  { value: 'a_pagar_backoffice', label: 'A PAGAR PELO BACKOFFICE', className: 'text-[hsl(var(--urgent))] font-semibold' },
  { value: 'nao_pago', label: 'NÃO PAGO', className: 'text-destructive font-semibold' },
];

interface OperationsTableProps {
  items: DbTripItineraryItem[];
  tripId: string;
  onAddItem: (item: Partial<DbTripItineraryItem>) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<DbTripItineraryItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

const OperationsTable = ({ items, tripId, onAddItem, onUpdateItem, onDeleteItem }: OperationsTableProps) => {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

  const itemsByDay = useMemo(() => {
    const grouped: Record<number, DbTripItineraryItem[]> = {};
    items.forEach(item => {
      if (!grouped[item.day_number]) grouped[item.day_number] = [];
      grouped[item.day_number].push(item);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([day, dayItems]) => ({ day: Number(day), items: dayItems }));
  }, [items]);

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const handleFieldChange = useCallback(async (id: string, field: string, value: any) => {
    await onUpdateItem(id, { [field]: value });
  }, [onUpdateItem]);

  const handleAddToDay = async (dayNumber: number) => {
    await onAddItem({
      trip_id: tripId,
      day_number: dayNumber,
      title: '',
      sort_order: 0,
    } as any);
  };

  return (
    <div className="space-y-0">
      <div className="px-4 py-2 border-b">
        <h2 className="text-sm font-semibold">Resumo de Orçamentação</h2>
      </div>

      {itemsByDay.map(({ day, items: dayItems }) => {
        const expanded = expandedDays.has(day);

        return (
          <div key={day} className="border-b last:border-b-0">
            <Collapsible open={expanded} onOpenChange={() => toggleDay(day)}>
              <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left bg-muted/5">
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1">
                  <span className="text-xs text-[hsl(var(--success))] font-medium">Dia {day}.</span>
                  <p className="text-sm font-semibold text-[hsl(var(--info))]">
                    {dayItems[0]?.title ? `- ${dayItems[0].title}` : `Day ${day}`}
                  </p>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4">
                  {/* Header row */}
                  <div className="grid grid-cols-[2fr_90px_1fr_70px_90px_80px_90px_1.2fr_60px_60px_40px] gap-1 text-[10px] font-medium text-white uppercase bg-[hsl(var(--info))]/80 px-2 py-2 rounded-t">
                    <div>Atividade</div>
                    <div>Início/Fim</div>
                    <div>Fornecedor</div>
                    <div className="text-center">Nº Pessoas</div>
                    <div className="text-center">Valor NET Total</div>
                    <div className="text-center">Pago</div>
                    <div className="text-center">Reserva</div>
                    <div className="text-center">Pagamento</div>
                    <div className="text-center">Fatura</div>
                    <div className="text-center">FSE</div>
                    <div></div>
                  </div>

                  {/* Rows */}
                  <div className="border border-t-0 rounded-b divide-y">
                    {dayItems.map(item => {
                      const reservationStatus = (item as any).reservation_status || 'pending';
                      const paymentStatus = (item as any).payment_status || 'nao_pago';
                      const paidAmount = (item as any).paid_amount || 0;
                      const netTotal = (item as any).net_total || 0;
                      const numPeople = (item as any).num_people || 0;
                      const supplier = (item as any).supplier || '';

                      const resOption = RESERVATION_OPTIONS.find(r => r.value === reservationStatus);
                      const payOption = PAYMENT_OPTIONS.find(p => p.value === paymentStatus);

                      return (
                        <div key={item.id} className="grid grid-cols-[2fr_90px_1fr_70px_90px_80px_90px_1.2fr_60px_60px_40px] gap-1 px-2 py-2.5 items-center text-xs hover:bg-muted/10">
                          {/* Activity - checkbox + name */}
                          <div className="flex items-center gap-2">
                            <input type="checkbox" className="h-3 w-3 rounded border-muted shrink-0" />
                            <Input
                              className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
                              defaultValue={item.title}
                              onBlur={e => handleFieldChange(item.id, 'title', e.target.value)}
                              placeholder="Atividade..."
                            />
                          </div>

                          {/* Start/End time */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Input
                                className="h-6 text-[10px] w-14 border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
                                defaultValue={item.start_time || ''}
                                onBlur={e => handleFieldChange(item.id, 'start_time', e.target.value || null)}
                                placeholder="--:--"
                              />
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                className="h-6 text-[10px] w-14 border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
                                defaultValue={item.end_time || ''}
                                onBlur={e => handleFieldChange(item.id, 'end_time', e.target.value || null)}
                                placeholder="--:--"
                              />
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            </div>
                          </div>

                          {/* Supplier */}
                          <div>
                            <Input
                              className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
                              defaultValue={supplier}
                              onBlur={e => handleFieldChange(item.id, 'supplier', e.target.value || null)}
                              placeholder="—"
                            />
                          </div>

                          {/* Nº Pessoas */}
                          <div className="text-center">
                            <Input
                              className="h-7 text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
                              type="number"
                              defaultValue={numPeople}
                              onBlur={e => handleFieldChange(item.id, 'num_people', Number(e.target.value))}
                            />
                          </div>

                          {/* NET Total */}
                          <div className="text-center font-semibold">
                            <Input
                              className="h-7 text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 font-semibold"
                              type="number"
                              defaultValue={netTotal}
                              onBlur={e => handleFieldChange(item.id, 'net_total', Number(e.target.value))}
                            />
                          </div>

                          {/* Pago */}
                          <div>
                            <Input
                              className="h-7 text-xs text-center bg-muted/30 border-0 shadow-none focus-visible:ring-1 px-1"
                              type="number"
                              defaultValue={paidAmount}
                              onBlur={e => handleFieldChange(item.id, 'paid_amount', Number(e.target.value))}
                            />
                          </div>

                          {/* Reserva */}
                          <div>
                            <Select defaultValue={reservationStatus} onValueChange={v => handleFieldChange(item.id, 'reservation_status', v)}>
                              <SelectTrigger className={cn("h-7 text-[10px] border-0 bg-transparent shadow-none", resOption?.className)}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RESERVATION_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    <span className={opt.className}>{opt.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Pagamento */}
                          <div>
                            <Select defaultValue={paymentStatus} onValueChange={v => handleFieldChange(item.id, 'payment_status', v)}>
                              <SelectTrigger className={cn("h-7 text-[10px] border-0 bg-transparent shadow-none", payOption?.className)}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    <span className={opt.className}>{opt.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Fatura */}
                          <div className="flex items-center justify-center gap-0.5">
                            <button className="p-1 hover:bg-muted rounded" title="Ver fatura">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 hover:bg-muted rounded" title="Upload">
                              <Upload className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>

                          {/* FSE */}
                          <div className="flex items-center justify-center gap-0.5">
                            <button className="p-1 hover:bg-muted rounded" title="Email FSE">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>

                          {/* Notes */}
                          <div className="flex items-center justify-center">
                            <ItemNotesDialog entityType="itinerary_item" entityId={item.id} label={item.title} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add item */}
                  <button
                    onClick={() => handleAddToDay(day)}
                    className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Adicionar atividade
                  </button>
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
