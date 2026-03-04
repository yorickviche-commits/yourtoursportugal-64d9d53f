import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, CheckCircle2, MinusCircle, XCircle, Sparkles, Pencil, Trash2, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { PlannerDay, PeriodKey } from './TravelPlannerEditor';

// ─── Types ───────────────────────────────────────────
export interface LeadCostItem {
  id: string;
  description: string;
  supplier: string;
  pricingType: 'total' | 'per_person';
  numAdults: number;
  priceAdults: number;
  numChildren: number;
  priceChildren: number;
  netTotal: number; // calculated
  marginPercent: number;
  pvpTotal: number; // calculated
  profit: number; // calculated
  status: 'neutro' | 'aceite' | 'eliminar' | 'opcionais';
  notes: CostNote[];
}

export interface CostNote {
  id: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
}

export interface LeadCostingDay {
  day: number;
  title: string;
  date?: string;
  items: LeadCostItem[];
}

// ─── Helpers ─────────────────────────────────────────
function genId() {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function calcItem(item: LeadCostItem): LeadCostItem {
  let netTotal: number;
  if (item.pricingType === 'per_person') {
    netTotal = (item.priceAdults * item.numAdults) + (item.priceChildren * item.numChildren);
  } else {
    netTotal = item.priceAdults; // when TOTAL, priceAdults = total NET value
  }
  const pvpTotal = netTotal * (1 + item.marginPercent / 100);
  const profit = pvpTotal - netTotal;
  return { ...item, netTotal, pvpTotal: Math.round(pvpTotal * 100) / 100, profit: Math.round(profit * 100) / 100 };
}

function plannerToCosting(plannerDays: PlannerDay[], pax: number, paxChildren: number): LeadCostingDay[] {
  return plannerDays.map(day => {
    const items: LeadCostItem[] = [];
    const periods: PeriodKey[] = ['morning', 'lunch', 'afternoon', 'night'];
    periods.forEach(pk => {
      const period = day.periods[pk];
      if (!period) return;
      period.items.forEach(pi => {
        if (!pi.title) return;
        items.push(calcItem({
          id: genId(),
          description: pi.title,
          supplier: '',
          pricingType: 'total',
          numAdults: pax,
          priceAdults: 0,
          numChildren: paxChildren,
          priceChildren: 0,
          netTotal: 0,
          marginPercent: 30,
          pvpTotal: 0,
          profit: 0,
          status: 'neutro',
          notes: [],
        }));
      });
    });
    return { day: day.day, title: day.title, date: day.date, items };
  });
}

// ─── Status Config ───────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'neutro' as const, label: 'Neutro', icon: MinusCircle, className: 'text-muted-foreground' },
  { value: 'aceite' as const, label: 'Aceite', icon: CheckCircle2, className: 'text-[hsl(var(--success))]' },
  { value: 'eliminar' as const, label: 'Eliminar', icon: XCircle, className: 'text-destructive' },
  { value: 'opcionais' as const, label: 'Opcionais', icon: Sparkles, className: 'text-[hsl(var(--warning))]' },
];

// ─── Notes Dialog ────────────────────────────────────
function CostNoteDialog({ item, onUpdate }: { item: LeadCostItem; onUpdate: (notes: CostNote[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const addNote = () => {
    if (!text.trim() && !imageUrl.trim()) return;
    const note: CostNote = {
      id: genId(),
      text: text.trim(),
      imageUrl: imageUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onUpdate([note, ...item.notes]);
    setText('');
    setImageUrl('');
  };

  const removeNote = (noteId: string) => {
    onUpdate(item.notes.filter(n => n.id !== noteId));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative p-1 hover:bg-muted rounded transition-colors" title="Notas & anexos">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          {item.notes.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[hsl(var(--info))] text-white text-[8px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
              {item.notes.length}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Notas — {item.description || 'Sem título'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            className="text-xs min-h-[60px]"
            placeholder="Escrever nota..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <Input
            className="h-8 text-xs"
            placeholder="URL de imagem / printscreen (colar link)..."
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
          />
          <Button size="sm" className="text-xs gap-1 w-full" onClick={addNote} disabled={!text.trim() && !imageUrl.trim()}>
            <Plus className="h-3 w-3" /> Adicionar Nota
          </Button>

          {item.notes.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Histórico ({item.notes.length})</p>
              {item.notes.map(note => (
                <div key={note.id} className="bg-muted/40 rounded-lg p-2.5 space-y-1.5 group relative">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={() => removeNote(note.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {note.text && <p className="text-xs text-foreground whitespace-pre-wrap">{note.text}</p>}
                  {note.imageUrl && (
                    <img src={note.imageUrl} alt="attachment" className="max-h-40 rounded border object-contain" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Props ───────────────────────────────────────────
interface LeadCostingEditorProps {
  costingDays: LeadCostingDay[];
  onChange: (days: LeadCostingDay[]) => void;
  onSave: (days: LeadCostingDay[]) => Promise<void>;
  saving?: boolean;
  plannerDays: PlannerDay[];
  pax: number;
  paxChildren: number;
}

// ─── Component ───────────────────────────────────────
const LeadCostingEditor = ({ costingDays, onChange, onSave, saving, plannerDays, pax, paxChildren }: LeadCostingEditorProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>(costingDays.length > 0 ? costingDays.map(d => d.day) : []);

  const toggleDay = (day: number) => {
    setExpandedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const expandAll = () => setExpandedDays(costingDays.map(d => d.day));
  const collapseAll = () => setExpandedDays([]);

  const populateFromPlanner = () => {
    const newDays = plannerToCosting(plannerDays, pax, paxChildren);
    onChange(newDays);
    setExpandedDays(newDays.map(d => d.day));
  };

  const updateItem = useCallback((dayIdx: number, itemIdx: number, updates: Partial<LeadCostItem>) => {
    const updated = [...costingDays];
    const items = [...updated[dayIdx].items];
    items[itemIdx] = calcItem({ ...items[itemIdx], ...updates });
    updated[dayIdx] = { ...updated[dayIdx], items };
    onChange(updated);
  }, [costingDays, onChange]);

  const addItem = (dayIdx: number) => {
    const updated = [...costingDays];
    const newItem = calcItem({
      id: genId(), description: '', supplier: '', pricingType: 'total',
      numAdults: pax, priceAdults: 0, numChildren: paxChildren, priceChildren: 0,
      netTotal: 0, marginPercent: 30, pvpTotal: 0, profit: 0, status: 'neutro', notes: [],
    });
    updated[dayIdx] = { ...updated[dayIdx], items: [...updated[dayIdx].items, newItem] };
    onChange(updated);
  };

  const removeItem = (dayIdx: number, itemIdx: number) => {
    const updated = [...costingDays];
    updated[dayIdx] = { ...updated[dayIdx], items: updated[dayIdx].items.filter((_, i) => i !== itemIdx) };
    onChange(updated);
  };

  // Grand totals (only 'aceite' and 'neutro' items)
  const activeItems = costingDays.flatMap(d => d.items.filter(i => i.status !== 'eliminar'));
  const grandNet = activeItems.reduce((s, i) => s + i.netTotal, 0);
  const grandPVP = activeItems.reduce((s, i) => s + i.pvpTotal, 0);
  const grandProfit = grandPVP - grandNet;
  const grandMargin = grandPVP > 0 ? (grandProfit / grandPVP) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {costingDays.length} dias · {costingDays.reduce((s, d) => s + d.items.length, 0)} rubricas
          </span>
          <button onClick={expandAll} className="text-[10px] text-[hsl(var(--info))] hover:underline">Expandir</button>
          <button onClick={collapseAll} className="text-[10px] text-[hsl(var(--info))] hover:underline">Colapsar</button>
        </div>
        <div className="flex items-center gap-2">
          {plannerDays.length > 0 && (
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={populateFromPlanner}>
              <Plus className="h-3 w-3" /> Importar do Planner
            </Button>
          )}
          <Button size="sm" className="text-xs gap-1" onClick={() => onSave(costingDays)} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Guardar Custos
          </Button>
        </div>
      </div>

      {/* No data */}
      {costingDays.length === 0 && (
        <div className="bg-card rounded-lg border p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Sem dados de custos.</p>
          {plannerDays.length > 0 ? (
            <Button size="sm" className="text-xs gap-1" onClick={populateFromPlanner}>
              <Plus className="h-3 w-3" /> Criar custos a partir do Travel Planner
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Gere primeiro o Travel Planner para popular os custos automaticamente.</p>
          )}
        </div>
      )}

      {/* Days */}
      <div className="bg-card rounded-lg border overflow-hidden divide-y">
        {costingDays.map((day, dayIdx) => {
          const expanded = expandedDays.includes(day.day);
          const dayActiveItems = day.items.filter(i => i.status !== 'eliminar');
          const dayNet = dayActiveItems.reduce((s, i) => s + i.netTotal, 0);
          const dayPVP = dayActiveItems.reduce((s, i) => s + i.pvpTotal, 0);
          const dayProfit = dayPVP - dayNet;
          const dayMargin = dayPVP > 0 ? (dayProfit / dayPVP) * 100 : 0;

          return (
            <Collapsible key={day.day} open={expanded} onOpenChange={() => toggleDay(day.day)}>
              <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left">
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-[hsl(var(--info))] font-medium">Dia {day.day}.</span>
                  <p className="text-sm font-bold text-[hsl(var(--info))] truncate">{day.title || 'Sem título'}</p>
                  {day.date && <span className="text-[10px] text-muted-foreground">{day.date}</span>}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-medium">NET {dayNet.toFixed(0)}€</span>
                  <span className="text-[10px] text-muted-foreground ml-2">PVP {dayPVP.toFixed(0)}€</span>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <button onClick={() => addItem(dayIdx)} className="mb-3 p-1 rounded-full border border-dashed border-muted-foreground/30 hover:border-[hsl(var(--info))] hover:bg-muted/20 transition-colors">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {/* Table Header */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-muted/30 text-muted-foreground uppercase">
                          <th className="text-left px-1.5 py-1.5 font-medium min-w-[160px]">Atividade</th>
                          <th className="text-left px-1.5 py-1.5 font-medium w-[110px]">Fornecedor</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[80px]">Por Pessoa/Total</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[55px]">Nº Adt</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[65px]">Preço Adt</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[55px]">Nº Cri</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[65px]">Preço Cri</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[75px]">NET Total</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[60px]">Margem %</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[75px]">PVP Total</th>
                          <th className="text-center px-1 py-1.5 font-medium w-[60px]">Lucro €</th>
                          <th className="w-[55px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.items.map((item, itemIdx) => {
                          const statusCfg = STATUS_OPTIONS.find(s => s.value === item.status) || STATUS_OPTIONS[0];
                          const StatusIcon = statusCfg.icon;
                          const isDeleted = item.status === 'eliminar';

                          return (
                            <tr key={item.id} className={cn("border-t border-border/30 hover:bg-muted/10 transition-colors", isDeleted && "opacity-40 line-through")}>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1" defaultValue={item.description} onBlur={e => updateItem(dayIdx, itemIdx, { description: e.target.value })} placeholder="Atividade..." />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1" defaultValue={item.supplier} onBlur={e => updateItem(dayIdx, itemIdx, { supplier: e.target.value })} placeholder="Fornecedor..." />
                              </td>
                              <td className="px-1 py-1">
                                <Select defaultValue={item.pricingType} onValueChange={v => updateItem(dayIdx, itemIdx, { pricingType: v as any })}>
                                  <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="total" className="text-xs">TOTAL</SelectItem>
                                    <SelectItem value="per_person" className="text-xs">POR PESSOA</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-muted/30 shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={item.numAdults} onBlur={e => updateItem(dayIdx, itemIdx, { numAdults: Number(e.target.value) })} />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-muted/30 shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={item.priceAdults} onBlur={e => updateItem(dayIdx, itemIdx, { priceAdults: Number(e.target.value) })} />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-muted/30 shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={item.numChildren} onBlur={e => updateItem(dayIdx, itemIdx, { numChildren: Number(e.target.value) })} />
                              </td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-muted/30 shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={item.priceChildren} onBlur={e => updateItem(dayIdx, itemIdx, { priceChildren: Number(e.target.value) })} />
                              </td>
                              <td className="px-1 py-1 text-center text-xs font-semibold">{item.netTotal.toFixed(0)}€</td>
                              <td className="px-1 py-1">
                                <Input className="h-7 text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 px-1" type="number" defaultValue={item.marginPercent} onBlur={e => updateItem(dayIdx, itemIdx, { marginPercent: Number(e.target.value) })} />
                              </td>
                              <td className="px-1 py-1 text-center text-xs font-medium">{item.pvpTotal.toFixed(1)}</td>
                              <td className="px-1 py-1 text-center text-xs font-medium text-[hsl(var(--success))]">{item.profit.toFixed(1)}</td>
                              <td className="px-1 py-1">
                                <div className="flex items-center gap-0.5">
                                  <Select defaultValue={item.status} onValueChange={v => updateItem(dayIdx, itemIdx, { status: v as any })}>
                                    <SelectTrigger className="h-6 w-auto text-[10px] border-0 bg-transparent shadow-none gap-0 px-0.5">
                                      <StatusIcon className={cn("h-3.5 w-3.5", statusCfg.className)} />
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
                                  <CostNoteDialog
                                    item={item}
                                    onUpdate={(notes) => updateItem(dayIdx, itemIdx, { notes })}
                                  />
                                  <button onClick={() => removeItem(dayIdx, itemIdx)} className="p-0.5 text-destructive/50 hover:text-destructive transition-colors">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Day Subtotals */}
                  {dayActiveItems.length > 0 && (
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
          );
        })}
      </div>

      {/* Grand Totals */}
      {activeItems.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total NET</p>
              <p className="text-lg font-bold">€{grandNet.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Margem Média</p>
              <p className="text-lg font-bold">{grandMargin.toFixed(1)}%</p>
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
};

export { plannerToCosting };
export default LeadCostingEditor;
