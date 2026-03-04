import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbActivityLog {
  id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  user_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export const useActivityLogQuery = (
  entityType?: string,
  entityId?: string,
  limit: number = 25
) => {
  return useQuery({
    queryKey: ['activity_logs', entityType, entityId, limit],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      const { data, error } = await query;
      if (error) throw error;
      return data as DbActivityLog[];
    },
  });
};
