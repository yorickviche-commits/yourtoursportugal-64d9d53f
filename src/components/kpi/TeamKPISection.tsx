import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTeamKPIs, KPIFilters } from '@/hooks/useUserKPIs';
import KPIFiltersBar from '@/components/kpi/KPIFilters';
import { exportPDF, exportExcel } from '@/lib/kpiExport';
import { FileDown, ArrowUpDown } from 'lucide-react';

const fmtEur = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

type SortKey = 'name' | 'sent' | 'won' | 'lost' | 'pending' | 'total' | 'confirmed' | 'margin' | 'conv';

export default function TeamKPISection() {
  const [filters, setFilters] = useState<KPIFilters>({});
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sent');
  const [asc, setAsc] = useState(false);
  const { data = [] } = useTeamKPIs(filters);

  const rows = useMemo(() => {
    const filtered = data.filter((r: any) => !search ||
      ((r.user.full_name || '') + ' ' + (r.user.email || '')).toLowerCase().includes(search.toLowerCase()));
    const key = sortKey;
    const val = (r: any) => ({
      name: r.user.full_name || r.user.email || '',
      sent: r.kpis.proposalsSent, won: r.kpis.proposalsWon, lost: r.kpis.proposalsLost, pending: r.kpis.proposalsPending,
      total: r.kpis.totalVolume, confirmed: r.kpis.confirmedVolume, margin: r.kpis.avgMargin, conv: r.kpis.conversionRate,
    }[key]);
    return [...filtered].sort((a: any, b: any) => {
      const va = val(a), vb = val(b);
      if (typeof va === 'string') return asc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [data, search, sortKey, asc]);

  const doExport = (kind: 'pdf' | 'excel') => {
    const headers = ['Agente', 'Enviadas', 'Ganhas', 'Perdidas', 'Em Espera', 'Volume Total', 'Volume Confirmado', 'Margem %', 'Conversão %'];
    const body = rows.map((r: any) => [
      r.user.full_name || r.user.email, r.kpis.proposalsSent, r.kpis.proposalsWon, r.kpis.proposalsLost, r.kpis.proposalsPending,
      fmtEur(r.kpis.totalVolume), fmtEur(r.kpis.confirmedVolume), r.kpis.avgMargin.toFixed(1), r.kpis.conversionRate.toFixed(1),
    ]);
    const fname = `kpis_equipa_${new Date().toISOString().slice(0, 10)}`;
    if (kind === 'pdf') exportPDF('KPIs Equipa', headers, body, fname); else exportExcel('KPIs Equipa', headers, body, fname);
  };

  const th = (k: SortKey, label: string) => (
    <th className="text-left p-2 cursor-pointer select-none" onClick={() => { if (sortKey === k) setAsc(!asc); else { setSortKey(k); setAsc(false); } }}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 opacity-50" /></span>
    </th>
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">KPIs Equipa</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => doExport('pdf')}><FileDown className="h-3 w-3 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={() => doExport('excel')}><FileDown className="h-3 w-3 mr-1" />Excel</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <KPIFiltersBar value={filters} onChange={setFilters} />
        <Input placeholder="Pesquisar agente..." className="h-8 text-xs w-48" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {th('name', 'Agente')}{th('sent', 'Enviadas')}{th('won', 'Ganhas')}{th('lost', 'Perdidas')}{th('pending', 'Espera')}
              {th('total', 'Vol. Total')}{th('confirmed', 'Vol. Conf.')}{th('margin', 'Margem')}{th('conv', 'Conv.')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.user.id} className="border-t border-border hover:bg-muted/50">
                <td className="p-2"><Link to={`/profile/${r.user.id}`} className="text-primary hover:underline">{r.user.full_name || r.user.email}</Link></td>
                <td className="p-2">{r.kpis.proposalsSent}</td>
                <td className="p-2 text-green-600">{r.kpis.proposalsWon}</td>
                <td className="p-2 text-destructive">{r.kpis.proposalsLost}</td>
                <td className="p-2 text-amber-600">{r.kpis.proposalsPending}</td>
                <td className="p-2">{fmtEur(r.kpis.totalVolume)}</td>
                <td className="p-2 text-green-600">{fmtEur(r.kpis.confirmedVolume)}</td>
                <td className="p-2">{r.kpis.avgMargin.toFixed(1)}%</td>
                <td className="p-2">{r.kpis.conversionRate.toFixed(1)}%</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Sem dados</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
