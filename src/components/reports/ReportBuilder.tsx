import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Pencil, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFieldOptions } from '@/hooks/useReportFields';
import { formatIsoDate } from '@/lib/reports/format';
import {
  BUCKET_LABELS, DATE_PRESET_LABELS, DATE_PRESET_ORDER, FILTER_OP_LABELS,
  type DateBucket, type DatePreset, type FilterOp, type ReportDefinition, type ReportField, type ReportFilter,
} from '@/types/reports';

interface Props {
  fields: ReportField[];
  definition: ReportDefinition;
  onChange: (d: ReportDefinition) => void;
  canSeeFinancial: boolean;
}

const TEXT_OPS: FilterOp[] = ['in', 'not_in', 'is_null', 'not_null', 'contains'];
const NUM_OPS: FilterOp[] = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in'];

/** Resolve o intervalo do preset apenas para exibição. */
export function resolveRange(preset: DatePreset, from?: string | null, to?: string | null): { from: string | null; to: string | null } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const startOfWeek = (d: Date) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const som = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
  const eom = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0));
  const y = today.getFullYear(); const m = today.getMonth();
  const q = Math.floor(m / 3);
  switch (preset) {
    case 'today': return { from: iso(today), to: iso(today) };
    case 'yesterday': { const d = addDays(today, -1); return { from: iso(d), to: iso(d) }; }
    case 'this_week': { const s = startOfWeek(today); return { from: iso(s), to: iso(addDays(s, 6)) }; }
    case 'this_week_to_date': return { from: iso(startOfWeek(today)), to: iso(today) };
    case 'last_week': { const s = addDays(startOfWeek(today), -7); return { from: iso(s), to: iso(addDays(s, 6)) }; }
    case 'this_month': return { from: iso(som(y, m)), to: iso(eom(y, m)) };
    case 'this_month_to_date': return { from: iso(som(y, m)), to: iso(today) };
    case 'last_month': return { from: iso(som(y, m - 1)), to: iso(eom(y, m - 1)) };
    case 'this_quarter': return { from: iso(som(y, q * 3)), to: iso(eom(y, q * 3 + 2)) };
    case 'last_quarter': return { from: iso(som(y, q * 3 - 3)), to: iso(eom(y, q * 3 - 1)) };
    case 'this_year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'this_year_to_date': return { from: `${y}-01-01`, to: iso(today) };
    case 'last_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'last_year_to_date': { const d = new Date(today); d.setFullYear(y - 1); return { from: `${y - 1}-01-01`, to: iso(d) }; }
    case 'next_30_days': return { from: iso(today), to: iso(addDays(today, 30)) };
    case 'next_90_days': return { from: iso(today), to: iso(addDays(today, 90)) };
    case 'next_month': return { from: iso(som(y, m + 1)), to: iso(eom(y, m + 1)) };
    case 'all': return { from: null, to: null };
    default: return { from: from ?? null, to: to ?? null };
  }
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg bg-card p-2.5 min-w-0 flex flex-col">
      <h3 className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-2 min-w-0">{children}</div>
    </div>
  );
}

export default function ReportBuilder({ fields, definition, onChange, canSeeFinancial }: Props) {
  const visibleFields = useMemo(
    () => fields.filter(f => canSeeFinancial || !f.is_financial),
    [fields, canSeeFinancial]
  );
  const byKey = useMemo(() => new Map(visibleFields.map(f => [f.key, f])), [visibleFields]);

  const patch = (p: Partial<ReportDefinition>) => onChange({ ...definition, ...p });
  const range = resolveRange(definition.date.preset, definition.date.from, definition.date.to);

  const axes = visibleFields.filter(f => f.kind === 'date_axis');
  const groupables = visibleFields.filter(f => f.groupable);
  const filterables = visibleFields.filter(f => f.filterable);

  // ---- Agrupar por
  const [groupSearch, setGroupSearch] = useState('');
  const toggleGroup = (key: string) => {
    const exists = definition.group_by.some(g => g.field === key);
    if (exists) patch({ group_by: definition.group_by.filter(g => g.field !== key) });
    else {
      const f = byKey.get(key);
      patch({ group_by: [...definition.group_by, f?.kind === 'date_axis' ? { field: key, bucket: 'month' as DateBucket } : { field: key }] });
    }
  };
  const onGroupDragEnd = (res: DropResult) => {
    if (!res.destination) return;
    const next = definition.group_by.slice();
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    patch({ group_by: next });
  };

  // ---- Colunas
  const mode = definition.mode;
  const [colTab, setColTab] = useState<'summary' | 'detail' | 'all'>('summary');
  const [colSearch, setColSearch] = useState('');
  const selectedCols = definition.columns[mode] || [];
  const setCols = (keys: string[]) => patch({ columns: { ...definition.columns, [mode]: keys } });

  const colCandidates = useMemo(() => {
    let list = visibleFields;
    if (mode === 'summary') list = list.filter(f => f.kind === 'metric');
    if (colTab === 'summary') list = list.filter(f => f.summary_default || f.kind === 'metric');
    else if (colTab === 'detail') list = list.filter(f => f.detail_default || f.kind !== 'metric');
    if (colSearch.trim()) {
      const s = colSearch.trim().toLowerCase();
      list = list.filter(f => f.label_pt.toLowerCase().includes(s));
    }
    return list;
  }, [visibleFields, mode, colTab, colSearch]);

  const toggleCol = (key: string) => {
    setCols(selectedCols.includes(key) ? selectedCols.filter(k => k !== key) : [...selectedCols, key]);
  };
  const onColDragEnd = (res: DropResult) => {
    if (!res.destination) return;
    const next = selectedCols.slice();
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    setCols(next);
  };
  const defaultCols = () =>
    setCols(visibleFields.filter(f => (mode === 'summary' ? f.summary_default : f.detail_default)).map(f => f.key));

  // ---- Filtros
  const [filterEdit, setFilterEdit] = useState<{ index: number | null; draft: ReportFilter } | null>(null);

  const groupedFilterables = useMemo(() => {
    const map = new Map<string, ReportField[]>();
    filterables.forEach(f => {
      const arr = map.get(f.field_group) || [];
      arr.push(f);
      map.set(f.field_group, arr);
    });
    return Array.from(map.entries());
  }, [filterables]);

  const groupedCols = useMemo(() => {
    const map = new Map<string, ReportField[]>();
    colCandidates.forEach(f => {
      const arr = map.get(f.field_group) || [];
      arr.push(f);
      map.set(f.field_group, arr);
    });
    return Array.from(map.entries());
  }, [colCandidates]);

  const saveFilter = (f: ReportFilter) => {
    const next = definition.filters.slice();
    if (filterEdit?.index === null || filterEdit?.index === undefined) next.push(f);
    else next[filterEdit.index] = f;
    patch({ filters: next });
    setFilterEdit(null);
  };

  const scope = definition.scope?.client_type || [];
  const toggleScope = (v: string) => {
    const next = scope.includes(v) ? scope.filter(s => s !== v) : [...scope, v];
    patch({ scope: { ...definition.scope, client_type: next } });
  };

  return (
    <div className="grid grid-cols-1 min-[900px]:grid-cols-2 xl:grid-cols-4 gap-3">
      {/* 1 — Datas */}
      <Column title="Datas">
        <Select value={definition.date.preset} onValueChange={v => patch({ date: { ...definition.date, preset: v as DatePreset } })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_PRESET_ORDER.map(p => <SelectItem key={p} value={p}>{DATE_PRESET_LABELS[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date" className="h-7 text-xs"
            disabled={definition.date.preset !== 'custom'}
            value={definition.date.preset === 'custom' ? (definition.date.from || '') : (range.from || '')}
            onChange={e => patch({ date: { ...definition.date, from: e.target.value } })}
          />
          <Input
            type="date" className="h-7 text-xs"
            disabled={definition.date.preset !== 'custom'}
            value={definition.date.preset === 'custom' ? (definition.date.to || '') : (range.to || '')}
            onChange={e => patch({ date: { ...definition.date, to: e.target.value } })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {range.from && range.to ? `${formatIsoDate(range.from)} → ${formatIsoDate(range.to)}` : 'Sem limite de datas'}
        </p>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Relatório em:</label>
          <Select value={definition.date.axis} onValueChange={v => patch({ date: { ...definition.date, axis: v } })}>
            <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {axes.map(a => <SelectItem key={a.key} value={a.key}>{a.label_pt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={definition.date.compare === 'prior_year'}
            onCheckedChange={v => patch({ date: { ...definition.date, compare: v ? 'prior_year' : null } })}
          />
          Comparar com ano anterior
        </label>
        <div className="pt-1 border-t border-border space-y-1">
          <div className="text-[10px] uppercase text-muted-foreground">Âmbito</div>
          {[['B2C', 'Reservas B2C'], ['B2B', 'Reservas B2B']].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-xs">
              <Checkbox checked={scope.includes(v)} onCheckedChange={() => toggleScope(v)} />
              {l}
            </label>
          ))}
        </div>
      </Column>

      {/* 2 — Filtros */}
      <Column title="Filtrar reservas">
        <div className="space-y-1">
          {definition.filters.map((f, i) => (
            <FilterChip
              key={`${f.field}-${i}`}
              filter={f}
              field={byKey.get(f.field)}
              onEdit={() => setFilterEdit({ index: i, draft: { ...f } })}
              onRemove={() => patch({ filters: definition.filters.filter((_, j) => j !== i) })}
            />
          ))}
          {!definition.filters.length && <p className="text-[10px] text-muted-foreground">Sem filtros</p>}
        </div>

        <Popover
          open={!!filterEdit}
          onOpenChange={o => { if (!o) setFilterEdit(null); }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline" size="sm" className="h-7 text-xs w-full"
              onClick={() => setFilterEdit({ index: null, draft: { field: filterables[0]?.key || '', op: 'in', values: [] } })}
            >
              <Plus className="h-3 w-3 mr-1" /> Adicionar filtro
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            {filterEdit && (
              <FilterEditor
                draft={filterEdit.draft}
                fields={filterables}
                groupedFields={groupedFilterables}
                onCancel={() => setFilterEdit(null)}
                onSave={saveFilter}
              />
            )}
          </PopoverContent>
        </Popover>
      </Column>

      {/* 3 — Agrupar por */}
      <Column title="Agrupar por">
        {definition.group_by.length > 0 && (
          <DragDropContext onDragEnd={onGroupDragEnd}>
            <Droppable droppableId="group-by">
              {prov => (
                <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-1">
                  {definition.group_by.map((g, i) => {
                    const fld = byKey.get(g.field);
                    return (
                      <Draggable key={g.field} draggableId={g.field} index={i}>
                        {(p, snap) => (
                          <div
                            ref={p.innerRef} {...p.draggableProps}
                            className={cn('flex items-center gap-1 border border-border rounded px-2 py-1 bg-muted/40 text-[11px]', snap.isDragging && 'shadow')}
                          >
                            <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-3 w-3" /></span>
                            <span className="truncate">{fld?.label_pt || g.field}</span>
                            {fld?.kind === 'date_axis' && (
                              <Select
                                value={g.bucket || 'month'}
                                onValueChange={v => {
                                  const next = definition.group_by.slice();
                                  next[i] = { ...g, bucket: v as DateBucket };
                                  patch({ group_by: next });
                                }}
                              >
                                <SelectTrigger className="h-6 ml-auto w-24 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(BUCKET_LABELS) as DateBucket[]).map(b => (
                                    <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <button className={cn('text-muted-foreground hover:text-destructive', fld?.kind !== 'date_axis' && 'ml-auto')} onClick={() => toggleGroup(g.field)}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {prov.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input className="h-7 pl-7 text-xs" placeholder="Pesquisar campo" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
        </div>
        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
          {groupables
            .filter(f => !groupSearch.trim() || f.label_pt.toLowerCase().includes(groupSearch.trim().toLowerCase()))
            .map(f => (
              <label key={f.key} className="flex items-center gap-2 text-[11px] py-0.5">
                <Checkbox checked={definition.group_by.some(g => g.field === f.key)} onCheckedChange={() => toggleGroup(f.key)} />
                <span className="truncate">{f.label_pt}</span>
              </label>
            ))}
        </div>
      </Column>

      {/* 4 — Colunas */}
      <Column title="Colunas">
        <RadioGroup
          value={mode}
          onValueChange={v => patch({ mode: v as 'summary' | 'detail' })}
          className="flex flex-col gap-1"
        >
          <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="summary" /> Resumo do relatório</label>
          <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="detail" /> Relatório detalhado</label>
        </RadioGroup>

        <Tabs value={colTab} onValueChange={v => setColTab(v as ColTab)}>
          <TabsList className="h-7">
            <TabsTrigger value="summary" className="text-[10px] h-5">Resumo</TabsTrigger>
            <TabsTrigger value="detail" className="text-[10px] h-5">Detalhe</TabsTrigger>
            <TabsTrigger value="all" className="text-[10px] h-5">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input className="h-7 pl-7 text-xs" placeholder="Pesquisar coluna" value={colSearch} onChange={e => setColSearch(e.target.value)} />
        </div>

        <div className="flex gap-2 text-[10px] text-primary">
          <button onClick={() => setCols(colCandidates.map(f => f.key))}>todos</button>
          <button onClick={() => setCols([])}>nenhum</button>
          <button onClick={defaultCols}>padrão</button>
        </div>

        {selectedCols.length > 0 && (
          <DragDropContext onDragEnd={onColDragEnd}>
            <Droppable droppableId="columns">
              {prov => (
                <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-1">
                  {selectedCols.map((key, i) => (
                    <Draggable key={key} draggableId={`col-${key}`} index={i}>
                      {(p, snap) => (
                        <div
                          ref={p.innerRef} {...p.draggableProps}
                          className={cn('flex items-center gap-1 border border-border rounded px-2 py-1 bg-muted/40 text-[11px]', snap.isDragging && 'shadow')}
                        >
                          <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-3 w-3" /></span>
                          <span className="truncate">{byKey.get(key)?.label_pt || key}</span>
                          <button className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => toggleCol(key)}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {prov.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {groupedCols.map(([group, list]) => (
            <div key={group}>
              <div className="text-[10px] uppercase text-muted-foreground">{group}</div>
              {list.map(f => (
                <label key={f.key} className="flex items-center gap-2 text-[11px] py-0.5">
                  <Checkbox checked={selectedCols.includes(f.key)} onCheckedChange={() => toggleCol(f.key)} />
                  <span className="truncate">{f.label_pt}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </Column>
    </div>
  );
}

function FilterEditor({
  draft, fields, groupedFields, onCancel, onSave,
}: {
  draft: ReportFilter;
  fields: ReportField[];
  groupedFields: [string, ReportField[]][];
  onCancel: () => void;
  onSave: (f: ReportFilter) => void;
}) {
  const [local, setLocal] = useState<ReportFilter>(draft);
  const [valueSearch, setValueSearch] = useState('');
  const field = fields.find(f => f.key === local.field);
  const { data: options, isLoading } = useFieldOptions(field);
  const isNumeric = field ? ['int', 'eur', 'pct', 'days'].includes(field.format) : false;
  const isDate = field ? ['date', 'datetime'].includes(field.format) : false;
  const ops = isNumeric || isDate ? NUM_OPS : TEXT_OPS;
  const needsValues = !['is_null', 'not_null'].includes(local.op);
  const freeText = (field?.options_source as any)?.type === 'free' || isNumeric || isDate;

  const toggleValue = (v: string) => {
    const cur = (local.values || []).map(String);
    setLocal({ ...local, values: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] });
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[10px] uppercase text-muted-foreground">Campo</label>
        <Select value={local.field} onValueChange={v => setLocal({ field: v, op: 'in', values: [] })}>
          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {groupedFields.map(([g, list]) => (
              <div key={g}>
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">{g}</div>
                {list.map(f => <SelectItem key={f.key} value={f.key}>{f.label_pt}</SelectItem>)}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] uppercase text-muted-foreground">Operador</label>
        <Select value={local.op} onValueChange={v => setLocal({ ...local, op: v as FilterOp })}>
          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ops.map(o => <SelectItem key={o} value={o}>{FILTER_OP_LABELS[o]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {needsValues && (
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Valores</label>
          {freeText ? (
            <Input
              className="h-7 text-xs mt-1"
              type={isNumeric ? 'number' : isDate ? 'date' : 'text'}
              value={(local.values?.[0] as any) ?? ''}
              onChange={e => setLocal({ ...local, values: [isNumeric ? Number(e.target.value) : e.target.value] })}
            />
          ) : (
            <>
              <Input className="h-7 text-xs mt-1" placeholder="Pesquisar valor" value={valueSearch} onChange={e => setValueSearch(e.target.value)} />
              <div className="max-h-40 overflow-y-auto mt-1 space-y-0.5">
                {isLoading && <div className="text-[10px] text-muted-foreground">A carregar…</div>}
                {(options || [])
                  .filter(o => !valueSearch.trim() || o.label.toLowerCase().includes(valueSearch.trim().toLowerCase()))
                  .map(o => (
                    <label key={o.value} className="flex items-center gap-2 text-[11px]">
                      <Checkbox checked={(local.values || []).map(String).includes(o.value)} onCheckedChange={() => toggleValue(o.value)} />
                      <span className="truncate">{o.label}</span>
                    </label>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 text-[10px] text-primary">
        <button onClick={() => setLocal({ ...local, op: 'is_null', values: [] })}>Nenhum</button>
        <button onClick={() => setLocal({ ...local, op: 'not_null', values: [] })}>Qualquer</button>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="h-6 text-[11px]" onClick={() => onSave(local)} disabled={!local.field}>Guardar</Button>
      </div>
    </div>
  );
}
