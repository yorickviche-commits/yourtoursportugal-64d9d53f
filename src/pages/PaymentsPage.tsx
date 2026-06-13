import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw, ExternalLink, CreditCard, TrendingUp, Plane,
  AlertCircle, CheckCircle2, Clock, CalendarClock, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface WeTravelTrip {
  id: number | string;
  uuid?: string;
  name?: string;
  title?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  price?: number;
  total_paid?: number;
  total_due?: number;
  travelers_count?: number;
  [key: string]: any;
}

interface WeTravelTransaction {
  id: number | string;
  trip_id?: number | string;
  trip_uuid?: string;
  amount?: number;
  currency?: string;
  status?: string;
  created_at?: string;
  due_date?: string;
  traveler_name?: string;
  trip_name?: string;
  [key: string]: any;
}

const wtAdminUrl = (t: { uuid?: string; id?: number | string }) =>
  `https://admin.wetravel.com/trips/${t.uuid || t.id}`;

const wtTransactionUrl = (tx: WeTravelTransaction) =>
  tx.trip_uuid || tx.trip_id
    ? `https://admin.wetravel.com/trips/${tx.trip_uuid || tx.trip_id}/transactions`
    : 'https://admin.wetravel.com/transactions';

const parseAmount = (a: any) => (typeof a === 'number' ? a : parseFloat(a) || 0);

const fmt = (n: number, ccy = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: ccy }).format(n);

const classifyStatus = (s?: string) => {
  if (!s) return 'unknown';
  const x = s.toLowerCase();
  if (x.includes('paid') || x.includes('complete') || x.includes('success')) return 'paid';
  if (x.includes('pending') || x.includes('partial') || x.includes('due')) return 'pending';
  if (x.includes('fail') || x.includes('cancel') || x.includes('refund')) return 'failed';
  return 'other';
};

const PaymentsPage = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<WeTravelTrip[]>([]);
  const [transactions, setTransactions] = useState<WeTravelTransaction[]>([]);
  const [tripToLead, setTripToLead] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'pending' | 'paid' | 'trips'>('upcoming');

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripsRes, txRes, mapRes] = await Promise.all([
        supabase.functions.invoke('wetravel-proxy', { body: { action: 'list-trips', per_page: 100 } }),
        supabase.functions.invoke('wetravel-proxy', { body: { action: 'list-transactions', per_page: 100 } }),
        supabase.from('proposals').select('lead_id, wetravel_trip_uuid').not('wetravel_trip_uuid', 'is', null),
      ]);
      if (tripsRes.error) throw tripsRes.error;
      if (tripsRes.data?.error) throw new Error(tripsRes.data.error);
      if (txRes.error) throw txRes.error;
      if (txRes.data?.error) throw new Error(txRes.data.error);

      const tList = Array.isArray(tripsRes.data) ? tripsRes.data : (tripsRes.data?.trips || tripsRes.data?.data || []);
      const xList = Array.isArray(txRes.data) ? txRes.data : (txRes.data?.transactions || txRes.data?.data || []);
      setTrips(tList);
      setTransactions(xList);

      const map: Record<string, string> = {};
      (mapRes.data || []).forEach((p: any) => {
        if (p.wetravel_trip_uuid && p.lead_id) map[String(p.wetravel_trip_uuid)] = p.lead_id;
      });
      setTripToLead(map);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do WeTravel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const stats = useMemo(() => {
    let totalPaid = 0, totalPending = 0, totalDue = 0;
    let cPaid = 0, cPending = 0, cUpcoming = 0;
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
    transactions.forEach(tx => {
      const amt = parseAmount(tx.amount ?? tx.total);
      const cls = classifyStatus(tx.status);
      if (cls === 'paid') { totalPaid += amt; cPaid++; }
      else if (cls === 'pending') {
        totalPending += amt; cPending++;
        const due = tx.due_date ? new Date(tx.due_date).getTime() : null;
        if (due && due <= sevenDays) { totalDue += amt; cUpcoming++; }
      }
    });
    return { totalPaid, totalPending, totalDue, cPaid, cPending, cUpcoming };
  }, [transactions]);

  const filteredTx = useMemo(() => {
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
    return transactions
      .filter(tx => {
        const cls = classifyStatus(tx.status);
        if (tab === 'paid') return cls === 'paid';
        if (tab === 'pending') return cls === 'pending';
        if (tab === 'upcoming') {
          const due = tx.due_date ? new Date(tx.due_date).getTime() : null;
          return cls === 'pending' && due && due <= sevenDays;
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const db_ = b.due_date ? new Date(b.due_date).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return da - db_;
      });
  }, [transactions, tab]);

  const findLeadId = (tripIdOrUuid?: string | number) => tripIdOrUuid ? tripToLead[String(tripIdOrUuid)] : undefined;

  const StatCard = ({ icon: Icon, label, value, sub, tone }: any) => (
    <Card className={cn('border', tone === 'red' && 'border-red-200', tone === 'amber' && 'border-amber-200', tone === 'green' && 'border-emerald-200')}>
      <CardContent className="p-3">
        <div className={cn('flex items-center gap-2 text-xs mb-1',
          tone === 'red' && 'text-red-600',
          tone === 'amber' && 'text-amber-600',
          tone === 'green' && 'text-emerald-600',
          !tone && 'text-muted-foreground')}>
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        {loading ? <Skeleton className="h-6 w-20" /> : (
          <>
            <p className="text-lg font-bold leading-tight">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pagamentos (WeTravel)</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Resumo em tempo real · {transactions.length} transações</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={cn('h-3 w-3 mr-1', loading && 'animate-spin')} /> Atualizar
            </Button>
            <a href="https://admin.wetravel.com" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir WeTravel
              </Button>
            </a>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>{error}</p>
              <Button variant="link" size="sm" className="h-auto p-0 mt-1" onClick={() => { setError(null); fetchAll(); }}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={CheckCircle2} label="Pago" value={fmt(stats.totalPaid)} sub={`${stats.cPaid} transações`} tone="green" />
          <StatCard icon={Clock} label="Pendente" value={fmt(stats.totalPending)} sub={`${stats.cPending} transações`} tone="amber" />
          <StatCard icon={CalendarClock} label="Vence ≤ 7 dias" value={fmt(stats.totalDue)} sub={`${stats.cUpcoming} próximos`} tone="red" />
          <StatCard icon={Plane} label="Viagens" value={trips.length} sub={`${transactions.length} transações`} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {[
            { id: 'upcoming', label: `Vence em breve (${stats.cUpcoming})`, icon: CalendarClock },
            { id: 'pending', label: `Pendentes (${stats.cPending})`, icon: Clock },
            { id: 'paid', label: `Pagos (${stats.cPaid})`, icon: CheckCircle2 },
            { id: 'trips', label: `Viagens (${trips.length})`, icon: Plane },
          ].map((t: any) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-2 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : tab === 'trips' ? (
          <div className="grid gap-2 md:grid-cols-2">
            {trips.map(trip => {
              const leadId = findLeadId(trip.uuid || trip.id);
              const paid = parseAmount(trip.total_paid);
              const price = parseAmount(trip.price);
              return (
                <Card key={trip.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{trip.name || trip.title || `Trip #${trip.id}`}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {trip.start_date && <span>{new Date(trip.start_date).toLocaleDateString('pt-PT')}</span>}
                          {trip.travelers_count != null && <span>· {trip.travelers_count} pax</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{fmt(price, trip.currency || 'EUR')}</p>
                        {paid > 0 && <p className="text-[10px] text-emerald-600">Pago {fmt(paid, trip.currency || 'EUR')}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm" className="flex-1 h-8 text-xs"
                        disabled={!leadId}
                        onClick={() => leadId && navigate(`/leads/${leadId}`)}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" /> {leadId ? 'Abrir lead' : 'Sem lead'}
                      </Button>
                      <a href={wtAdminUrl(trip)} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="default" size="sm" className="w-full h-8 text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" /> Ver em WeTravel
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {trips.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhuma viagem encontrada</p>}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {filteredTx.map(tx => {
              const leadId = findLeadId(tx.trip_uuid || tx.trip_id);
              const cls = classifyStatus(tx.status);
              return (
                <Card key={tx.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {tx.traveler_name || tx.trip_name || `Transação #${tx.id}`}
                        </p>
                        {tx.trip_name && tx.traveler_name && (
                          <p className="text-xs text-muted-foreground truncate">{tx.trip_name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] h-5',
                              cls === 'paid' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                              cls === 'pending' && 'bg-amber-50 text-amber-700 border-amber-200',
                              cls === 'failed' && 'bg-red-50 text-red-700 border-red-200',
                            )}
                          >
                            {tx.status || 'N/A'}
                          </Badge>
                          {tx.due_date && (
                            <span className="text-[10px] text-muted-foreground">
                              Vence {new Date(tx.due_date).toLocaleDateString('pt-PT')}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-base font-bold shrink-0">
                        {fmt(parseAmount(tx.amount ?? tx.total), tx.currency || 'EUR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm" className="flex-1 h-8 text-xs"
                        disabled={!leadId}
                        onClick={() => leadId && navigate(`/leads/${leadId}`)}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" /> {leadId ? 'Abrir lead' : 'Sem lead'}
                      </Button>
                      <a href={wtTransactionUrl(tx)} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button variant="default" size="sm" className="w-full h-8 text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" /> Ver em WeTravel
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredTx.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
                Sem transações nesta vista
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PaymentsPage;
