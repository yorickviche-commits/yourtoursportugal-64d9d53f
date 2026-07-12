import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KPIFilters } from '@/hooks/useUserKPIs';
import { useState } from 'react';

interface Props { value: KPIFilters; onChange: (v: KPIFilters) => void; }

const presets: { label: string; days: number | null }[] = [
  { label: 'Hoje', days: 0 },
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: 'Ano', days: 365 },
  { label: 'Tudo', days: null },
];

export default function KPIFiltersBar({ value, onChange }: Props) {
  const [preset, setPreset] = useState('30 dias');
  const apply = (label: string, days: number | null) => {
    setPreset(label);
    if (days === null) return onChange({});
    const to = new Date();
    const from = new Date();
    if (days === 0) from.setHours(0, 0, 0, 0);
    else from.setDate(from.getDate() - days);
    onChange({ from: from.toISOString(), to: to.toISOString() });
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-[10px] uppercase text-muted-foreground">Período</label>
        <Select value={preset} onValueChange={l => apply(l, presets.find(p => p.label === l)?.days ?? null)}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {presets.map(p => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] uppercase text-muted-foreground">De</label>
        <Input type="date" className="h-8 text-xs" value={value.from?.slice(0, 10) || ''} onChange={e => onChange({ ...value, from: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
      </div>
      <div>
        <label className="text-[10px] uppercase text-muted-foreground">Até</label>
        <Input type="date" className="h-8 text-xs" value={value.to?.slice(0, 10) || ''} onChange={e => onChange({ ...value, to: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
      </div>
      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setPreset('Tudo'); onChange({}); }}>Limpar</Button>
    </div>
  );
}
