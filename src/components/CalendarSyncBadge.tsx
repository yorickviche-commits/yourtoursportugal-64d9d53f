import { Calendar, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSync';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface Props {
  leadId: string;
  leadStatus: string;
}

export default function CalendarSyncBadge({ leadId, leadStatus }: Props) {
  const { events, hasError, lastSynced, totalDays, syncedDays, sync } = useCalendarSyncStatus(leadId);

  // Only show for confirmed leads (won)
  if (leadStatus !== 'won' && totalDays === 0) return null;

  const isSyncing = syncedDays < totalDays && !hasError;
  const allGood = totalDays > 0 && syncedDays === totalDays && !hasError;

  const icon = hasError
    ? <AlertTriangle className="h-3 w-3" />
    : isSyncing
      ? <Loader2 className="h-3 w-3 animate-spin" />
      : allGood
        ? <CheckCircle2 className="h-3 w-3" />
        : <Calendar className="h-3 w-3" />;

  const label = totalDays === 0
    ? 'Calendar por sincronizar'
    : hasError
      ? `${syncedDays}/${totalDays} sincronizados (erro)`
      : allGood
        ? `${syncedDays}/${totalDays} sincronizados`
        : `${syncedDays}/${totalDays} a sincronizar`;

  const colorClass = hasError
    ? 'bg-red-100 text-red-700 border-red-200'
    : allGood
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-blue-100 text-blue-700 border-blue-200';

  const handleResync = async () => {
    sync('full_resync', 0);
    toast.success('Ressincronização iniciada');
  };

  const errorDetails = events.filter(e => e.sync_error).map(e => `${e.day_date}: ${e.sync_error}`).join('\n');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-2 px-2 py-0.5 rounded-full border text-[10px] font-medium cursor-help', colorClass)}>
            {icon}
            <span>{label}</span>
            <Button variant="ghost" size="icon" className="h-4 w-4 p-0 ml-1" onClick={(e) => { e.stopPropagation(); handleResync(); }}>
              <RefreshCw className="h-2.5 w-2.5" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-xs space-y-1">
            <div><strong>Google Calendar</strong></div>
            {lastSynced && <div>Última sincronização: {new Date(lastSynced).toLocaleString('pt-PT')}</div>}
            <div>{totalDays} dia(s) mapeados</div>
            {errorDetails && <div className="text-red-500 whitespace-pre-wrap">{errorDetails}</div>}
            <div className="text-muted-foreground pt-1">Clique 🔄 para forçar ressincronização.</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
