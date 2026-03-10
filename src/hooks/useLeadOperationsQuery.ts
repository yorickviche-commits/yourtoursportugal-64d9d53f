import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbLeadOperation {
  id: string;
  lead_id: string;
  item_key: string;
  day_number: number;
  schedule_time: string | null;
  booking_status: string;
  payment_status: string;
  invoice_status: string;
  invoice_file_url: string | null;
  invoice_file_name: string | null;
  created_at: string;
  updated_at: string;
}

export const useLeadOperationsQuery = (leadId: string | undefined) => {
  return useQuery({
    queryKey: ['lead_operations', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_operations' as any)
        .select('*')
        .eq('lead_id', leadId);
      if (error) throw error;
      return (data || []) as unknown as DbLeadOperation[];
    },
    enabled: !!leadId,
  });
};

export const useUpsertLeadOperation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<DbLeadOperation> & { lead_id: string; item_key: string }) => {
      const { data, error } = await supabase
        .from('lead_operations' as any)
        .upsert(
          { ...payload, updated_at: new Date().toISOString() } as any,
          { onConflict: 'lead_id,item_key' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_operations', variables.lead_id] });
    },
  });
};
