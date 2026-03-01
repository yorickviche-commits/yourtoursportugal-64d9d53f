import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ExternalLink, CreditCard, TrendingUp, Plane } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WeTravelTrip {
  id: number;
  name?: string;
  title?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  price?: number;
  travelers_count?: number;
  [key: string]: any;
}

interface WeTravelTransaction {
  id: number;
  amount?: number;
  currency?: string;
  status?: string;
  created_at?: string;
  traveler_name?: string;
  trip_name?: string;
  [key: string]: any;
}

const PaymentsPage = () => {
  const [trips, setTrips] = useState<WeTravelTrip[]>([]);
  const [transactions, setTransactions] = useState<WeTravelTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trips' | 'transactions'>('trips');

  const fetchTrips = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('wetravel-proxy', {
        body: { action: 'list-trips', per_page: 50 },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      // WeTravel may return { trips: [...] } or an array
      const tripList = Array.isArray(data) ? data : (data?.trips || data?.data || []);
      setTrips(tripList);
    } catch (err: any) {
      console.error('WeTravel trips error:', err);
      throw err;
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('wetravel-proxy', {
        body: { action: 'list-transactions', per_page: 50 },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const txList = Array.isArray(data) ? data : (data?.transactions || data?.data || []);
      setTransactions(txList);
    } catch (err: any) {
      console.error('WeTravel transactions error:', err);
      throw err;
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchTrips(), fetchTransactions()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do WeTravel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const totalRevenue = transactions.reduce((sum, t) => {
    const amount = t.amount || t.total || 0;
    return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
  }, 0);

  const getStatusColor = (status?: string) => {
    if (!status) return 'secondary';
    const s = status.toLowerCase();
    if (s.includes('paid') || s.includes('complete') || s.includes('success')) return 'default';
    if (s.includes('pending') || s.includes('partial')) return 'outline';
    if (s.includes('fail') || s.includes('cancel') || s.includes('refund')) return 'destructive';
    return 'secondary';
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pagamentos (WeTravel)</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Dados em tempo real do WeTravel</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
            </Button>
            <a href="https://www.wetravel.com" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir WeTravel
              </Button>
            </a>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
            <Button variant="link" size="sm" onClick={() => { setError(null); fetchAll(); }}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Plane className="h-3.5 w-3.5" />
                <span className="text-xs">Viagens</span>
              </div>
              {loading ? <Skeleton className="h-6 w-12" /> : (
                <p className="text-lg font-bold">{trips.length}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="text-xs">Transações</span>
              </div>
              {loading ? <Skeleton className="h-6 w-12" /> : (
                <p className="text-lg font-bold">{transactions.length}</p>
              )}
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs">Receita Total</span>
              </div>
              {loading ? <Skeleton className="h-6 w-24" /> : (
                <p className="text-lg font-bold">
                  €{totalRevenue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-1">
          <Button
            variant={activeTab === 'trips' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('trips')}
          >
            <Plane className="h-3 w-3 mr-1" /> Viagens ({trips.length})
          </Button>
          <Button
            variant={activeTab === 'transactions' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('transactions')}
          >
            <CreditCard className="h-3 w-3 mr-1" /> Transações ({transactions.length})
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : activeTab === 'trips' ? (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {trips.map(trip => (
              <Card key={trip.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{trip.name || trip.title || `Trip #${trip.id}`}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {trip.status && <Badge variant={getStatusColor(trip.status)} className="text-[10px]">{trip.status}</Badge>}
                    {trip.price && (
                      <span className="text-xs text-muted-foreground">
                        {trip.currency || '€'}{trip.price}
                      </span>
                    )}
                  </div>
                  {trip.start_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(trip.start_date).toLocaleDateString('pt-PT')}
                      {trip.end_date && ` — ${new Date(trip.end_date).toLocaleDateString('pt-PT')}`}
                    </p>
                  )}
                  {trip.travelers_count != null && (
                    <p className="text-xs text-muted-foreground">
                      {trip.travelers_count} viajante(s)
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
            {trips.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">Nenhuma viagem encontrada</p>
            )}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {transactions.map(tx => (
              <Card key={tx.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">
                      {tx.traveler_name || tx.trip_name || `#${tx.id}`}
                    </p>
                    <Badge variant={getStatusColor(tx.status)} className="text-[10px]">
                      {tx.status || 'N/A'}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold mt-1">
                    {tx.currency || '€'}{(tx.amount || tx.total || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </p>
                  {tx.created_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString('pt-PT')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">Nenhuma transação encontrada</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PaymentsPage;
