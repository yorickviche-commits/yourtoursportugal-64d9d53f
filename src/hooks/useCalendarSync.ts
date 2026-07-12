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
}

// Debounced invoker of the calendar-sync edge function.
// Called from anywhere in the lead page after a mutation that affects the event.
const pendingByLead = new Map<string, ReturnType<typeof setTimeout>>();

export function triggerCalendarSync(leadId: string, mode: SyncMode = 'update', delayMs = 2000) {
  if (!leadId) return;
  const existing = pendingByLead.get(leadId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(async () => {
    pendingByLead.delete(leadId);
    try {
      const { error } = await supabase.functions.invoke('calendar-sync', { body: { lead_id: leadId, mode } });
      if (error) console.error('[calendar-sync] failed', error);
    } catch (e) {
      console.error('[calendar-sync] threw', e);
    }
  }, delayMs);
  pendingByLead.set(leadId, t);
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

  const sync = useCallback((mode: SyncMode = 'update', delayMs?: number) => {
    if (!leadId) return;
    triggerCalendarSync(leadId, mode, delayMs);
    // Refresh badge shortly after expected completion
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['calendar_events', leadId] }), (delayMs ?? 2000) + 3000);
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
    refetch: query.refetch,
  };
}
