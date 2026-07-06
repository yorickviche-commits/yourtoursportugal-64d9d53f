import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { urgencyConfig, budgetLabels } from '@/lib/config';
import { UrgencyLevel } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const urgencyFilters: { label: string; value: UrgencyLevel | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'D-1', value: 'D-1' },
  { label: 'D-3', value: 'D-3' },
  { label: 'D-7', value: 'D-7' },
  { label: 'Futuro', value: 'future' },
];

interface WonLead {
  id: string;
  lead_code: string;
  yt_id: string | null;
  client_name: string;
  destination: string;
  travel_dates: string | null;
  travel_end_date: string | null;
  status: string;
  sales_owner: string | null;
  budget_level: string | null;
  pax: number | null;
}

const computeUrgency = (start: string | null): UrgencyLevel | 'future' => {
  if (!start) return 'future';
  const d = new Date(start);
  if (isNaN(d.getTime())) return 'future';
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 1) return 'D-1';
  if (days <= 3) return 'D-3';
  if (days <= 7) return 'D-7';
  return 'future';
};

const TripsPage = () => {
  const [filter, setFilter] = useState<UrgencyLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [budgetFilter, setBudgetFilter] = useState<string>('all');
  const isMobile = useIsMobile();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', 'won'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, lead_code, yt_id, client_name, destination, travel_dates, travel_end_date, status, sales_owner, budget_level, pax')
        .eq('status', 'won')
        .order('travel_dates', { ascending: true });
      if (error) throw error;
      return data as WonLead[];
    },
  });

  const owners = useMemo(() => Array.from(new Set(leads.map(l => l.sales_owner).filter(Boolean))) as string[], [leads]);
  const budgets = useMemo(() => Array.from(new Set(leads.map(l => l.budget_level).filter(Boolean))) as string[], [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      const urgency = computeUrgency(l.travel_dates);
      if (filter !== 'all' && urgency !== filter) return false;
      if (ownerFilter !== 'all' && l.sales_owner !== ownerFilter) return false;
      if (budgetFilter !== 'all' && l.budget_level !== budgetFilter) return false;
      if (q) {
        const hay = `${l.client_name} ${l.destination} ${l.lead_code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, filter, ownerFilter, budgetFilter, search]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold">Reservas Confirmadas</h1>
          <div className="flex gap-1 flex-wrap">
            {urgencyFilters.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
                )}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Search + filters bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por cliente, destino ou ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            className="h-9 px-3 rounded-md border bg-background text-sm"
          >
            <option value="all">Todos os owners</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={budgetFilter}
            onChange={e => setBudgetFilter(e.target.value)}
            className="h-9 px-3 rounded-md border bg-background text-sm"
          >
            <option value="all">Todos os budgets</option>
            {budgets.map(b => <option key={b} value={b}>{budgetLabels[b as keyof typeof budgetLabels] || b}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {filtered.map(lead => {
              const urgency = computeUrgency(lead.travel_dates);
              return (
                <Link key={lead.id} to={`/bookings/${lead.id}`} className="block bg-card rounded-lg border p-4 hover:bg-muted/30 transition-colors active:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{lead.client_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.destination} · {lead.pax || 0} pax · {lead.lead_code}</p>
                    </div>
                    <StatusBadge {...(urgencyConfig[urgency as keyof typeof urgencyConfig] || urgencyConfig['future'])} />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">{lead.travel_dates || '—'}</span>
                    <span className="text-xs font-medium">{budgetLabels[lead.budget_level as keyof typeof budgetLabels] || lead.budget_level || '—'}</span>
                  </div>
                </Link>
              );
            })}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem reservas encontradas</p>}
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Destino</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Datas</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Urgência</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Owner</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Budget</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Pax</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const urgency = computeUrgency(lead.travel_dates);
                  return (
                    <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{lead.lead_code}</td>
                      <td className="py-3 px-4">
                        <Link to={`/bookings/${lead.id}`} className="font-medium text-foreground hover:text-[hsl(var(--info))] transition-colors">{lead.client_name}</Link>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{lead.destination}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{lead.travel_dates || '—'}{lead.travel_end_date ? ` → ${lead.travel_end_date}` : ''}</td>
                      <td className="py-3 px-4"><StatusBadge {...(urgencyConfig[urgency as keyof typeof urgencyConfig] || urgencyConfig['future'])} /></td>
                      <td className="py-3 px-4 text-muted-foreground">{lead.sales_owner || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{budgetLabels[lead.budget_level as keyof typeof budgetLabels] || lead.budget_level || '—'}</td>
                      <td className="py-3 px-4 text-right font-medium">{lead.pax || 0}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Sem reservas encontradas</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TripsPage;
