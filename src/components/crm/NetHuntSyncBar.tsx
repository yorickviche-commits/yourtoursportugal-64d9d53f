import { useState } from 'react';
import { RefreshCw, Loader2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useSyncNow, useSyncState, SYNC_PERIODS, type SyncPeriod } from '@/hooks/useNetHunt';

/**
 * Manual NetHunt sync control: pick a period, sync once, and keep the data
 * until the next manual sync (there is no automatic polling).
 */
export default function NetHuntSyncBar({ onDone }: { onDone?: () => void }) {
  const [period, setPeriod] = useState<SyncPeriod>('7d');
  const syncNow = useSyncNow();
  const state = useSyncState();

  const run = async () => {
    try {
      const res = await syncNow.mutateAsync({ period });
      const counts = res?.timeline?.counts ?? {};
      const events = Object.values(counts).reduce((n: number, v: any) => n + Number(v || 0), 0);
      toast({
        title: 'Sincronização concluída',
        description: `${res?.deals ?? 0} leads · ${res?.tasks ?? 0} tasks · ${events} eventos de timeline`,
      });
      state.refetch();
      onDone?.();
    } catch (e: any) {
      toast({ title: 'Falha na sincronização', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="text-xs font-semibold">Sincronização NetHunt</span>
      <Select value={period} onValueChange={(v) => setPeriod(v as SyncPeriod)}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SYNC_PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" className="text-xs" onClick={run} disabled={syncNow.isPending}>
        {syncNow.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
        Sincronizar
      </Button>
      <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {state.data?.at
          ? `Última sincronização ${formatDistanceToNow(new Date(state.data.at), { addSuffix: true, locale: pt })}${
              state.data.period ? ` · ${SYNC_PERIODS.find((p) => p.value === state.data!.period)?.label}` : ''
            }`
          : 'Ainda sem sincronização manual'}
      </span>
    </div>
  );
}
