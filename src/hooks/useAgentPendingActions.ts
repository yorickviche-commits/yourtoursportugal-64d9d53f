import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentPendingAction {
  id: string;
  created_at: string;
  action_type: string;
  title: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_ref: string | null;
  agent_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  payload: Record<string, any>;
  result: Record<string, any>;
}

export const useAgentPendingActions = () => {
  return useQuery({
    queryKey: ['agent_pending_actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_pending_actions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AgentPendingAction[];
    },
    refetchInterval: 15000,
  });
};

export const useApproveAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('agent_pending_actions').update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent_pending_actions'] }),
  });
};

export const useRejectAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      await supabase.from('agent_pending_actions').update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null,
      }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent_pending_actions'] }),
  });
};
