import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbApproval {
  id: string;
  trip_id: string | null;
  lead_id: string | null;
  client_name: string;
  type: string;
  title: string;
  submitted_by: string;
  submitted_at: string;
  priority: string;
  summary: string;
  status: string;
  resolved_by: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useApprovalsQuery = () => {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data as DbApproval[];
    },
  });
};

export const useCreateApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (approval: Partial<DbApproval>) => {
      const { data, error } = await supabase
        .from('approvals')
        .insert(approval as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbApproval;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
};

export const useUpdateApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbApproval> }) => {
      const { data, error } = await supabase
        .from('approvals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbApproval;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
};
