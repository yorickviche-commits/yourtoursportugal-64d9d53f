import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';

export interface CostingActivity {
  id: string;
  name: string;
  supplier: string | null;
  perPersonOrTotal: 'TOTAL' | 'POR PESSOA';
  numAdults: number;
  numYouth: number;
  priceAdults: number;
  priceYouth: number;
  netTotal: number;
  marginPercent: number;
  pvpTotal: number;
  profit: number;
}

export interface CostingDay {
  day: number;
  date: string;
  title: string;
  activities: CostingActivity[];
}

interface CostingTableProps {
  days: CostingDay[];
}

const CostingTable = ({ days }: CostingTableProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>(days.map(d => d.day));

  const toggleDay = (day: number) => {
    setExpandedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const getDayTotals = (activities: CostingActivity[]) => {
    const net = activities.reduce((sum, a) => sum + a.netTotal, 0);
    const pvp = activities.reduce((sum, a) => sum + a.pvpTotal, 0);
    const profit = activities.reduce((sum, a) => sum + a.profit, 0);
    const margin = pvp > 0 ? (profit / pvp) * 100 : 0;
    return { net, pvp, profit, margin };
  };

  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold">Costing / Budget</h2>
      </div>
      <div className="divide-y">
        {days.map((day) => {
          const expanded = expandedDays.includes(day.day);
          const totals = getDayTotals(day.activities);
          return (
            <div key={day.day}>
              {/* Day header */}
              <button
                onClick={() => toggleDay(day.day)}
                className="w-full flex items-center gap-3 p-3 px-4 hover:bg-muted/30 transition-colors text-left"
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <span className="text-xs text-info font-medium">Dia {day.day}.</span>
                  <p className="text-sm font-semibold text-info">
                    Day {day.day} | {day.date}: {day.title}
                  </p>
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4">
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-2 bg-muted/40 rounded-t-md border border-b-0">
                    <div className="col-span-3">Despesas</div>
                    <div className="col-span-1">Fornecedor</div>
                    <div className="col-span-1">P/T</div>
                    <div className="col-span-1 text-right">Nº Ad.</div>
                    <div className="col-span-1 text-right">Nº Jov.</div>
                    <div className="col-span-1 text-right">NET Total</div>
                    <div className="col-span-1 text-right">Margem</div>
                    <div className="col-span-1 text-right">PVP Total</div>
                    <div className="col-span-1 text-right">Lucro €</div>
                  </div>

                  {/* Activity rows */}
                  <div className="border border-t-0 rounded-b-md divide-y">
                    {day.activities.map((act) => (
                      <div key={act.id} className="grid grid-cols-12 gap-1 px-2 py-2.5 text-xs items-center hover:bg-muted/20 transition-colors">
                        <div className="col-span-3 font-medium truncate">{act.name}</div>
                        <div className="col-span-1 text-muted-foreground truncate">{act.supplier || '—'}</div>
                        <div className="col-span-1">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            {act.perPersonOrTotal === 'TOTAL' ? 'TOT' : 'PP'}
                          </span>
                        </div>
                        <div className="col-span-1 text-right">{act.numAdults}</div>
                        <div className="col-span-1 text-right">{act.numYouth}</div>
                        <div className="col-span-1 text-right font-medium">€{act.netTotal}</div>
                        <div className="col-span-1 text-right">{act.marginPercent}%</div>
                        <div className="col-span-1 text-right font-medium">€{act.pvpTotal.toFixed(1)}</div>
                        <div className="col-span-1 text-right text-success font-medium">€{act.profit.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Day totals */}
                  <div className="flex items-center justify-center gap-8 mt-3 text-xs">
                    <div className="text-center">
                      <p className="text-muted-foreground font-medium">NET</p>
                      <p className="font-bold">{totals.net} €</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground font-medium">MARGEM</p>
                      <p className="font-bold">{totals.margin.toFixed(0)} %</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground font-medium">LUCRO</p>
                      <p className="font-bold text-success">{totals.profit.toFixed(1)} €</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground font-medium">TOTAL</p>
                      <p className="font-bold">{totals.pvp.toFixed(1)} €</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CostingTable;
