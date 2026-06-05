import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentNotification {
  id: string;
  created_at: string;
  type: 'alert' | 'info' | 'warning' | 'action_required';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_ref: string | null;
  agent_name: string;
  read_at: string | null;
  dismissed_at: string | null;
  metadata: Record<string, any>;
}

export const useAgentNotifications = () => {
  return useQuery({
    queryKey: ['agent_notifications'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('agent_notifications')
        .select('*')
        .is('dismissed_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AgentNotification[];
    },
    refetchInterval: 30000,
  });
};

export const useUnreadNotificationCount = () => {
  const { data } = useAgentNotifications();
  return (data || []).filter(n => !n.read_at).length;
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from('agent_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent_notifications'] }),
  });
};

export const useDismissNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from('agent_notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent_notifications'] }),
  });
};
