import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, CheckCircle2, MinusCircle, XCircle, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { DbCostItem } from '@/hooks/useCostItemsQuery';
import ItemNotesDialog from './ItemNotesDialog';

// Legacy types for LeadDetailPage backward compatibility
export interface CostingItem {
  id: string;
  activity: string;
  supplier: string;
  nrPeople: number;
  netCost: number;
  marginPercent: number;
  pvp: number;
  totalPrice: number;
  pricePerPerson: number;
}

export interface CostingDayData {
  day: number;
  title: string;
  items: CostingItem[];
}

// ---- Trip-level Costing (new API) ----

interface EditableCostingTableProps {
  items?: DbCostItem[];
  tripId?: string;
  onAddItem?: (item: Partial<DbCostItem>) => Promise<void>;
  onUpdateItem?: (id: string, updates: Partial<DbCostItem>) => Promise<void>;
  onDeleteItem?: (id: string) => Promise<void>;
  // Legacy props for lead costing
  days?: CostingDayData[];
  onChange?: (days: CostingDayData[]) => void;
  finalPrice?: number;
  onFinalPriceChange?: (price: number) => void;
}

const STATUS_OPTIONS = [
  { value: 'neutro', label: 'Neutro', icon: MinusCircle, className: 'text-muted-foreground' },
  { value: 'aceite', label: 'Aceite', icon: CheckCircle2, className: 'text-[hsl(var(--success))]' },
  { value: 'eliminar', label: 'Eliminar', icon: XCircle, className: 'text-destructive' },
  { value: 'opcionais', label: 'Opcionais', icon: Sparkles, className: 'text-[hsl(var(--warning))]' },
];

const EditableCostingTable = (props: EditableCostingTableProps) => {
  // If legacy props are passed, render the legacy version
  if (props.days && props.onChange) {
    return <LegacyCostingTable days={props.days} onChange={props.onChange} finalPrice={props.finalPrice || 0} onFinalPriceChange={props.onFinalPriceChange || (() => {})} />;
  }

  const { items = [], tripId = '', onAddItem, onUpdateItem, onDeleteItem } = props;
  return <TripCostingTable items={items} tripId={tripId} onAddItem={onAddItem!} onUpdateItem={onUpdateItem!} onDeleteItem={onDeleteItem!} />;
};

// ===== TRIP COSTING (new, matches reference image) =====

function TripCostingTable({ items, tripId, onAddItem, onUpdateItem, onDeleteItem }: {
  items: DbCostItem[];
  tripId: string;
  onAddItem: (item: Partial<DbCostItem>) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<DbCostItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

  const itemsByDay = useMemo(() => {
    const grouped: Record<number, DbCostItem[]> = {};
    items.forEach(item => {
      const day = (item as any).day_number || 1;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(item);
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
      description: '',
      category: 'other',
      supplier: null,
      unit_cost: 0,
      quantity: 1,
      margin_percent: 30,
      pricing_type: 'total',
      num_adults: 0,
      price_adults: 0,
      status: 'neutro',
      day_number: dayNumber,
    } as any);
  };

  const grandNet = items.reduce((s, i) => s + getItemNet(i), 0);
  const grandMarginPct = items.length > 0 ? items.reduce((s, i) => s + (i.margin_percent || 0), 0) / items.length : 0;
  const grandPVP = items.reduce((s, i) => s + getItemNet(i) * (1 + (i.margin_percent || 0) / 100), 0);
  const grandProfit = grandPVP - grandNet;

  return (
    <div className="space-y-0">
      {itemsByDay.map(({ day, items: dayItems }) => {
        const expanded = expandedDays.has(day);
        const dayNet = dayItems.reduce((s, i) => s + getItemNet(i), 0);
        const dayMargin = dayItems.length > 0 ? dayItems.reduce((s, i) => s + (i.margin_percent || 0), 0) / dayItems.length : 0;
        const dayPVP = dayItems.reduce((s, i) => s + getItemNet(i) * (1 + (i.margin_percent || 0) / 100), 0);
        const dayProfit = dayPVP - dayNet;

        return (
          <div key={day} className="border-b last:border-b-0">
            <Collapsible open={expanded} onOpenChange={() => toggleDay(day)}>
              <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left">
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1">
                  <span className="text-xs text-[hsl(var(--info))] font-medium">Dia {day}.</span>
                  <p className="text-sm font-semibold text-[hsl(var(--info))]">Day {day}</p>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <button onClick={() => handleAddToDay(day)} className="mb-3 p-1 rounded-full border border-dashed border-muted-foreground/30 hover:border-[hsl(var(--info))] hover:bg-muted/20 transition-colors">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {/* Header */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-muted/30 text-muted-foreground uppercase">
                          <th className="w-5 px-1 py-1.5"></th>
                          <th className="w-5 px-1 py-1.5"></th>
                          <th className="text-left px-1 py-1.5 font-medium">Despesas</th>
                          <th className="text-left px-1 py-1.5 font-medium w-[100px]">Fornecedor</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[85px]">Por Pessoa/Total</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[65px]">Nº Adultos</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[70px]">Preço Adultos</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[80px]">Valor NET Total</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[65px]">Margem (%)</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[80px]">Valor PVP/Total</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[65px]">Lucro (€)</th>
                          <th className="w-[60px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayItems.map(item => {
                          const pricingType = (item as any).pricing_type || 'total';
                          const numAdults = (item as any).num_adults || 0;
                          const priceAdults = (item as any).price_adults || 0;
                          const status = (item as any).status || 'neutro';
                          const netTotal = getItemNet(item);
                          const marginPct = item.margin_percent || 0;
                          const pvpTotal = netTotal * (1 + marginPct / 100);
                          const profit = pvpTotal - netTotal;
                          const StatusIcon = STATUS_OPTIONS.find(s => s.value === status)?.icon || MinusCircle;
                          const statusClass = STATUS_OPTIONS.find(s => s.value === status)?.className || '';

                          return (
                            <tr key={item.id} className="border-t border-border/30 hover:bg-muted/10">
                              <td className="px-1 py-1"><input type="checkbox" className="h-3 w-3 rounded" /></td>
                              <td className="px-1 py-1"><input type="checkbox" className="h-3 w-3 rounded" /></td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1" defaultValue={item.description} onBlur={e => handleFieldChange(item.id, 'description', e.target.value)} placeholder="Despesa..." />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1" defaultValue={item.supplier || ''} onBlur={e => handleFieldChange(item.id, 'supplier', e.target.value || null)} placeholder="null" />
                              </td>
                              <td className="px-1 py-1">
                                <Select defaultValue={pricingType} onValueChange={v => handleFieldChange(item.id, 'pricing_type', v)}>
                                  <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="total" className="text-xs">TOTAL</SelectItem>
                                    <SelectItem value="per_person" className="text-xs">POR PESSOA</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-muted/30 shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={numAdults} onBlur={e => handleFieldChange(item.id, 'num_adults', Number(e.target.value))} />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-muted/30 shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={priceAdults} onBlur={e => handleFieldChange(item.id, 'price_adults', Number(e.target.value))} />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-muted/30 shadow-none focus-visible:ring-1 px-1 font-semibold" type="number" defaultValue={item.unit_cost} onBlur={e => handleFieldChange(item.id, 'unit_cost', Number(e.target.value))} />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={marginPct} onBlur={e => handleFieldChange(item.id, 'margin_percent', Number(e.target.value))} />
                              </td>
                              <td className="px-1 py-1 text-center text-xs font-medium">{pvpTotal.toFixed(1)}</td>
                              <td className="px-1 py-1 text-center text-xs font-medium text-[hsl(var(--success))]">{profit.toFixed(1)}</td>
                              <td className="px-1 py-1">
                                <div className="flex items-center gap-0.5">
                                  <Select defaultValue={status} onValueChange={v => handleFieldChange(item.id, 'status', v)}>
                                    <SelectTrigger className="h-6 w-auto text-[10px] border-0 bg-transparent shadow-none gap-0 px-0.5">
                                      <StatusIcon className={cn("h-3.5 w-3.5", statusClass)} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                          <div className="flex items-center gap-1.5">
                                            <opt.icon className={cn("h-3.5 w-3.5", opt.className)} />
                                            {opt.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <ItemNotesDialog entityType="cost_item" entityId={item.id} label={item.description} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Day Subtotals */}
                  {dayItems.length > 0 && (
                    <div className="flex items-center justify-center gap-8 mt-3 text-xs pt-2 border-t">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-semibold">NET</p>
                        <p className="font-bold">{dayNet.toFixed(2)}€</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-semibold">Margem</p>
                        <p className="font-bold">{dayMargin.toFixed(2)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-semibold">Lucro</p>
                        <p className="font-bold text-[hsl(var(--success))]">{dayProfit.toFixed(2)}€</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-semibold">TOTAL</p>
                        <p className="font-bold">{dayPVP.toFixed(2)}€</p>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}

      {/* Grand Totals */}
      {items.length > 0 && (
        <div className="bg-card rounded-lg border p-4 mt-4">
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total NET</p>
              <p className="text-lg font-bold">€{grandNet.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Margem Média</p>
              <p className="text-lg font-bold">{grandMarginPct.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lucro</p>
              <p className="text-lg font-bold text-[hsl(var(--success))]">€{grandProfit.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">TOTAL PVP</p>
              <p className="text-lg font-bold text-[hsl(var(--info))]">€{grandPVP.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== LEGACY COSTING (for LeadDetailPage) =====

function LegacyCostingTable({ days, onChange, finalPrice, onFinalPriceChange }: {
  days: CostingDayData[];
  onChange: (days: CostingDayData[]) => void;
  finalPrice: number;
  onFinalPriceChange: (price: number) => void;
}) {
  const [expandedDays, setExpandedDays] = useState<number[]>(days.map(d => d.day));

  const toggleDay = (day: number) => {
    setExpandedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const recalcItem = (item: CostingItem): CostingItem => {
    const pvp = item.netCost * (1 + item.marginPercent / 100);
    const totalPrice = pvp * item.nrPeople;
    const pricePerPerson = item.nrPeople > 0 ? totalPrice / item.nrPeople : 0;
    return { ...item, pvp: Math.round(pvp * 100) / 100, totalPrice: Math.round(totalPrice * 100) / 100, pricePerPerson: Math.round(pricePerPerson * 100) / 100 };
  };

  const updateItem = (dayIndex: number, itemIndex: number, field: keyof CostingItem, value: string | number) => {
    const updated = [...days];
    const items = [...updated[dayIndex].items];
    items[itemIndex] = recalcItem({ ...items[itemIndex], [field]: value });
    updated[dayIndex] = { ...updated[dayIndex], items };
    onChange(updated);
  };

  const addItem = (dayIndex: number) => {
    const updated = [...days];
    const newItem: CostingItem = { id: `cost-${Date.now()}`, activity: '', supplier: '', nrPeople: 1, netCost: 0, marginPercent: 30, pvp: 0, totalPrice: 0, pricePerPerson: 0 };
    updated[dayIndex] = { ...updated[dayIndex], items: [...updated[dayIndex].items, newItem] };
    onChange(updated);
  };

  const removeItem = (dayIndex: number, itemIndex: number) => {
    const updated = [...days];
    updated[dayIndex] = { ...updated[dayIndex], items: updated[dayIndex].items.filter((_, i) => i !== itemIndex) };
    onChange(updated);
  };

  const allItems = days.flatMap(d => d.items);
  const grandNet = allItems.reduce((s, i) => s + i.netCost * i.nrPeople, 0);
  const grandPVP = allItems.reduce((s, i) => s + i.totalPrice, 0);
  const grandProfit = grandPVP - grandNet;
  const grandMargin = grandPVP > 0 ? (grandProfit / grandPVP) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border">
        <div className="divide-y">
          {days.map((day, dayIndex) => {
            const expanded = expandedDays.includes(day.day);
            const dayTotal = day.items.reduce((s, i) => s + i.totalPrice, 0);
            return (
              <Collapsible key={day.day} open={expanded} onOpenChange={() => toggleDay(day.day)}>
                <CollapsibleTrigger className="w-full flex items-center gap-3 p-3 px-4 hover:bg-muted/30 transition-colors text-left">
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <span className="text-xs text-[hsl(var(--info))] font-medium">Dia {day.day}</span>
                    <p className="text-sm font-semibold text-[hsl(var(--info))]">{day.title || 'Sem título'}</p>
                  </div>
                  <span className="text-xs font-medium">€{dayTotal.toFixed(0)}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground">
                          <th className="text-left px-2 py-2 font-medium">Atividade</th>
                          <th className="text-left px-2 py-2 font-medium">Fornecedor</th>
                          <th className="text-center px-2 py-2 font-medium">Nº Pessoas</th>
                          <th className="text-right px-2 py-2 font-medium">NET Unit.</th>
                          <th className="text-right px-2 py-2 font-medium">Margem %</th>
                          <th className="text-right px-2 py-2 font-medium">PVP</th>
                          <th className="text-right px-2 py-2 font-medium">Total</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.items.map((item, itemIndex) => (
                          <tr key={item.id} className="border-t border-border hover:bg-muted/20">
                            <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={item.activity} onChange={e => updateItem(dayIndex, itemIndex, 'activity', e.target.value)} /></td>
                            <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={item.supplier} onChange={e => updateItem(dayIndex, itemIndex, 'supplier', e.target.value)} /></td>
                            <td className="px-2 py-1.5"><Input className="h-7 text-xs w-16 mx-auto text-center" type="number" value={item.nrPeople} onChange={e => updateItem(dayIndex, itemIndex, 'nrPeople', Number(e.target.value))} /></td>
                            <td className="px-2 py-1.5"><Input className="h-7 text-xs w-20 ml-auto text-right" type="number" value={item.netCost} onChange={e => updateItem(dayIndex, itemIndex, 'netCost', Number(e.target.value))} /></td>
                            <td className="px-2 py-1.5"><Input className="h-7 text-xs w-16 ml-auto text-right" type="number" value={item.marginPercent} onChange={e => updateItem(dayIndex, itemIndex, 'marginPercent', Number(e.target.value))} /></td>
                            <td className="px-2 py-1.5 text-right font-medium">€{item.pvp.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right font-bold">€{item.totalPrice.toFixed(2)}</td>
                            <td className="px-2 py-1.5">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeItem(dayIndex, itemIndex)}>
                                <span className="h-3 w-3 text-destructive">✕</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Button variant="ghost" size="sm" className="text-xs gap-1 mt-2" onClick={() => addItem(dayIndex)}>
                      <Plus className="h-3 w-3" /> Adicionar linha
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <div className="grid grid-cols-5 gap-4 text-center">
          <div><p className="text-[10px] text-muted-foreground uppercase">Total NET</p><p className="text-lg font-bold">€{grandNet.toFixed(0)}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase">Total PVP</p><p className="text-lg font-bold text-[hsl(var(--info))]">€{grandPVP.toFixed(0)}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase">Lucro</p><p className="text-lg font-bold text-[hsl(var(--success))]">€{grandProfit.toFixed(0)}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase">Margem</p><p className="text-lg font-bold">{grandMargin.toFixed(1)}%</p></div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Preço Final</p>
            <Input className="h-10 text-lg font-bold text-center border-2 border-[hsl(var(--info))]" type="number" value={finalPrice} onChange={e => onFinalPriceChange(Number(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  );
}

function getItemNet(item: DbCostItem): number {
  const pt = (item as any).pricing_type || 'total';
  if (pt === 'per_person') {
    return ((item as any).price_adults || 0) * ((item as any).num_adults || 0);
  }
  return item.unit_cost || 0;
}

export default EditableCostingTable;
