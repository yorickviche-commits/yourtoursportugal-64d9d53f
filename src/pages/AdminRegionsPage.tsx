import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRegions, COUNTRY_LABELS, type Country, type Region } from '@/hooks/useRegions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function AdminRegionsPage() {
  const qc = useQueryClient();
  const { data: regions = [], isLoading } = useRegions({ includeInactive: true });
  const [country, setCountry] = useState<Country | 'all'>('all');
  const [newName, setNewName] = useState('');
  const [newCountry, setNewCountry] = useState<Country>('ES');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['regions_all'] });
    qc.invalidateQueries({ queryKey: ['regions_list'] });
  };
  const run = async (p: PromiseLike<{ error: any }>, ok?: string) => {
    const { error } = await p;
    if (error) { toast.error(error.message); return false; }
    if (ok) toast.success(ok);
    refresh();
    return true;
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    const slug = slugify(name);
    const max = Math.max(0, ...regions.map(r => r.sort_order));
    if (await run(supabase.from('regions').insert({ name, slug, code: `${newCountry}_${slug.toUpperCase().replace(/-/g, '_')}`, country: newCountry, sort_order: max + 10, is_active: true } as any), 'Região criada')) setNewName('');
  };

  const update = (r: Region, patch: Record<string, unknown>) => run(supabase.from('regions').update(patch as any).eq('id', r.id));

  const move = async (idx: number, dir: -1 | 1) => {
    const list = shown; const a = list[idx], b = list[idx + dir];
    if (!a || !b) return;
    await supabase.from('regions').update({ sort_order: b.sort_order } as any).eq('id', a.id);
    await run(supabase.from('regions').update({ sort_order: a.sort_order } as any).eq('id', b.id));
  };

  const shown = regions.filter(r => country === 'all' || r.country === country);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Regiões</h1>
        <p className="text-xs text-muted-foreground">Fonte única de regiões e cidades (Portugal e Espanha) usadas em leads, FSEs, travel plans e AI.</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nova região (ex.: Astúrias)" className="h-9 flex-1 min-w-[180px]" onKeyDown={e => e.key === 'Enter' && create()} />
        <select value={newCountry} onChange={e => setNewCountry(e.target.value as Country)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="PT">Portugal</option><option value="ES">Espanha</option>
        </select>
        <Button size="sm" onClick={create} className="h-9"><Plus className="mr-1 h-4 w-4" />Criar</Button>
      </div>

      <div className="flex gap-1">
        {(['all', 'PT', 'ES'] as const).map(c => (
          <Button key={c} size="sm" variant={country === c ? 'default' : 'outline'} onClick={() => setCountry(c)} className="h-7 text-xs">
            {c === 'all' ? 'Todas' : COUNTRY_LABELS[c]}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">A carregar…</p>}
      <div className="space-y-2">
        {shown.map((r, i) => <RegionRow key={r.id} r={r} first={i === 0} last={i === shown.length - 1}
          onMove={d => move(i, d)} onUpdate={p => update(r, p)} run={run} />)}
      </div>
    </div>
  );
}

function RegionRow({ r, first, last, onMove, onUpdate, run }: {
  r: Region; first: boolean; last: boolean; onMove: (d: -1 | 1) => void;
  onUpdate: (p: Record<string, unknown>) => Promise<boolean>;
  run: (p: PromiseLike<{ error: any }>, ok?: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(r.name);
  const [hero, setHero] = useState(r.hero_image_url || '');
  const [city, setCity] = useState('');
  const addCity = async () => {
    const n = city.trim(); if (!n) return;
    if (await run(supabase.from('region_destinations').insert({ region_id: r.id, name: n, sort_order: r.destinations.length + 1 } as any))) setCity('');
  };
  return (
    <div className={`space-y-2 rounded-lg border bg-card p-3 ${r.is_active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col">
          <button disabled={first} onClick={() => onMove(-1)} className="disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button disabled={last} onClick={() => onMove(1)} className="disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
        </div>
        <Input value={name} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && name !== r.name && onUpdate({ name: name.trim() })} className="h-8 flex-1 min-w-[140px] text-sm font-medium" />
        <select value={r.country} onChange={e => onUpdate({ country: e.target.value })} className="h-8 rounded-md border bg-background px-2 text-xs">
          <option value="PT">Portugal</option><option value="ES">Espanha</option>
        </select>
        <div className="flex items-center gap-1 text-xs">
          <Switch checked={r.is_active} onCheckedChange={v => onUpdate({ is_active: v })} />
          {r.is_active ? 'Ativa' : 'Inativa'}
        </div>
      </div>
      <Input value={hero} onChange={e => setHero(e.target.value)} onBlur={() => hero !== (r.hero_image_url || '') && onUpdate({ hero_image_url: hero.trim() || null })} placeholder="Imagem hero (URL, opcional)" className="h-7 text-xs" />
      <div className="flex flex-wrap items-center gap-1">
        {r.destinations.map(d => (
          <Badge key={d.id} variant="secondary" className="gap-1 text-[11px]">
            {d.name}
            <button onClick={() => run(supabase.from('region_destinations').delete().eq('id', d.id))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        <Input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCity()} placeholder="+ cidade" className="h-6 w-28 text-[11px]" />
      </div>
    </div>
  );
}
