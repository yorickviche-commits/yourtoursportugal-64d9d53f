import { Card } from '@/components/ui/card';
import { UserKPIs } from '@/hooks/useUserKPIs';

const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function KPICards({ k }: { k: UserKPIs }) {
  const cards = [
    { label: 'Propostas Enviadas', value: k.proposalsSent },
    { label: 'Ganhas', value: k.proposalsWon, cls: 'text-green-600' },
    { label: 'Perdidas', value: k.proposalsLost, cls: 'text-destructive' },
    { label: 'Em Espera', value: k.proposalsPending, cls: 'text-amber-600' },
    { label: 'Volume Total', value: fmt(k.totalVolume) },
    { label: 'Volume Confirmado', value: fmt(k.confirmedVolume), cls: 'text-green-600' },
    { label: 'Margem Média', value: `${k.avgMargin.toFixed(1)}%` },
    { label: 'Taxa Conversão', value: `${k.conversionRate.toFixed(1)}%` },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{c.label}</p>
          <p className={`text-xl font-bold mt-1 ${c.cls || ''}`}>{c.value}</p>
        </Card>
      ))}
    </div>
  );
}
