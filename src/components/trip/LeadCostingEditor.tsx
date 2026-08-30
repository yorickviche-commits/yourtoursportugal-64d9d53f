import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, CheckCircle2, MinusCircle, XCircle, Sparkles, Pencil, Trash2, Save, Loader2, Wand2, GripVertical, Link2 } from 'lucide-react';
import PaymentLinkDialog from '@/components/payments/PaymentLinkDialog';
import PaymentLinksList from '@/components/payments/PaymentLinksList';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatDayLabelPT } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SupplierSearchDropdown from './SupplierSearchDropdown';
import SupplierExperiencePicker, { type PickedExperience } from './SupplierExperiencePicker';
import CostingSmartImportDialog, { type ImportedCostRow } from './CostingSmartImportDialog';
import type { PlannerDay, PeriodKey } from './TravelPlannerEditor';

// ─── Types ───────────────────────────────────────────
export type CostLayer = 'transport' | 'guide' | 'experience' | 'accommodation' | 'meal' | 'operational';

const LAYER_CONFIG: Record<CostLayer, { label: string; emoji: string; bg: string; text: string }> = {
  transport: { label: 'Transp.', emoji: '🚐', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  guide: { label: 'Guia', emoji: '🧑‍🏫', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  experience: { label: 'Exp.', emoji: '🍷', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  accommodation: { label: 'Hotel', emoji: '🏨', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  meal: { label: 'Refeição', emoji: '🍽️', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  operational: { label: 'Oper.', emoji: '⚙️', bg: 'bg-gray-100 dark:bg-gray-800/30', text: 'text-gray-700 dark:text-gray-300' },
};

export interface LeadCostItem {
  id: string;
  description: string;
  supplier: string;
  pricingType: 'total' | 'per_person' | 'per_night';
  numAdults: number;
  priceAdults: number;
  numChildren: number;
  priceChildren: number;
  netTotal: number;
  marginPercent: number;
  pvpTotal: number;
  profit: number;
  status: 'neutro' | 'aceite' | 'eliminar' | 'opcionais';
  notes: CostNote[];
  costLayer?: CostLayer;
  isProtocol?: boolean;
  isFixedRate?: boolean;
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

/**
 * The Accommodation block lives outside the day-by-day itinerary and is stored
 * as day 0. Its visibility on the proposal/PDF is persisted in `date`
 * ("hidden" hides the block from the client).
 */
export const ACCOMMODATION_DAY = 0;
export const isAccommodationDay = (d: { day: number }) => d.day === ACCOMMODATION_DAY;

function calcItem(item: LeadCostItem): LeadCostItem {
  let netTotal: number;
  if (item.pricingType === 'per_night') {
    // For accommodation rows the "Nº Adt" column holds the number of nights.
    netTotal = item.priceAdults * (item.numAdults || 0);
  } else if (item.pricingType === 'per_person') {
    netTotal = (item.priceAdults * item.numAdults) + (item.priceChildren * item.numChildren);
  } else {
    netTotal = item.priceAdults; // when TOTAL, priceAdults = total NET value
  }
  const pvpTotal = netTotal * (1 + item.marginPercent / 100);
  const profit = pvpTotal - netTotal;
  return { ...item, netTotal, pvpTotal: Math.round(pvpTotal * 100) / 100, profit: Math.round(profit * 100) / 100 };
}

function makeDefaultItem(description: string, pax: number, paxChildren: number, layer: CostLayer, pricingType: LeadCostItem['pricingType'] = 'total'): LeadCostItem {
  return calcItem({
    id: genId(), description, supplier: '', pricingType,
    numAdults: pax, priceAdults: 0, numChildren: paxChildren, priceChildren: 0,
    netTotal: 0, marginPercent: 30, pvpTotal: 0, profit: 0, status: 'neutro', notes: [], costLayer: layer,
  });
}

function plannerToCosting(plannerDays: PlannerDay[], pax: number, paxChildren: number): LeadCostingDay[] {
  return plannerDays.map(day => {
    const items: LeadCostItem[] = [];

    // Standard items per day: Transport, Guide, Transport Costs
    items.push(makeDefaultItem('Guia — Dia ' + day.day, pax, paxChildren, 'guide'));
    items.push(makeDefaultItem('Veículo YT — Dia ' + day.day, pax, paxChildren, 'transport'));
    items.push(makeDefaultItem('Custos Transporte (combustível, portagens, parking)', pax, paxChildren, 'operational'));

    // Planner activities
    const periods: PeriodKey[] = ['morning', 'lunch', 'afternoon', 'night'];
    periods.forEach(pk => {
      const period = day.periods[pk];
      if (!period) return;
      period.items.forEach(pi => {
        if (!pi.title) return;
        // Detect layer from period
        let layer: CostLayer = 'experience';
        if (pk === 'lunch') layer = 'meal';
        if (pk === 'night') {
          const t = pi.title.toLowerCase();
          if (t.includes('hotel') || t.includes('check-in') || t.includes('alojamento') || t.includes('accommodation'))
            layer = 'accommodation';
          else if (t.includes('jantar') || t.includes('dinner') || t.includes('restaurante'))
            layer = 'meal';
        }
        items.push(calcItem({
          id: genId(),
          description: pi.title,
          supplier: '',
          pricingType: layer === 'experience' || layer === 'meal' ? 'per_person' : 'total',
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
          costLayer: layer,
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
  destination?: string;
  leadId?: string;
  leadCode?: string;
  clientName?: string;
  startDate?: string | null;
  endDate?: string | null;
  pvpOverride?: number | null;
  onPvpOverrideChange?: (v: number | null) => void;
  /** Lead version being edited (travel_plans are versioned). */
  version?: number;
}

// ─── Component ───────────────────────────────────────
const LeadCostingEditor = ({ costingDays, onChange, onSave, saving, plannerDays, pax, paxChildren, destination, leadId, leadCode, clientName, startDate, endDate, pvpOverride: pvpOverrideProp, onPvpOverrideChange, version = 0 }: LeadCostingEditorProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>(costingDays.length > 0 ? costingDays.map(d => d.day) : []);
  const [autoFilling, setAutoFilling] = useState(false);
  const [payLinkOpen, setPayLinkOpen] = useState(false);
  const [importingTP, setImportingTP] = useState(false);
  const [smartImportOpen, setSmartImportOpen] = useState(false);

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

  // Detect cost layer from bullet text (PT/EN keywords)
  const detectLayerFromText = (text: string): CostLayer => {
    const t = text.toLowerCase();
    if (/(hotel|check-in|check in|alojamento|accommodation|overnight|pousada|quinta)/.test(t)) return 'accommodation';
    if (/(almoço|almoco|jantar|lunch|dinner|restaurant|restaurante|meal|refeição|refeicao|tasting|prova|wine pairing)/.test(t)) return 'meal';
    if (/(transfer|transport|pickup|drop|drive|vehicle|veículo|veiculo|driver|motorista)/.test(t)) return 'transport';
    if (/(guide|guia)/.test(t)) return 'guide';
    return 'experience';
  };

  // Merge AI-imported cost rows (PDF / Excel / pasted text) into the existing days
  const applySmartImport = (rows: ImportedCostRow[]) => {
    if (rows.length === 0) return;
    const byDay = new Map<number, LeadCostingDay>();
    costingDays.forEach(d => byDay.set(d.day, { ...d, items: [...d.items] }));

    rows.forEach(r => {
      const dayNum = Number.isFinite(r.day) ? r.day : 1;
      let target = byDay.get(dayNum);
      if (!target) {
        target = { day: dayNum, title: `Dia ${dayNum}`, items: [] };
        byDay.set(dayNum, target);
      }
      target.items.push(calcItem({
        id: genId(),
        description: r.description,
        supplier: r.supplier || '',
        pricingType: r.pricingType,
        numAdults: r.numAdults,
        priceAdults: r.priceAdults,
        numChildren: r.numChildren,
        priceChildren: r.priceChildren,
        netTotal: 0,
        marginPercent: r.marginPercent,
        pvpTotal: 0,
        profit: 0,
        status: 'neutro',
        notes: [],
        costLayer: (r.costLayer as CostLayer) || 'experience',
      }));
    });

    const newDays = Array.from(byDay.values()).sort((a, b) => a.day - b.day);
    onChange(newDays);
    setExpandedDays(newDays.map(d => d.day));
    toast.success(`${rows.length} rubrica(s) importada(s).`);
  };

  const importFromTravelPlanner = async () => {
    if (!leadId) { toast.error('Lead ID em falta.'); return; }
    setImportingTP(true);
    try {
      const { data, error } = await supabase
        .from('travel_plans').select('days').eq('lead_id', leadId)
        .eq('version', version)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      const tpDays: any[] = Array.isArray((data as any)?.days) ? ((data as any).days as any[]) : [];
      if (tpDays.length === 0) { toast.error('Sem Travel Planner gerado ainda. Gera primeiro o plano.'); return; }

      const newDays: LeadCostingDay[] = tpDays.map((d: any) => {
        const dayNum = d.day_number || d.day || 1;
        const items: LeadCostItem[] = [];
        items.push(makeDefaultItem('Guia — Dia ' + dayNum, pax, paxChildren, 'guide'));
        items.push(makeDefaultItem('Veículo YT — Dia ' + dayNum, pax, paxChildren, 'transport'));
        items.push(makeDefaultItem('Custos Transporte (combustível, portagens, parking)', pax, paxChildren, 'operational'));

        const bullets: any[] = Array.isArray(d.bullets) ? d.bullets : [];
        bullets.forEach(b => {
          const text = typeof b === 'string' ? b : (b?.text || '');
          if (!text.trim()) return;
          const layer = detectLayerFromText(text);
          items.push(calcItem({
            id: genId(),
            description: text.trim(),
            supplier: '',
            pricingType: layer === 'experience' || layer === 'meal' ? 'per_person' : 'total',
            numAdults: pax, priceAdults: 0, numChildren: paxChildren, priceChildren: 0,
            netTotal: 0, marginPercent: 30, pvpTotal: 0, profit: 0,
            status: 'neutro', notes: [], costLayer: layer,
          }));
        });

        if (d.overnight && String(d.overnight).trim()) {
          items.push(calcItem({
            id: genId(),
            description: `Overnight — ${String(d.overnight).trim()}`,
            supplier: '',
            pricingType: 'total',
            numAdults: pax, priceAdults: 0, numChildren: paxChildren, priceChildren: 0,
            netTotal: 0, marginPercent: 30, pvpTotal: 0, profit: 0,
            status: 'neutro', notes: [], costLayer: 'accommodation',
          }));
        }
        return { day: dayNum, title: d.title || `Dia ${dayNum}`, date: d.date || '', items };
      });

      onChange(newDays);
      setExpandedDays(newDays.map(d => d.day));
      toast.success(`${newDays.length} dias importados (${newDays.reduce((s, x) => s + x.items.length, 0)} rubricas).`);
    } catch (e: any) {
      console.error('Import TP error:', e);
      toast.error(e.message || 'Erro ao importar do Travel Planner.');
    } finally {
      setImportingTP(false);
    }
  };

  const updateItem = useCallback((dayIdx: number, itemIdx: number, updates: Partial<LeadCostItem>) => {
    const updated = [...costingDays];
    const items = [...updated[dayIdx].items];
    items[itemIdx] = calcItem({ ...items[itemIdx], ...updates });
    updated[dayIdx] = { ...updated[dayIdx], items };
    onChange(updated);
  }, [costingDays, onChange]);

  // Experience picker (FSE catalogue) → fills the cost row
  const [expPicker, setExpPicker] = useState<{ dayIdx: number; itemIdx: number; supplier: string } | null>(null);

  const applyExperience = useCallback((exp: PickedExperience) => {
    if (!expPicker) return;
    const { dayIdx, itemIdx } = expPicker;
    const current = costingDays[dayIdx]?.items[itemIdx];
    const pricingType: LeadCostItem['pricingType'] =
      exp.priceUnit === 'per_person' ? 'per_person' : exp.priceUnit === 'per_night' ? 'per_night' : 'total';
    updateItem(dayIdx, itemIdx, {
      description: exp.name + (exp.duration ? ` (${exp.duration})` : ''),
      supplier: exp.supplierName || current?.supplier || '',
      pricingType,
      priceAdults: exp.price,
      priceChildren: exp.priceChild || 0,
      isProtocol: true,
    });
    setExpPicker(null);
  }, [expPicker, costingDays, updateItem]);


  const hasAccommodationSection = costingDays.some(isAccommodationDay);

  const addAccommodationSection = () => {
    if (hasAccommodationSection) {
      toggleDay(ACCOMMODATION_DAY);
      return;
    }
    onChange([
      { day: ACCOMMODATION_DAY, title: 'Alojamentos', date: '', items: [] },
      ...costingDays,
    ]);
    setExpandedDays(prev => (prev.includes(ACCOMMODATION_DAY) ? prev : [...prev, ACCOMMODATION_DAY]));
  };

  const setAccommodationVisible = (dayIdx: number, visible: boolean) => {
    const updated = [...costingDays];
    updated[dayIdx] = { ...updated[dayIdx], date: visible ? '' : 'hidden' };
    onChange(updated);
  };

  const addItem = (dayIdx: number) => {
    const isAcc = isAccommodationDay(costingDays[dayIdx]);
    if (isAcc) {
      const updated = [...costingDays];
      const newItem = makeDefaultItem('', 1, 0, 'accommodation', 'per_night');
      updated[dayIdx] = { ...updated[dayIdx], items: [...updated[dayIdx].items, newItem] };
      onChange(updated);
      return;
    }
    return addItineraryItem(dayIdx);
  };

  const addItineraryItem = (dayIdx: number) => {
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

  /**
   * Drag & drop across two sections per day: the main table
   * (`cost-day-{idx}`) and the Optionals sub-section (`cost-opt-{idx}`).
   * Indices are section-relative, so each day's items are rebuilt as
   * [main..., optionals...] — the same order shown on screen.
   */
  const onCostDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const parse = (id: string) => {
      const opt = id.startsWith('cost-opt-');
      const idx = parseInt(id.replace(opt ? 'cost-opt-' : 'cost-day-', ''), 10);
      return { opt, idx };
    };
    const src = parse(source.droppableId);
    const dst = parse(destination.droppableId);
    if (isNaN(src.idx) || isNaN(dst.idx)) return;
    if (src.opt !== dst.opt) return; // não mover entre secções por arrasto (usar o estado)

    const split = (d: LeadCostingDay) => ({
      main: d.items.filter(i => i.status !== 'opcionais'),
      opt: d.items.filter(i => i.status === 'opcionais'),
    });
    const parts = costingDays.map(split);
    const key = src.opt ? 'opt' : 'main';
    const [moved] = parts[src.idx][key].splice(source.index, 1);
    if (!moved) return;
    parts[dst.idx][key].splice(destination.index, 0, moved);
    onChange(costingDays.map((d, i) => ({ ...d, items: [...parts[i].main, ...parts[i].opt] })));
  };


  // Auto-Fulfill Budget via AI
  const autoFulfillBudget = async () => {
    const allItems = costingDays.flatMap((d, di) => 
      d.items.map((item, ii) => ({ description: item.description, day: d.day, pricingType: item.pricingType, dayIdx: di, itemIdx: ii }))
    );
    if (allItems.length === 0) { toast.error('Sem rubricas para preencher.'); return; }
    
    setAutoFilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-fulfill-budget', {
        body: { items: allItems.map(i => ({ description: i.description, day: i.day, pricingType: i.pricingType })), destination: destination || '' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const suggestions = data?.suggestions || [];
      if (suggestions.length === 0) { toast.warning('AI não retornou sugestões.'); return; }
      
      const updated = [...costingDays];
      suggestions.forEach((sug: any) => {
        const orig = allItems[sug.index];
        if (!orig) return;
        const items = [...updated[orig.dayIdx].items];
        items[orig.itemIdx] = calcItem({
          ...items[orig.itemIdx],
          supplier: sug.supplier || items[orig.itemIdx].supplier,
          priceAdults: sug.priceAdults ?? items[orig.itemIdx].priceAdults,
          pricingType: sug.pricingType || items[orig.itemIdx].pricingType,
          marginPercent: sug.marginPercent ?? items[orig.itemIdx].marginPercent,
        });
        updated[orig.dayIdx] = { ...updated[orig.dayIdx], items };
      });
      onChange(updated);
      toast.success(`${suggestions.length} rubricas preenchidas com AI.`);
    } catch (e: any) {
      console.error('Auto-fulfill error:', e);
      toast.error(e.message || 'Erro ao preencher orçamento.');
    } finally {
      setAutoFilling(false);
    }
  };

  // Grand totals — os opcionais ficam sempre FORA do preço base do programa
  const activeItems = costingDays.flatMap(d => d.items.filter(i => i.status !== 'eliminar' && i.status !== 'opcionais'));
  const optionalItems = costingDays.flatMap(d =>
    d.items.filter(i => i.status === 'opcionais').map(i => ({ item: i, day: d })),
  );
  const optionalsPVP = optionalItems.reduce((s, x) => s + x.item.pvpTotal, 0);
  const grandNet = activeItems.reduce((s, i) => s + i.netTotal, 0);
  const computedPVP = activeItems.reduce((s, i) => s + i.pvpTotal, 0);

  const totalPax = (pax || 0) + (paxChildren || 0);

  // Editable PVP override (drives margin & per-pax dynamically). NET is read-only.
  const [localPvpOverride, setLocalPvpOverride] = useState<number | null>(null);
  const pvpOverride = pvpOverrideProp !== undefined ? pvpOverrideProp : localPvpOverride;
  const setPvpOverride = (v: number | null) => {
    if (onPvpOverrideChange) onPvpOverrideChange(v);
    else setLocalPvpOverride(v);
  };
  const effectivePVP = pvpOverride != null ? pvpOverride : computedPVP;
  const grandPVP = effectivePVP;
  const grandProfit = grandPVP - grandNet;
  const grandMargin = grandNet > 0 ? (grandProfit / grandNet) * 100 : 0;
  const pvpPerPax = totalPax > 0 ? grandPVP / totalPax : 0;

  // Local edit buffers for the totals row
  const [editMargin, setEditMargin] = useState<string>('');
  const [editPVP, setEditPVP] = useState<string>('');
  const [editPerPax, setEditPerPax] = useState<string>('');

  const commitMargin = () => {
    const m = parseFloat(editMargin.replace(',', '.'));
    if (!isNaN(m) && grandNet > 0) setPvpOverride(grandNet * (1 + m / 100));
    setEditMargin('');
  };
  const commitPVP = () => {
    const v = parseFloat(editPVP.replace(',', '.'));
    if (!isNaN(v) && v >= 0) setPvpOverride(v);
    setEditPVP('');
  };
  const commitPerPax = () => {
    const v = parseFloat(editPerPax.replace(',', '.'));
    if (!isNaN(v) && v >= 0 && totalPax > 0) setPvpOverride(v * totalPax);
    setEditPerPax('');
  };
  const resetOverride = () => setPvpOverride(null);


  const hasItems = costingDays.some(d => d.items.length > 0);

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
          {hasItems && (
            <Button variant="outline" size="sm" className="text-xs gap-1 border-[hsl(var(--warning))]/50 text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10" onClick={autoFulfillBudget} disabled={autoFilling}>
              {autoFilling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              Auto-Fulfill Budget
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className="text-xs gap-1 border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
            onClick={addAccommodationSection}
          >
            <Plus className="h-3 w-3" /> {hasAccommodationSection ? 'Ver Alojamentos' : 'Secção Alojamentos'}
          </Button>
          {plannerDays.length > 0 && (
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={populateFromPlanner}>
              <Plus className="h-3 w-3" /> Importar do Planner
            </Button>
          )}
          {leadId && (
            <Button variant="outline" size="sm" className="text-xs gap-1 border-[hsl(var(--info))]/50 text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/10" onClick={importFromTravelPlanner} disabled={importingTP}>
              {importingTP ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Importar Travel Planner
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className="text-xs gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => setSmartImportOpen(true)}
          >
            <Sparkles className="h-3 w-3" /> Import Automático
          </Button>
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
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {plannerDays.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={populateFromPlanner}>
                <Plus className="h-3 w-3" /> Criar do Planner antigo
              </Button>
            )}
            {leadId && (
              <Button size="sm" className="text-xs gap-1" onClick={importFromTravelPlanner} disabled={importingTP}>
                {importingTP ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Importar do Travel Planner
              </Button>
            )}
          </div>
          {!leadId && plannerDays.length === 0 && (
            <p className="text-xs text-muted-foreground">Gera primeiro o Travel Planner para popular os custos automaticamente.</p>
          )}
        </div>
      )}

      {/* Days */}
      <DragDropContext onDragEnd={onCostDragEnd}>
      <div className="bg-card rounded-lg border overflow-hidden divide-y">
        {costingDays.map((day, dayIdx) => {
          const expanded = expandedDays.includes(day.day);
          const dayMainItems = day.items.filter(i => i.status !== 'opcionais');
          const dayOptItems = day.items.filter(i => i.status === 'opcionais');
          const dayActiveItems = dayMainItems.filter(i => i.status !== 'eliminar');
          const dayNet = dayActiveItems.reduce((s, i) => s + i.netTotal, 0);
          const dayPVP = dayActiveItems.reduce((s, i) => s + i.pvpTotal, 0);
          const dayProfit = dayPVP - dayNet;
          const dayMargin = dayNet > 0 ? (dayProfit / dayNet) * 100 : 0;
          const dayOptActive = dayOptItems.filter(i => i.status !== 'eliminar');
          const dayOptNet = dayOptActive.reduce((s, i) => s + i.netTotal, 0);
          const dayOptPVP = dayOptActive.reduce((s, i) => s + i.pvpTotal, 0);
          const dayOptProfit = dayOptPVP - dayOptNet;
          const dayOptMargin = dayOptNet > 0 ? (dayOptProfit / dayOptNet) * 100 : 0;
          const isAcc = isAccommodationDay(day);
          const accVisible = day.date !== 'hidden';

          return (
            <Collapsible key={day.day} open={expanded} onOpenChange={() => toggleDay(day.day)}>
              <CollapsibleTrigger className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors text-left">
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  {isAcc ? (
                    <>
                      <span className="text-xs text-purple-600 dark:text-purple-300 font-medium">🏨 Alojamentos</span>
                      <p className="text-sm font-bold text-purple-700 dark:text-purple-300 truncate">
                        Fora do day-by-day · preço por noite ou total
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-[hsl(var(--info))] font-medium">Dia {day.day}.</span>
                      <p className="text-sm font-bold text-[hsl(var(--info))] truncate">{day.title || 'Sem título'}</p>
                      {(formatDayLabelPT(startDate, day.day) || day.date) && (
                        <span className="text-[10px] text-muted-foreground capitalize">{formatDayLabelPT(startDate, day.day) || day.date}</span>
                      )}
                    </>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-medium">NET {dayNet.toFixed(0)}€</span>
                  <span className="text-[10px] text-muted-foreground ml-2">PVP {dayPVP.toFixed(0)}€</span>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4">
                  {isAcc && (
                    <label className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-purple-600"
                        checked={accVisible}
                        onChange={e => setAccommodationVisible(dayIdx, e.target.checked)}
                      />
                      Mostrar alojamentos (nome + nº de noites) na proposta digital e no PDF
                      {day.items.length === 0 && <span className="text-amber-600">— secção vazia, não aparece</span>}
                    </label>
                  )}
                  <button onClick={() => addItem(dayIdx)} className="mb-3 p-1 rounded-full border border-dashed border-muted-foreground/30 hover:border-[hsl(var(--info))] hover:bg-muted/20 transition-colors">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {/* Table Header */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      {tableHead}
                      <Droppable droppableId={`cost-day-${dayIdx}`}>
                        {(dropProvided, dropSnapshot) => (
                          <tbody
                            ref={dropProvided.innerRef}
                            {...dropProvided.droppableProps}
                            className={cn(dropSnapshot.isDraggingOver && "bg-[hsl(var(--info)/0.05)]")}
                          >
                            {dayMainItems.map(renderRow)}
                            {dropProvided.placeholder}
                          </tbody>
                        )}
                      </Droppable>
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
      </DragDropContext>



      {/* Grand Totals — editable & dynamic (NET read-only) */}
      {activeItems.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center items-end">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total NET</p>
              <p className="text-lg font-bold">€{grandNet.toFixed(2)}</p>
              <p className="text-[9px] text-muted-foreground">somatório custos</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Margem Média</p>
              <Input
                type="text"
                inputMode="decimal"
                value={editMargin !== '' ? editMargin : grandMargin.toFixed(1)}
                onFocus={() => setEditMargin(grandMargin.toFixed(1))}
                onChange={e => setEditMargin(e.target.value)}
                onBlur={commitMargin}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="h-9 text-lg font-bold text-center px-1"
                disabled={grandNet <= 0}
              />
              <p className="text-[9px] text-muted-foreground">% sobre NET</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lucro</p>
              <p className="text-lg font-bold text-[hsl(var(--success))]">€{grandProfit.toFixed(2)}</p>
              <p className="text-[9px] text-muted-foreground">PVP − NET</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">TOTAL PVP</p>
              <Input
                type="text"
                inputMode="decimal"
                value={editPVP !== '' ? editPVP : grandPVP.toFixed(2)}
                onFocus={() => setEditPVP(grandPVP.toFixed(2))}
                onChange={e => setEditPVP(e.target.value)}
                onBlur={commitPVP}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="h-9 text-lg font-bold text-center text-[hsl(var(--info))] px-1"
              />
              <p className="text-[9px] text-muted-foreground">preço total</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">PVP / Pessoa</p>
              <Input
                type="text"
                inputMode="decimal"
                value={editPerPax !== '' ? editPerPax : pvpPerPax.toFixed(2)}
                onFocus={() => setEditPerPax(pvpPerPax.toFixed(2))}
                onChange={e => setEditPerPax(e.target.value)}
                onBlur={commitPerPax}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="h-9 text-lg font-bold text-center text-[hsl(var(--info))] px-1"
                disabled={totalPax <= 0}
              />
              <p className="text-[9px] text-muted-foreground">{totalPax} pax</p>
            </div>
          </div>
          {pvpOverride != null && (
            <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t text-[10px] text-muted-foreground">
              <span>PVP ajustado manualmente (€{computedPVP.toFixed(2)} calculado)</span>
              <button onClick={resetOverride} className="text-[hsl(var(--info))] hover:underline font-medium">Repor cálculo</button>
            </div>
          )}
          {leadId && (
            <>
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t flex-wrap">
                <p className="text-[10px] text-muted-foreground">
                  Gera o link de pagamento WeTravel com base no PVP total (€{grandPVP.toFixed(2)}).
                </p>
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setPayLinkOpen(true)} disabled={grandPVP <= 0}>
                  <Link2 className="h-3 w-3" /> Criar link de pagamento
                </Button>
              </div>
              <PaymentLinksList leadId={leadId} />
            </>
          )}
        </div>
      )}

      {leadId && (
        <PaymentLinkDialog
          open={payLinkOpen}
          onOpenChange={setPayLinkOpen}
          leadId={leadId}
          tripRef={leadCode || null}
          defaultTitle={`${leadCode ? leadCode + ' — ' : ''}${clientName || destination || 'Your Tours Portugal'}`.slice(0, 70)}
          defaultAmount={Math.round(grandPVP * 100) / 100}
          defaultStartDate={startDate || null}
          defaultEndDate={endDate || null}
        />
      )}

      <CostingSmartImportDialog
        open={smartImportOpen}
        onOpenChange={setSmartImportOpen}
        pax={pax}
        paxChildren={paxChildren}
        onConfirm={applySmartImport}
      />

      <SupplierExperiencePicker
        open={!!expPicker}
        onOpenChange={(o) => { if (!o) setExpPicker(null); }}
        supplierName={expPicker?.supplier}
        onPick={applyExperience}
      />


    </div>

  );
};

export { plannerToCosting };
export default LeadCostingEditor;
