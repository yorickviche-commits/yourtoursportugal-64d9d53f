import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Agent {
  id: string;
  agent_id: string;
  display_name: string;
  role_description: string | null;
  desk_position: { x: number; y: number };
  character_color: string;
  is_active: boolean;
  // status fields
  status: string;
  current_task: string | null;
  current_entity: string | null;
  waiting_for: string | null;
  updated_at: string | null;
}

export interface ActivityEntry {
  id: string;
  agent_id: string;
  event_type: string;
  event_summary: string;
  event_detail: Record<string, any> | null;
  related_entity: string | null;
  requires_action: boolean;
  created_at: string;
}

export interface ApprovalItem {
  id: string;
  agent_id: string;
  approval_type: string;
  title: string;
  description: string | null;
  amount_eur: number | null;
  lead_id: string | null;
  trip_id: string | null;
  payload: Record<string, any> | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export function useAIOffice() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<ActivityEntry[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [agentsRes, statusRes, activityRes, approvalsRes] = await Promise.all([
        supabase.from('ai_agents').select('*').eq('is_active', true),
        supabase.from('agent_status').select('*'),
        supabase.from('agent_activity_log').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('ceo_approval_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);

      if (agentsRes.error) throw agentsRes.error;
      if (statusRes.error) throw statusRes.error;

      const statusMap = new Map<string, any>();
      (statusRes.data || []).forEach((s: any) => statusMap.set(s.agent_id, s));

      const merged: Agent[] = (agentsRes.data || []).map((a: any) => {
        const s = statusMap.get(a.agent_id);
        return {
          ...a,
          desk_position: a.desk_position || { x: 0, y: 0 },
          status: s?.status || 'offline',
          current_task: s?.current_task || null,
          current_entity: s?.current_entity || null,
          waiting_for: s?.waiting_for || null,
          updated_at: s?.updated_at || null,
        };
      });

      setAgents(merged);
      const feed = (activityRes.data || []) as ActivityEntry[];
      setActivityFeed(feed);
      feedRef.current = feed;
      setPendingApprovals((approvalsRes.data || []) as ApprovalItem[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load AI Office data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    const statusChannel = supabase
      .channel('agent-status-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status' }, (payload) => {
        const updated = payload.new as any;
        if (!updated?.agent_id) return;
        setAgents(prev => prev.map(a =>
          a.agent_id === updated.agent_id
            ? { ...a, status: updated.status, current_task: updated.current_task, current_entity: updated.current_entity, waiting_for: updated.waiting_for, updated_at: updated.updated_at }
            : a
        ));
      })
      .subscribe();

    const activityChannel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activity_log' }, (payload) => {
        const newEntry = payload.new as ActivityEntry;
        setActivityFeed(prev => {
          const next = [newEntry, ...prev].slice(0, 50);
          feedRef.current = next;
          return next;
        });
        if (newEntry.requires_action) {
          // Refresh approvals
          supabase.from('ceo_approval_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setPendingApprovals(data as ApprovalItem[]); });
        }
      })
      .subscribe();

    const approvalChannel = supabase
      .channel('approval-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_approval_queue' }, () => {
        supabase.from('ceo_approval_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false })
          .then(({ data }) => { if (data) setPendingApprovals(data as ApprovalItem[]); });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(approvalChannel);
    };
  }, []);

  const handleApproval = useCallback(async (id: string, decision: 'approved' | 'rejected', note?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('ceo_approval_queue')
      .update({
        status: decision,
        decided_by: user?.id || null,
        decided_at: new Date().toISOString(),
        decision_note: note || null,
      })
      .eq('id', id);

    if (!error) {
      setPendingApprovals(prev => prev.filter(a => a.id !== id));
    }
    return error;
  }, []);

  const statusCounts = {
    active: agents.filter(a => a.status === 'working' || a.status === 'reading').length,
    waiting: agents.filter(a => a.status === 'waiting').length,
    idle: agents.filter(a => a.status === 'idle').length,
    error: agents.filter(a => a.status === 'error').length,
    offline: agents.filter(a => a.status === 'offline').length,
  };

  return {
    agents, activityFeed, pendingApprovals, loading, error,
    statusCounts, handleApproval, refetch: fetchAll,
  };
}
