import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type SyncMode = 'create' | 'update' | 'delete' | 'full_resync';

interface CalendarEventRow {
  id: string;
  lead_id: string;
  day_date: string;
  google_event_id: string | null;
  last_synced_at: string | null;
  status: string | null;
  sync_error: string | null;
  protection_status: 'ok' | 'manual_edit' | 'orphan' | null;
  manual_edit_detected_at: string | null;
}

// Enqueues a calendar sync in the backend queue (debounce + retries handled server-side).
// Signature kept for callers; `delayMs` is ignored. full_resync/force_overwrite call calendar-sync directly.
export function triggerCalendarSync(leadId: string, mode: SyncMode = 'update', _delayMs = 2000) {
  if (!leadId) return;
  if (mode === 'full_resync') {
    supabase.functions.invoke('calendar-sync', { body: { lead_id: leadId, mode } })
      .then(({ error }) => { if (error) console.error('[calendar-sync] failed', error); });
    return;
  }
  (supabase.rpc as any)('enqueue_sync', {
    p_target: 'calendar', p_entity: 'lead', p_entity_id: leadId, p_fields: [], p_reason: `ui:${mode}`,
  }).then(({ error }: any) => { if (error) console.error('[enqueue_sync] failed', error); });
}

export interface SyncQueueStatus {
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;
  last_error: string | null;
  updated_at: string;
}

export function useCalendarSyncStatus(leadId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['calendar_events', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<CalendarEventRow[]> => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('calendar_events' as any)
        .select('*')
        .eq('lead_id', leadId)
        .order('day_date', { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    refetchInterval: 15000,
  });

  const queue = useQuery({
    queryKey: ['sync_status', 'calendar', leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<SyncQueueStatus | null> => {
      const { data, error } = await (supabase.rpc as any)('get_sync_status', { p_target: 'calendar', p_entity_id: leadId });
      if (error) return null;
      return (Array.isArray(data) ? data[0] : data) || null;
    },
    refetchInterval: 15000,
  });

  const sync = useCallback((mode: SyncMode = 'update', delayMs?: number) => {
    if (!leadId) return;
    triggerCalendarSync(leadId, mode, delayMs);
    // Refresh badge shortly after expected completion
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events', leadId] });
      queryClient.invalidateQueries({ queryKey: ['sync_status', 'calendar', leadId] });
    }, (delayMs ?? 2000) + 3000);
  }, [leadId, queryClient]);

  const forceOverwrite = useCallback(async (dayDates: string[]): Promise<{ ok: boolean; error?: string }> => {
    if (!leadId) return { ok: false, error: 'lead em falta' };
    const { data, error } = await supabase.functions.invoke('calendar-sync', {
      body: { lead_id: leadId, mode: 'force_overwrite', day_dates: dayDates },
    });
    queryClient.invalidateQueries({ queryKey: ['calendar_events', leadId] });
    if (error) {
      let msg = error.message;
      try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* ignore */ }
      return { ok: false, error: msg };
    }
    return { ok: !!(data as any)?.ok, error: (data as any)?.error };
  }, [leadId, queryClient]);

  const events = query.data || [];
  const hasError = events.some(e => e.sync_error);
  const lastSynced = events.reduce<string | null>((acc, e) => {
    if (!e.last_synced_at) return acc;
    if (!acc || e.last_synced_at > acc) return e.last_synced_at;
    return acc;
  }, null);
  const totalDays = events.length;
  const syncedDays = events.filter(e => e.google_event_id && !e.sync_error).length;

  return {
    events,
    isLoading: query.isLoading,
    hasError,
    lastSynced,
    totalDays,
    syncedDays,
    sync,
    forceOverwrite,
    queueStatus: queue.data || null,
    refetch: query.refetch,
  };
}
