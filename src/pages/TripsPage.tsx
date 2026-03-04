import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { statusConfig, urgencyConfig, budgetLabels } from '@/lib/config';
import { UrgencyLevel } from '@/types';
import { useTripsQuery } from '@/hooks/useTripsQuery';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const urgencyFilters: { label: string; value: UrgencyLevel | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'D-1', value: 'D-1' },
  { label: 'D-3', value: 'D-3' },
  { label: 'D-7', value: 'D-7' },
  { label: 'Futuro', value: 'future' },
];

const TripsPage = () => {
  const [filter, setFilter] = useState<UrgencyLevel | 'all'>('all');
  const { data: trips = [], isLoading } = useTripsQuery();
  const isMobile = useIsMobile();

  const filtered = filter === 'all' ? trips : trips.filter(t => t.urgency === filter);

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

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : isMobile ? (
          /* Mobile: Card view */
          <div className="space-y-3">
            {filtered.map(trip => (
              <Link key={trip.id} to={`/trips/${trip.id}`} className="block bg-card rounded-lg border p-4 hover:bg-muted/30 transition-colors active:bg-muted/50">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{trip.client_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{trip.destination} · {trip.pax} pax</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <StatusBadge {...(urgencyConfig[trip.urgency as keyof typeof urgencyConfig] || urgencyConfig['future'])} />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge {...(statusConfig[trip.status as keyof typeof statusConfig] || statusConfig['draft'])} />
                    <span className="text-xs text-muted-foreground">{trip.start_date}</span>
                  </div>
                  <span className="text-sm font-bold">€{(trip.total_value || 0).toLocaleString()}</span>
                </div>
                {trip.has_blocker && (
                  <p className="text-[11px] text-destructive mt-2">⚠ {trip.blocker_note}</p>
                )}
              </Link>
            ))}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem viagens encontradas</p>}
          </div>
        ) : (
          /* Desktop: Table view */
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Destino</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Datas</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Urgência</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Owner</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Budget</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(trip => (
                  <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/trips/${trip.id}`} className="font-medium text-foreground hover:text-[hsl(var(--info))] transition-colors">{trip.client_name}</Link>
                      {trip.has_blocker && <p className="text-[11px] text-destructive mt-0.5">⚠ {trip.blocker_note}</p>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{trip.destination}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{trip.start_date} → {trip.end_date}</td>
                    <td className="py-3 px-4"><StatusBadge {...(urgencyConfig[trip.urgency as keyof typeof urgencyConfig] || urgencyConfig['future'])} /></td>
                    <td className="py-3 px-4"><StatusBadge {...(statusConfig[trip.status as keyof typeof statusConfig] || statusConfig['draft'])} /></td>
                    <td className="py-3 px-4 text-muted-foreground">{trip.sales_owner}</td>
                    <td className="py-3 px-4 text-muted-foreground">{budgetLabels[trip.budget_level as keyof typeof budgetLabels] || trip.budget_level}</td>
                    <td className="py-3 px-4 text-right font-medium">€{(trip.total_value || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Sem viagens encontradas</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TripsPage;
