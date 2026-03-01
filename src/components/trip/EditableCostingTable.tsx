import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

interface EditableCostingTableProps {
  days: CostingDayData[];
  onChange: (days: CostingDayData[]) => void;
  finalPrice: number;
  onFinalPriceChange: (price: number) => void;
}

const recalcItem = (item: CostingItem): CostingItem => {
  const pvp = item.netCost * (1 + item.marginPercent / 100);
  const totalPrice = pvp * item.nrPeople;
  const pricePerPerson = item.nrPeople > 0 ? totalPrice / item.nrPeople : 0;
  return { ...item, pvp: Math.round(pvp * 100) / 100, totalPrice: Math.round(totalPrice * 100) / 100, pricePerPerson: Math.round(pricePerPerson * 100) / 100 };
};

const EditableCostingTable = ({ days, onChange, finalPrice, onFinalPriceChange }: EditableCostingTableProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>(days.map(d => d.day));

  const toggleDay = (day: number) => {
    setExpandedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
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
    const newItem: CostingItem = {
      id: `cost-${Date.now()}`,
      activity: '',
      supplier: '',
      nrPeople: 1,
      netCost: 0,
      marginPercent: 30,
      pvp: 0,
      totalPrice: 0,
      pricePerPerson: 0,
    };
    updated[dayIndex] = { ...updated[dayIndex], items: [...updated[dayIndex].items, newItem] };
    onChange(updated);
  };

  const removeItem = (dayIndex: number, itemIndex: number) => {
    const updated = [...days];
    updated[dayIndex] = { ...updated[dayIndex], items: updated[dayIndex].items.filter((_, i) => i !== itemIndex) };
    onChange(updated);
  };

  // Grand totals
  const allItems = days.flatMap(d => d.items);
  const grandNet = allItems.reduce((s, i) => s + i.netCost * i.nrPeople, 0);
  const grandPVP = allItems.reduce((s, i) => s + i.totalPrice, 0);
  const grandProfit = grandPVP - grandNet;
  const grandMargin = grandPVP > 0 ? (grandProfit / grandPVP) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold">Costing / Budget</h2>
        </div>
        <div className="divide-y">
          {days.map((day, dayIndex) => {
            const expanded = expandedDays.includes(day.day);
            const dayTotal = day.items.reduce((s, i) => s + i.totalPrice, 0);
            const dayNet = day.items.reduce((s, i) => s + i.netCost * i.nrPeople, 0);
            return (
              <div key={day.day}>
                <button onClick={() => toggleDay(day.day)} className="w-full flex items-center gap-3 p-3 px-4 hover:bg-muted/30 transition-colors text-left">
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <span className="text-xs text-[hsl(var(--info))] font-medium">Dia {day.day}</span>
                    <p className="text-sm font-semibold text-[hsl(var(--info))]">{day.title || 'Sem título'}</p>
                  </div>
                  <span className="text-xs font-medium">€{dayTotal.toFixed(0)}</span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/40 text-muted-foreground">
                            <th className="text-left px-2 py-2 font-medium">Atividade</th>
                            <th className="text-left px-2 py-2 font-medium">Fornecedor</th>
                            <th className="text-center px-2 py-2 font-medium">Nº Pessoas</th>
                            <th className="text-right px-2 py-2 font-medium">NET Unit.</th>
                            <th className="text-right px-2 py-2 font-medium">Margem %</th>
                            <th className="text-right px-2 py-2 font-medium">PVP Unit.</th>
                            <th className="text-right px-2 py-2 font-medium">Total</th>
                            <th className="text-right px-2 py-2 font-medium">P/Pessoa</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.items.map((item, itemIndex) => (
                            <tr key={item.id} className="border-t border-border hover:bg-muted/20">
                              <td className="px-2 py-1.5">
                                <Input className="h-7 text-xs" value={item.activity} onChange={e => updateItem(dayIndex, itemIndex, 'activity', e.target.value)} placeholder="Atividade..." />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input className="h-7 text-xs" value={item.supplier} onChange={e => updateItem(dayIndex, itemIndex, 'supplier', e.target.value)} placeholder="Fornecedor..." />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input className="h-7 text-xs w-16 mx-auto text-center" type="number" value={item.nrPeople} onChange={e => updateItem(dayIndex, itemIndex, 'nrPeople', Number(e.target.value))} />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input className="h-7 text-xs w-20 ml-auto text-right" type="number" value={item.netCost} onChange={e => updateItem(dayIndex, itemIndex, 'netCost', Number(e.target.value))} />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input className="h-7 text-xs w-16 ml-auto text-right" type="number" value={item.marginPercent} onChange={e => updateItem(dayIndex, itemIndex, 'marginPercent', Number(e.target.value))} />
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium">€{item.pvp.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right font-bold">€{item.totalPrice.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right text-muted-foreground">€{item.pricePerPerson.toFixed(2)}</td>
                              <td className="px-2 py-1.5">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeItem(dayIndex, itemIndex)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1 mt-2" onClick={() => addItem(dayIndex)}>
                      <Plus className="h-3 w-3" /> Adicionar linha
                    </Button>

                    {/* Day subtotals */}
                    <div className="flex items-center justify-center gap-6 mt-3 text-xs border-t pt-2">
                      <div className="text-center">
                        <p className="text-muted-foreground">NET</p>
                        <p className="font-bold">€{dayNet.toFixed(0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">TOTAL</p>
                        <p className="font-bold">€{dayTotal.toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grand Total Footer */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="text-xs font-bold text-foreground uppercase mb-3">Grand Total</h3>
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Total NET</p>
            <p className="text-lg font-bold">€{grandNet.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Total PVP</p>
            <p className="text-lg font-bold text-[hsl(var(--info))]">€{grandPVP.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Lucro</p>
            <p className="text-lg font-bold text-[hsl(var(--stable))]">€{grandProfit.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Margem</p>
            <p className="text-lg font-bold">{grandMargin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Preço Final (editável)</p>
            <Input
              className="h-10 text-lg font-bold text-center border-2 border-[hsl(var(--info))]"
              type="number"
              value={finalPrice}
              onChange={e => onFinalPriceChange(Number(e.target.value))}
            />
          </div>
        </div>
        {finalPrice > 0 && finalPrice !== grandPVP && (
          <div className="mt-3 text-center text-xs">
            <span className="text-muted-foreground">Diferença vs PVP calculado: </span>
            <span className={finalPrice > grandPVP ? 'text-[hsl(var(--stable))] font-bold' : 'text-destructive font-bold'}>
              {finalPrice > grandPVP ? '+' : ''}€{(finalPrice - grandPVP).toFixed(0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableCostingTable;
