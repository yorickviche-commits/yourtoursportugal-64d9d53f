import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BUSINESS_CONFIG } from '@/lib/businessConfig';
import type { OpsRow } from '@/components/leads/opsConstants';

const eur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  rows: OpsRow[];
  pvpTotal: number;
  dayTitles?: Record<number, string>;
}

const KPI = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' }) => (
  <Card className="p-3">
    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
    <p className={cn('text-lg font-bold mt-0.5',
      tone === 'good' && 'text-[hsl(var(--success))]',
      tone === 'bad' && 'text-destructive',
      tone === 'warn' && 'text-[hsl(var(--warning))]',
    )}>{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
  </Card>
);

export default function LeadOpsAnalyticsPanel({ rows, pvpTotal, dayTitles = {} }: Props) {
  const [open, setOpen] = useState(false);

  const m = useMemo(() => {
    const net = rows.reduce((s, r) => s + (r.netValue || 0), 0);
    // Custo real: usa o real quando preenchido, senão assume o NET previsto.
    const real = rows.reduce((s, r) => s + (r.realCost ?? r.netValue ?? 0), 0);
    const filled = rows.filter(r => r.realCost != null).length;
    const deviation = real - net;
    // Se não havia NET previsto (linhas extra não orçamentadas), qualquer custo
    // real é 100% de desvio — não 0%.
    const deviationPct = net > 0 ? (deviation / net) * 100 : (real > 0 ? 100 : 0);
    const plannedMargin = pvpTotal - net;
    const realMargin = pvpTotal - real;
    const plannedMarginPct = pvpTotal > 0 ? (plannedMargin / pvpTotal) * 100 : 0;
    const realMarginPct = pvpTotal > 0 ? (realMargin / pvpTotal) * 100 : 0;

    const dayMap = new Map<number, { day: number; net: number; real: number }>();
    rows.forEach(r => {
      const e = dayMap.get(r.dayNumber) || { day: r.dayNumber, net: 0, real: 0 };
      e.net += r.netValue || 0;
      e.real += r.realCost ?? r.netValue ?? 0;
      dayMap.set(r.dayNumber, e);
    });
    const byDay = Array.from(dayMap.values())
      .sort((a, b) => a.day - b.day)
      .map(d => ({ name: `D${d.day}`, label: dayTitles[d.day] || `Dia ${d.day}`, NET: Math.round(d.net), Real: Math.round(d.real) }));

    const supMap = new Map<string, number>();
    rows.forEach(r => {
      const key = (r.supplier || '(sem FSE)').trim() || '(sem FSE)';
      const dev = (r.realCost ?? r.netValue ?? 0) - (r.netValue || 0);
      supMap.set(key, (supMap.get(key) || 0) + dev);
    });
    const bySupplier = Array.from(supMap.entries())
      .map(([name, dev]) => ({ name: name.length > 22 ? `${name.slice(0, 21)}…` : name, Desvio: Math.round(dev) }))
      .filter(s => s.Desvio !== 0)
      .sort((a, b) => Math.abs(b.Desvio) - Math.abs(a.Desvio))
      .slice(0, 10);

    const marginCompare = [
      { name: 'Prevista', Margem: Math.round(plannedMargin) },
      { name: 'Real', Margem: Math.round(realMargin) },
    ];

    return {
      net, real, filled, deviation, deviationPct, plannedMargin, realMargin,
      plannedMarginPct, realMarginPct, byDay, bySupplier, marginCompare,
    };
  }, [rows, pvpTotal, dayTitles]);

  // Sem PVP definido não há margem calculável — evita mostrar 0% a vermelho.
  const hasPvp = pvpTotal > 0;
  const marginTone = (pct: number): 'good' | 'warn' | 'bad' =>
    !hasPvp ? 'warn'
      : pct > BUSINESS_CONFIG.DEFAULT_MARGIN_PERCENT ? 'good'
        : pct >= 25 ? 'warn' : 'bad';

  const marginAlert = !hasPvp ? 'PVP não definido — margem indisponível'
    : m.realMarginPct > BUSINESS_CONFIG.DEFAULT_MARGIN_PERCENT ? 'Margem saudável (> 30%)'
      : m.realMarginPct >= 25 ? 'Aviso: margem entre 25% e 30%'
        : 'Risco: margem abaixo de 25%';

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger className="w-full border rounded-lg px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center gap-3 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-semibold">Análise de Custos &amp; Margem</span>
        <div className="ml-auto flex items-center gap-4 text-[11px] flex-wrap justify-end">
          <span className={cn('flex items-center gap-1 font-medium',
            m.deviation > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]')}>
            {m.deviation > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            Desvio {eur(m.deviation)} ({m.deviationPct.toFixed(1)}%)
          </span>
          <span className={cn('font-medium',
            marginTone(m.realMarginPct) === 'good' ? 'text-[hsl(var(--success))]'
              : marginTone(m.realMarginPct) === 'warn' ? 'text-[hsl(var(--warning))]' : 'text-destructive')}>
            Margem real {m.realMarginPct.toFixed(1)}%
          </span>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border border-t-0 rounded-b-lg p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="NET previsto" value={eur(m.net)} hint="Custos do Costing" />
            <KPI label="Custo real" value={eur(m.real)} hint={`${m.filled}/${rows.length} linhas confirmadas`} />
            <KPI label="Desvio" value={`${eur(m.deviation)} (${m.deviationPct.toFixed(1)}%)`}
              tone={m.deviation > 0 ? 'bad' : 'good'} />
            <KPI label="PVP" value={eur(pvpTotal)} hint="Total do Costing" />
            <KPI label="Margem prevista" value={eur(m.plannedMargin)} hint={`${m.plannedMarginPct.toFixed(1)}%`}
              tone={marginTone(m.plannedMarginPct)} />
            <KPI label="Margem real" value={eur(m.realMargin)} hint={`${m.realMarginPct.toFixed(1)}%`}
              tone={marginTone(m.realMarginPct)} />
            <KPI label="Cobertura de custos" value={`${rows.length ? Math.round((m.filled / rows.length) * 100) : 0}%`}
              hint={`${m.filled} de ${rows.length} itens`} />
            <KPI label="Estado da margem" value={marginAlert.split(':')[0]} hint={marginAlert}
              tone={marginTone(m.realMarginPct)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-3">
              <p className="text-[11px] font-semibold mb-2">NET vs Custo Real por dia</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.byDay} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => eur(Number(v))}
                      labelFormatter={(l: any) => m.byDay.find(d => d.name === l)?.label || l} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="NET" fill="hsl(var(--info))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Real" fill="hsl(var(--warning))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-3">
              <p className="text-[11px] font-semibold mb-2">Desvio por FSE / fornecedor</p>
              <div className="h-52">
                {m.bySupplier.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
                    Sem desvios registados — preenche a coluna Custo Real.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.bySupplier} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v: any) => eur(Number(v))} />
                      <Bar dataKey="Desvio" radius={[0, 2, 2, 0]}>
                        {m.bySupplier.map((s, i) => (
                          <Cell key={i} fill={s.Desvio > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-3 lg:col-span-2">
              <p className="text-[11px] font-semibold mb-2">Margem prevista vs real</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.marginCompare} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => eur(Number(v))} />
                    <Bar dataKey="Margem" radius={[2, 2, 0, 0]}>
                      {m.marginCompare.map((d, i) => (
                        <Cell key={i} fill={i === 0 ? 'hsl(var(--info))' : (m.realMargin < m.plannedMargin ? 'hsl(var(--warning))' : 'hsl(var(--success))')} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Valores calculados a partir do conteúdo atual da tabela (inclui alterações ainda não gravadas).
            Linhas sem Custo Real assumem o NET previsto.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
