import { X } from 'lucide-react';
import { LeadFilters, EMPTY_FILTERS } from './LeadsAdvancedFilters';
import { LEAD_STAGES } from '@/lib/leadStages';
import { useInternalUsers } from '@/hooks/useInternalUsers';

const PAYMENT_LABELS: Record<string, string> = {
  none: 'Sem pagamentos', partial: 'Parcial', full: 'Pago na totalidade',
};

interface Chip { key: string; label: string; clear: (f: LeadFilters) => LeadFilters }

interface Props {
  value: LeadFilters;
  onChange: (v: LeadFilters) => void;
}

export default function LeadsFilterChips({ value, onChange }: Props) {
  const { data: users = [] } = useInternalUsers();
  const chips: Chip[] = [];

  value.stages.forEach(st => {
    const label = LEAD_STAGES.find(s => s.stage === st)?.label || st;
    chips.push({
      key: `stage-${st}`,
      label: `Estado: ${label}`,
      clear: f => ({ ...f, stages: f.stages.filter(s => s !== st) }),
    });
  });

  const simple: [keyof LeadFilters, string][] = [
    ['departFrom', 'Partida de'], ['departTo', 'Partida até'],
    ['arriveFrom', 'Chegada de'], ['arriveTo', 'Chegada até'],
    ['createdFrom', 'Criada de'], ['createdTo', 'Criada até'],
    ['destination', 'Destino'],
    ['pvpMin', 'PVP ≥'], ['pvpMax', 'PVP ≤'],
    ['marginMin', 'Margem ≥'], ['marginMax', 'Margem ≤'],
    ['paxMin', 'Pax ≥'], ['paxMax', 'Pax ≤'],
    ['daysMin', 'Dias ≥'], ['daysMax', 'Dias ≤'],
  ];
  simple.forEach(([k, label]) => {
    const v = value[k] as string;
    if (v) chips.push({ key: k as string, label: `${label} ${v}`, clear: f => ({ ...f, [k]: '' }) });
  });

  if (value.clientType !== 'all') chips.push({ key: 'clientType', label: `Tipo: ${value.clientType}`, clear: f => ({ ...f, clientType: 'all' }) });
  if (value.source !== 'all') chips.push({ key: 'source', label: `Origem: ${value.source}`, clear: f => ({ ...f, source: 'all' }) });
  if (value.agent !== 'all') {
    const u = users.find(x => x.id === value.agent);
    chips.push({ key: 'agent', label: `Agente: ${u?.full_name || u?.email || value.agent}`, clear: f => ({ ...f, agent: 'all' }) });
  }
  if (value.paymentState !== 'all') chips.push({ key: 'paymentState', label: `Pagamento: ${PAYMENT_LABELS[value.paymentState]}`, clear: f => ({ ...f, paymentState: 'all' }) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map(c => (
        <button key={c.key} onClick={() => onChange(c.clear(value))}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground hover:bg-accent transition-colors">
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button onClick={() => onChange(EMPTY_FILTERS)} className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1">
        Limpar tudo
      </button>
    </div>
  );
}
