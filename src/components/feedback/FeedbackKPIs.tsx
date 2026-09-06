import { TrendingDown, TrendingUp } from 'lucide-react';
import { moduleLabel } from '@/lib/feedbackContext';
import { SEVERITY_LABELS, type FeedbackSeverity } from '@/lib/feedbackConstants';
import type { FeedbackKPIs as KPIs } from '@/hooks/useFeedbackQuery';

const Card = ({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-xl font-semibold">{value}</p>
    {children}
  </div>
);

const FeedbackKPIs = ({ kpis }: { kpis: KPIs }) => {
  const delta = kpis.newThisWeek - kpis.newPrevWeek;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      <Card label="Abertos" value={String(kpis.open)}>
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          {(['blocker', 'high', 'medium', 'low'] as FeedbackSeverity[]).map(s => (
            kpis.openBySeverity[s] ? <span key={s}>{SEVERITY_LABELS[s]}: {kpis.openBySeverity[s]}</span> : null
          ))}
        </div>
      </Card>
      <Card label="Novos (7 dias)" value={String(kpis.newThisWeek)}>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          {delta >= 0 ? <TrendingUp className="h-3 w-3 text-red-600" /> : <TrendingDown className="h-3 w-3 text-emerald-600" />}
          {delta >= 0 ? `+${delta}` : delta} vs semana anterior
        </p>
      </Card>
      <Card label="Tempo médio resolução" value={kpis.avgResolutionDays != null ? `${kpis.avgResolutionDays.toFixed(1)} d` : '—'} />
      <Card label="Tempo médio triagem" value={kpis.avgTriageDays != null ? `${kpis.avgTriageDays.toFixed(1)} d` : '—'} />
      <Card label="Resolvidos este mês" value={String(kpis.resolvedThisMonth)}>
        <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
          {kpis.topModules.map(m => <p key={m.module} className="truncate">{moduleLabel(m.module)}: {m.count}</p>)}
        </div>
      </Card>
    </div>
  );
};

export default FeedbackKPIs;
