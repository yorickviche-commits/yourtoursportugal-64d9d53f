import { useState, useCallback } from 'react';
import {
  DragDropContext, Droppable, Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical,
  Sun, Coffee, Sunset, Moon, Save, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────
export type PeriodKey = 'morning' | 'lunch' | 'afternoon' | 'night';

export interface PlannerItem {
  id: string;
  title: string;
  description: string;
  location: string;
  duration: string;
}

export interface PlannerPeriod {
  label: string;
  items: PlannerItem[];
}

export interface PlannerDay {
  day: number;
  title: string;
  date?: string;
  periods: Record<PeriodKey, PlannerPeriod>;
}

// ─── Constants ───────────────────────────────────────────
const PERIOD_CONFIG: { key: PeriodKey; label: string; icon: typeof Sun; color: string; bg: string }[] = [
  { key: 'morning', label: 'Manhã', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  { key: 'lunch', label: 'Almoço', icon: Coffee, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' },
  { key: 'afternoon', label: 'Tarde', icon: Sunset, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  { key: 'night', label: 'Noite', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' },
];

function genId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyPeriods(): Record<PeriodKey, PlannerPeriod> {
  return {
    morning: { label: 'Manhã', items: [] },
    lunch: { label: 'Almoço', items: [] },
    afternoon: { label: 'Tarde', items: [] },
    night: { label: 'Noite', items: [] },
  };
}

// ─── Props ───────────────────────────────────────────────
interface TravelPlannerEditorProps {
  days: PlannerDay[];
  onChange: (days: PlannerDay[]) => void;
  onSave: (days: PlannerDay[]) => Promise<void>;
  saving?: boolean;
}

// ─── Component ───────────────────────────────────────────
const TravelPlannerEditor = ({ days, onChange, onSave, saving }: TravelPlannerEditorProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>(days.length > 0 ? [days[0].day] : []);
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(new Set());

  const toggleDay = (day: number) => {
    setExpandedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const expandAll = () => setExpandedDays(days.map(d => d.day));
  const collapseAll = () => setExpandedDays([]);

  const togglePeriod = (dayIdx: number, period: PeriodKey) => {
    const key = `${dayIdx}-${period}`;
    setCollapsedPeriods(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Drag & Drop ──
  const onDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // droppableId format: "dayIdx-periodKey"
    const [srcDayStr, srcPeriod] = source.droppableId.split('-') as [string, PeriodKey];
    const [dstDayStr, dstPeriod] = destination.droppableId.split('-') as [string, PeriodKey];
    const srcDay = parseInt(srcDayStr);
    const dstDay = parseInt(dstDayStr);

    const updated = days.map(d => ({
      ...d,
      periods: Object.fromEntries(
        Object.entries(d.periods).map(([k, v]) => [k, { ...v, items: [...v.items] }])
      ) as Record<PeriodKey, PlannerPeriod>,
    }));

    const [moved] = updated[srcDay].periods[srcPeriod].items.splice(source.index, 1);
    updated[dstDay].periods[dstPeriod].items.splice(destination.index, 0, moved);

    onChange(updated);
  }, [days, onChange]);

  // ── Mutations ──
  const updateDayTitle = (dayIdx: number, title: string) => {
    const updated = [...days];
    updated[dayIdx] = { ...updated[dayIdx], title };
    onChange(updated);
  };

  const addItem = (dayIdx: number, period: PeriodKey) => {
    const updated = [...days];
    const p = { ...updated[dayIdx].periods[period] };
    p.items = [...p.items, { id: genId(), title: '', description: '', location: '', duration: '' }];
    updated[dayIdx] = { ...updated[dayIdx], periods: { ...updated[dayIdx].periods, [period]: p } };
    onChange(updated);
  };

  const updateItem = (dayIdx: number, period: PeriodKey, itemIdx: number, updates: Partial<PlannerItem>) => {
    const updated = [...days];
    const p = { ...updated[dayIdx].periods[period] };
    const items = [...p.items];
    items[itemIdx] = { ...items[itemIdx], ...updates };
    p.items = items;
    updated[dayIdx] = { ...updated[dayIdx], periods: { ...updated[dayIdx].periods, [period]: p } };
    onChange(updated);
  };

  const removeItem = (dayIdx: number, period: PeriodKey, itemIdx: number) => {
    const updated = [...days];
    const p = { ...updated[dayIdx].periods[period] };
    p.items = p.items.filter((_, i) => i !== itemIdx);
    updated[dayIdx] = { ...updated[dayIdx], periods: { ...updated[dayIdx].periods, [period]: p } };
    onChange(updated);
  };

  const removePeriod = (dayIdx: number, period: PeriodKey) => {
    const updated = [...days];
    const p = { ...updated[dayIdx].periods[period] };
    p.items = [];
    updated[dayIdx] = { ...updated[dayIdx], periods: { ...updated[dayIdx].periods, [period]: p } };
    onChange(updated);
  };

  const addDay = () => {
    const newDay: PlannerDay = {
      day: days.length + 1,
      title: '',
      periods: emptyPeriods(),
    };
    onChange([...days, newDay]);
    setExpandedDays(prev => [...prev, newDay.day]);
  };

  const removeDay = (dayIdx: number) => {
    const updated = days.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, day: i + 1 }));
    onChange(updated);
  };

  const totalItems = days.reduce((sum, d) => sum + Object.values(d.periods).reduce((s, p) => s + p.items.length, 0), 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {days.length} dias · {totalItems} atividades
          </span>
          <button onClick={expandAll} className="text-[10px] text-[hsl(var(--info))] hover:underline">Expandir todos</button>
          <button onClick={collapseAll} className="text-[10px] text-[hsl(var(--info))] hover:underline">Colapsar todos</button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={addDay}>
            <Plus className="h-3 w-3" /> Adicionar Dia
          </Button>
          <Button size="sm" className="text-xs gap-1" onClick={() => onSave(days)} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Guardar Plano
          </Button>
        </div>
      </div>

      {/* Days */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-3">
          {days.map((day, dayIdx) => {
            const isExpanded = expandedDays.includes(day.day);
            const dayItemCount = Object.values(day.periods).reduce((s, p) => s + p.items.length, 0);

            return (
              <div key={day.day} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                {/* Day Header */}
                <button
                  onClick={() => toggleDay(day.day)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left group"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[hsl(var(--info))] text-white text-sm font-bold shrink-0 shadow-sm">
                    D{day.day}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">
                        {day.title || <span className="text-muted-foreground italic font-normal">Sem título</span>}
                      </p>
                      {day.date && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{day.date}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {dayItemCount} atividades · {Object.entries(day.periods).filter(([, p]) => p.items.length > 0).map(([k]) => PERIOD_CONFIG.find(c => c.key === k)?.label).join(' → ')}
                    </p>
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Day title edit */}
                    <Input
                      className="text-sm font-semibold h-9"
                      value={day.title}
                      onChange={e => updateDayTitle(dayIdx, e.target.value)}
                      placeholder="Título do dia (ex: Porto & Ribeira)"
                    />

                    {/* Periods */}
                    {PERIOD_CONFIG.map(pc => {
                      const period = day.periods[pc.key];
                      const periodKey = `${dayIdx}-${pc.key}`;
                      const isPeriodCollapsed = collapsedPeriods.has(periodKey);
                      const Icon = pc.icon;
                      const hasItems = period.items.length > 0;

                      return (
                        <div key={pc.key} className={cn("rounded-lg border transition-all", pc.bg)}>
                          {/* Period Header */}
                          <div className="flex items-center justify-between px-3 py-2">
                            <button
                              onClick={() => togglePeriod(dayIdx, pc.key)}
                              className="flex items-center gap-2 text-left flex-1"
                            >
                              <Icon className={cn("h-4 w-4", pc.color)} />
                              <span className="text-xs font-bold text-foreground">{pc.label}</span>
                              <span className="text-[10px] text-muted-foreground">({period.items.length})</span>
                              {isPeriodCollapsed
                                ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              }
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => addItem(dayIdx, pc.key)}
                                className="text-[10px] text-[hsl(var(--info))] hover:underline flex items-center gap-0.5"
                              >
                                <Plus className="h-3 w-3" /> Item
                              </button>
                              {hasItems && (
                                <button
                                  onClick={() => removePeriod(dayIdx, pc.key)}
                                  className="text-[10px] text-destructive hover:underline ml-2"
                                  title="Limpar período"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Period Items - Droppable */}
                          {!isPeriodCollapsed && (
                            <Droppable droppableId={`${dayIdx}-${pc.key}`}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn(
                                    "px-3 pb-2 space-y-2 min-h-[8px] transition-colors rounded-b-lg",
                                    snapshot.isDraggingOver && "bg-[hsl(var(--info)/0.08)]"
                                  )}
                                >
                                  {period.items.map((item, itemIdx) => (
                                    <Draggable key={item.id} draggableId={item.id} index={itemIdx}>
                                      {(dragProvided, dragSnapshot) => (
                                        <div
                                          ref={dragProvided.innerRef}
                                          {...dragProvided.draggableProps}
                                          className={cn(
                                            "bg-background/80 backdrop-blur-sm rounded-lg border p-2.5 transition-shadow group/item",
                                            dragSnapshot.isDragging && "shadow-lg ring-2 ring-[hsl(var(--info)/0.3)]"
                                          )}
                                        >
                                          <div className="flex items-start gap-2">
                                            {/* Drag Handle */}
                                            <div
                                              {...dragProvided.dragHandleProps}
                                              className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                              <GripVertical className="h-4 w-4" />
                                            </div>

                                            {/* Item Fields */}
                                            <div className="flex-1 space-y-1.5">
                                              <Input
                                                className="h-7 text-xs font-medium border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input transition-colors"
                                                value={item.title}
                                                onChange={e => updateItem(dayIdx, pc.key, itemIdx, { title: e.target.value })}
                                                placeholder="Título da atividade..."
                                              />
                                              <Textarea
                                                className="text-[11px] min-h-[40px] resize-none border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input transition-colors"
                                                value={item.description}
                                                onChange={e => updateItem(dayIdx, pc.key, itemIdx, { description: e.target.value })}
                                                placeholder="Descrição..."
                                                rows={2}
                                              />
                                              <div className="flex gap-2">
                                                <Input
                                                  className="h-6 text-[10px] flex-1 border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
                                                  value={item.location}
                                                  onChange={e => updateItem(dayIdx, pc.key, itemIdx, { location: e.target.value })}
                                                  placeholder="📍 Localização..."
                                                />
                                                <Input
                                                  className="h-6 text-[10px] w-20 border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
                                                  value={item.duration}
                                                  onChange={e => updateItem(dayIdx, pc.key, itemIdx, { duration: e.target.value })}
                                                  placeholder="⏱ Duração"
                                                />
                                              </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                              onClick={() => removeItem(dayIdx, pc.key, itemIdx)}
                                              className="mt-1 opacity-0 group-hover/item:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                  {period.items.length === 0 && (
                                    <button
                                      onClick={() => addItem(dayIdx, pc.key)}
                                      className="w-full py-3 text-[10px] text-muted-foreground border border-dashed rounded-lg hover:border-[hsl(var(--info)/0.5)] hover:text-[hsl(var(--info))] transition-colors"
                                    >
                                      + Adicionar atividade
                                    </button>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          )}
                        </div>
                      );
                    })}

                    {/* Remove Day */}
                    <div className="flex justify-end pt-1">
                      <Button variant="ghost" size="sm" className="text-[10px] text-destructive gap-1 h-7" onClick={() => removeDay(dayIdx)}>
                        <Trash2 className="h-3 w-3" /> Remover Dia {day.day}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {days.length === 0 && (
        <div className="bg-card rounded-xl border p-8 text-center space-y-3">
          <div className="text-3xl">🗺️</div>
          <p className="text-sm text-muted-foreground">Nenhum plano de viagem ainda</p>
          <p className="text-[10px] text-muted-foreground">Use "🤖 Gerar com AI" ou adicione dias manualmente</p>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={addDay}>
            <Plus className="h-3 w-3" /> Adicionar Primeiro Dia
          </Button>
        </div>
      )}
    </div>
  );
};

export default TravelPlannerEditor;
export { emptyPeriods, genId };
