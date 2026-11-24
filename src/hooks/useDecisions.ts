import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Decision } from '@/lib/decisions';
import { lisbonToday } from '@/lib/workbench/rules';

export function useDecisions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const opened = useRef('');
  const queryKey = ['cockpit-decisions', user?.id];
  const query = useQuery({
    queryKey, enabled: !!user, staleTime: 10000,
    queryFn: async () => {
      const rows: Decision[] = [];
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase.from('decisions')
          .select('*,leads(client_name,trip_start,trip_finish,nethunt_stage,travel_dates,travel_end_date)')
          .or(`status.in.(open,snoozed,failed,approved),and(status.in.(auto_closed,executed),decided_at.gte.${since})`)
          .order('created_at').order('id').range(from, from + 499);
        if (error) throw error;
        rows.push(...data as unknown as Decision[]);
        if (data.length < 500) break;
      }
      const [control, agent, log, todayClosed] = await Promise.all([
        supabase.from('decisions_control').select('*').maybeSingle(),
        supabase.from('agent_runs').select('started_at').or('agent_label.ilike.%orquestr%,agent_label.ilike.%orchestr%').order('started_at', { ascending: false }).limit(1),
        supabase.from('workbench_auto_log').select('created_at,what,created_by_agent').or('created_by_agent.ilike.%orquestr%,created_by_agent.ilike.%orchestr%').order('created_at', { ascending: false }).limit(1),
        supabase.from('decision_events').select('id', { count: 'exact', head: true }).eq('action', 'auto_closed').gte('created_at', lisbonToday() + 'T00:00:00Z'),
      ]);
      if (control.error) throw control.error;
      const orchestrated = [agent.data?.[0]?.started_at, log.data?.[0]?.created_at].filter((x): x is string => !!x).sort().at(-1);
      return { rows, control: control.data, orchestrated, todayClosed: todayClosed.count || 0, loadedAt: Date.now() };
    },
  });
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscribed = false;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void qc.invalidateQueries({ queryKey: ['cockpit-decisions', user.id] }), 250);
    };
    if (opened.current !== user.id) {
      opened.current = user.id;
      void supabase.rpc('reconcile_decisions').then(({ error }) => { if (!error) invalidate(); });
    }
    const channel = supabase.channel('cockpit-decisions', { config: { private: true } })
      .on('broadcast', { event: 'changed' }, invalidate)
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        const state = qc.getQueryState(['cockpit-decisions', user.id]);
        if (subscribed || state && Date.now() - state.dataUpdatedAt > 10000 && state.fetchStatus !== 'fetching') invalidate();
        subscribed = true;
      });
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [user?.id, qc]);
  const refresh = async () => {
    const { error } = await supabase.rpc('reconcile_decisions');
    if (error) throw error;
    await qc.invalidateQueries({ queryKey });
  };
  return { ...query, refresh };
}