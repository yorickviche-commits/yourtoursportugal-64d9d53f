import { Calendar, CheckCircle2, AlertTriangle, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSync';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface Props {
  leadId: string;
  leadStatus: string;
}

const ADMIN_EMAIL = 'yorick.viche@yourtours.pt';

export default function CalendarSyncBadge({ leadId, leadStatus }: Props) {
  const { events, hasError, lastSynced, totalDays, syncedDays, sync, forceOverwrite } = useCalendarSyncStatus(leadId);
  const { user } = useAuth();
  const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL;

  if (leadStatus !== 'won' && totalDays === 0) return null;

  const manualEvents = events.filter(e => e.protection_status === 'manual_edit');
  const orphanEvents = events.filter(e => e.protection_status === 'orphan');
  const hasManual = manualEvents.length > 0;
  const hasOrphan = orphanEvents.length > 0;

  const isSyncing = syncedDays < totalDays && !hasError;
  const allGood = totalDays > 0 && syncedDays === totalDays && !hasError;

  const icon = hasManual || hasOrphan
    ? <ShieldAlert className="h-3 w-3" />
    : hasError
      ? <AlertTriangle className="h-3 w-3" />
      : isSyncing
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : allGood
          ? <CheckCircle2 className="h-3 w-3" />
          : <Calendar className="h-3 w-3" />;

  const label = hasManual
    ? `Editado à mão no calendário — protegido (${manualEvents.length})`
    : hasOrphan
      ? `Evento órfão — rever (${orphanEvents.length})`
      : totalDays === 0
        ? 'Calendar por sincronizar'
        : hasError
          ? `${syncedDays}/${totalDays} sincronizados (erro)`
          : allGood
            ? `${syncedDays}/${totalDays} sincronizados`
            : `${syncedDays}/${totalDays} a sincronizar`;

  const colorClass = hasManual || hasError
    ? 'bg-red-100 text-red-700 border-red-200'
    : hasOrphan
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : allGood
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : 'bg-blue-100 text-blue-700 border-blue-200';

  const handleResync = () => {
    sync('full_resync', 0);
    toast.success('Ressincronização iniciada (eventos editados à mão ficam protegidos)');
  };

  const handleForce = async () => {
    if (!manualEvents.length) return;
    if (!window.confirm('Isto substitui o conteúdo manual do evento no Google Calendar. Continuar?')) return;
    const res = await forceOverwrite(manualEvents.map(e => e.day_date));
    if (res.ok) toast.success('Eventos reescritos'); else toast.error(res.error || 'Falha ao forçar reescrita');
  };

  const errorDetails = events.filter(e => e.sync_error).map(e => `${e.day_date}: ${e.sync_error}`).join('\n');

  return (
    <TooltipProvider>
      <div className="inline-flex items-center gap-1">
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
              <div className="text-muted-foreground pt-1">Clique 🔄 para ressincronizar (respeita edições manuais).</div>
            </div>
          </TooltipContent>
        </Tooltip>
        {isAdmin && hasManual && (
          <Button variant="outline" size="sm" className="h-5 px-2 text-[10px]" onClick={handleForce}>
            Forçar reescrita (admin)
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
