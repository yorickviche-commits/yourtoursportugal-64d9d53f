import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STAGES } from '@/lib/leadStages';
import { useInternalUsers } from '@/hooks/useInternalUsers';
import { cn } from '@/lib/utils';

export interface LeadFilters {
  stages: string[];
  departFrom: string;
  departTo: string;
  arriveFrom: string;
  arriveTo: string;
  createdFrom: string;
  createdTo: string;
  destination: string;
  clientType: string;   // 'all' | 'B2C' | 'B2B'
  source: string;       // 'all' | value
  agent: string;        // 'all' | user id
  pvpMin: string;
  pvpMax: string;
  marginMin: string;
  marginMax: string;
  paymentState: string; // 'all' | 'none' | 'partial' | 'full'
  paxMin: string;
  paxMax: string;
  daysMin: string;
  daysMax: string;
}

export const EMPTY_FILTERS: LeadFilters = {
  stages: [], departFrom: '', departTo: '', arriveFrom: '', arriveTo: '',
  createdFrom: '', createdTo: '', destination: '', clientType: 'all', source: 'all',
  agent: 'all', pvpMin: '', pvpMax: '', marginMin: '', marginMax: '',
  paymentState: 'all', paxMin: '', paxMax: '', daysMin: '', daysMax: '',
};

export const countActiveFilters = (f: LeadFilters) => {
  let n = f.stages.length > 0 ? 1 : 0;
  (['departFrom', 'departTo', 'arriveFrom', 'arriveTo', 'createdFrom', 'createdTo',
    'destination', 'pvpMin', 'pvpMax', 'marginMin', 'marginMax', 'paxMin', 'paxMax',
    'daysMin', 'daysMax'] as const).forEach(k => { if (f[k]) n++; });
  (['clientType', 'source', 'agent', 'paymentState'] as const).forEach(k => { if (f[k] !== 'all') n++; });
  return n;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: LeadFilters;
  onApply: (v: LeadFilters) => void;
  sources: string[];
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const RangeRow = ({ label, a, b, onA, onB, type = 'number', placeholderA = 'mín', placeholderB = 'máx' }: any) => (
  <Row label={label}>
    <div className="flex items-center gap-2">
      <Input type={type} value={a} onChange={e => onA(e.target.value)} placeholder={placeholderA} className="h-9 text-sm" />
      <span className="text-muted-foreground text-xs">–</span>
      <Input type={type} value={b} onChange={e => onB(e.target.value)} placeholder={placeholderB} className="h-9 text-sm" />
    </div>
  </Row>
);

export default function LeadsAdvancedFilters({ open, onOpenChange, value, onApply, sources }: Props) {
  const [draft, setDraft] = useState<LeadFilters>(value);
  const { data: users = [] } = useInternalUsers();

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const set = <K extends keyof LeadFilters>(k: K, v: LeadFilters[K]) => setDraft(d => ({ ...d, [k]: v }));
  const toggleStage = (stage: string) =>
    setDraft(d => ({
      ...d,
      stages: d.stages.includes(stage) ? d.stages.filter(s => s !== stage) : [...d.stages, stage],
    }));

  const groups: { title: string; items: typeof LEAD_STAGES }[] = [
    { title: 'SALES', items: LEAD_STAGES.filter(s => s.group === 'SALES') },
    { title: 'OPERAÇÕES', items: LEAD_STAGES.filter(s => s.group === 'OPERATIONS') },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="px-4 py-3 border-b sticky top-0 bg-background z-10">
          <SheetTitle className="text-base">Pesquisa avançada</SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-5">
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Estados</Label>
            {groups.map(g => (
              <div key={g.title} className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground/80">{g.title}</p>
                {g.items.map(s => (
                  <label key={s.stage} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <Checkbox checked={draft.stages.includes(s.stage)} onCheckedChange={() => toggleStage(s.stage)} />
                    <span className="text-xs">{s.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <RangeRow label="Data de partida" type="date" placeholderA="" placeholderB=""
            a={draft.departFrom} b={draft.departTo}
            onA={(v: string) => set('departFrom', v)} onB={(v: string) => set('departTo', v)} />

          <RangeRow label="Data de chegada" type="date" placeholderA="" placeholderB=""
            a={draft.arriveFrom} b={draft.arriveTo}
            onA={(v: string) => set('arriveFrom', v)} onB={(v: string) => set('arriveTo', v)} />

          <RangeRow label="Criação da file" type="date" placeholderA="" placeholderB=""
            a={draft.createdFrom} b={draft.createdTo}
            onA={(v: string) => set('createdFrom', v)} onB={(v: string) => set('createdTo', v)} />

          <Row label="Destino">
            <Input value={draft.destination} onChange={e => set('destination', e.target.value)}
              placeholder="ex.: Douro" className="h-9 text-sm" />
          </Row>

          <Row label="Tipo de cliente">
            <Select value={draft.clientType} onValueChange={v => set('clientType', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="B2C">B2C</SelectItem>
                <SelectItem value="B2B">B2B</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Canal / origem">
            <Select value={draft.source} onValueChange={v => set('source', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>

          <Row label="Agente">
            <Select value={draft.agent} onValueChange={v => set('agent', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>

          <RangeRow label="Valor PVP (€)" a={draft.pvpMin} b={draft.pvpMax}
            onA={(v: string) => set('pvpMin', v)} onB={(v: string) => set('pvpMax', v)} />

          <RangeRow label="Margem (%)" a={draft.marginMin} b={draft.marginMax}
            onA={(v: string) => set('marginMin', v)} onB={(v: string) => set('marginMax', v)} />

          <Row label="Estado de pagamento">
            <Select value={draft.paymentState} onValueChange={v => set('paymentState', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="none">Sem pagamentos</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="full">Pago na totalidade</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <RangeRow label="Nº de pax" a={draft.paxMin} b={draft.paxMax}
            onA={(v: string) => set('paxMin', v)} onB={(v: string) => set('paxMax', v)} />

          <RangeRow label="Nº de dias" a={draft.daysMin} b={draft.daysMax}
            onA={(v: string) => set('daysMin', v)} onB={(v: string) => set('daysMax', v)} />
        </div>

        <div className={cn("sticky bottom-0 bg-background border-t px-4 py-3 flex gap-2")}>
          <Button variant="outline" className="flex-1" onClick={() => { setDraft(EMPTY_FILTERS); onApply(EMPTY_FILTERS); }}>
            Limpar
          </Button>
          <Button className="flex-1" onClick={() => { onApply(draft); onOpenChange(false); }}>
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
