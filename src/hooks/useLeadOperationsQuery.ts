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
  activity_title: string | null;
  supplier: string | null;
  pax: number | null;
  net_value: number | null;
  real_cost: number | null;
  sort_order: number;
  source: string;
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
      return data as unknown as DbLeadOperation;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_operations', variables.lead_id] });
    },
  });
};

/** Gravação em lote das linhas de operações (+ remoção de linhas eliminadas). */
export const useSaveLeadOperations = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      rows,
      deletedKeys = [],
    }: {
      leadId: string;
      rows: (Partial<DbLeadOperation> & { item_key: string; day_number: number })[];
      deletedKeys?: string[];
    }) => {
      if (deletedKeys.length > 0) {
        const { error } = await supabase
          .from('lead_operations' as any)
          .delete()
          .eq('lead_id', leadId)
          .in('item_key', deletedKeys);
        if (error) throw error;
      }
      if (rows.length > 0) {
        const payload = rows.map(r => ({
          ...r,
          lead_id: leadId,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from('lead_operations' as any)
          .upsert(payload as any, { onConflict: 'lead_id,item_key' });
        if (error) throw error;
      }
      return true;
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_operations', variables.leadId] });
    },
  });
};

export const useCreateBookingEmailLog = () => {
  return useMutation({
    mutationFn: async (log: { operation_id: string; supplier_email?: string; subject: string; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('booking_emails_log')
        .insert({ ...log, sent_by: user?.id || null } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
};
