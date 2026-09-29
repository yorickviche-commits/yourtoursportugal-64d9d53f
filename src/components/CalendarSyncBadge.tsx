import { useState } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Loader2, RefreshCw, ShieldAlert, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSync';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface Props {
  leadId: string;
  leadStatus: string;
}

const QUEUE_LABEL: Record<string, string> = { pending: 'pendente', processing: 'a sincronizar', failed: 'falhou', done: 'concluída' };

export default function CalendarSyncBadge({ leadId, leadStatus }: Props) {
  const { events, hasError, lastSynced, totalDays, syncedDays, sync, forceOverwrite, queueStatus } = useCalendarSyncStatus(leadId);
  const { user } = useAuth();
  const { data: syncAdmins = [] } = useQuery({
    queryKey: ['sync_admins'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase.from('integration_settings').select('config').eq('name', 'sync_admins').maybeSingle();
      return (((data?.config as any)?.emails || []) as string[]).map(e => String(e).toLowerCase());
    },
  });
  const isAdmin = syncAdmins.includes((user?.email || '').toLowerCase());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ day_date: string; title: string; description: string }[] | null>(null);
  const openPreview = async () => {
    setPreviewOpen(true); setPreviewLoading(true); setPreviewError(null); setPreview(null);
    const { data, error } = await supabase.functions.invoke('calendar-sync', { body: { lead_id: leadId, mode: 'preview' } });
    setPreviewLoading(false);
    if (error || !(data as any)?.ok) { setPreviewError((data as any)?.error || error?.message || 'Falha na pré-visualização'); return; }
    setPreview((data as any).events || []);
  };

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
              {queueStatus && queueStatus.status !== 'done' && (
                <div>Fila: {QUEUE_LABEL[queueStatus.status] || queueStatus.status}{queueStatus.attempts ? ` (${queueStatus.attempts} tentativa(s))` : ''}</div>
              )}
              {queueStatus?.last_error && queueStatus.status !== 'done' && (
                <div className="text-red-500 whitespace-pre-wrap">Último erro: {queueStatus.last_error}</div>
              )}
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
        <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]" onClick={openPreview}>
          <Eye className="h-3 w-3 mr-1" /> Ver como fica no calendário
        </Button>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pré-visualização do calendário</DialogTitle></DialogHeader>
          {previewLoading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> A gerar…</div>}
          {previewError && <div className="text-sm text-destructive">{previewError}</div>}
          {preview?.length === 0 && <div className="text-sm text-muted-foreground">Sem dias com serviços.</div>}
          {preview?.map(ev => (
            <div key={ev.day_date} className="border rounded p-3 space-y-2">
              <div className="text-[10px] text-muted-foreground">{ev.day_date}</div>
              <div className="text-sm font-semibold break-words">{ev.title}</div>
              <div className="text-xs leading-relaxed break-words [&_a]:underline" dangerouslySetInnerHTML={{ __html: ev.description }} />
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
