import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { mockTrips } from '@/data/mockData';
import { statusConfig, urgencyConfig, budgetLabels } from '@/lib/config';
import { UrgencyLevel } from '@/types';

const urgencyFilters: { label: string; value: UrgencyLevel | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'D-1', value: 'D-1' },
  { label: 'D-3', value: 'D-3' },
  { label: 'D-7', value: 'D-7' },
  { label: 'Future', value: 'future' },
];

const TripsPage = () => {
  const [filter, setFilter] = useState<UrgencyLevel | 'all'>('all');

  const filtered = filter === 'all' ? mockTrips : mockTrips.filter((t) => t.urgency === filter);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Trips</h1>
          <div className="flex gap-1">
            {urgencyFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Client</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Destination</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Dates</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Urgency</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Owner</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Budget</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trip) => (
                <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <Link to={`/trips/${trip.id}`} className="font-medium text-foreground hover:text-info transition-colors">
                      {trip.clientName}
                    </Link>
                    {trip.hasBlocker && (
                      <p className="text-[11px] text-destructive mt-0.5">⚠ {trip.blockerNote}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{trip.destination}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">
                    {trip.startDate} → {trip.endDate}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge {...urgencyConfig[trip.urgency]} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge {...statusConfig[trip.status]} />
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{trip.salesOwner}</td>
                  <td className="py-3 px-4 text-muted-foreground">{budgetLabels[trip.budgetLevel]}</td>
                  <td className="py-3 px-4 text-right font-medium">€{trip.totalValue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default TripsPage;
