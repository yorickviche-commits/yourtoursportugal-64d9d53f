import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbTripOperation {
  id: string;
  cost_item_id: string;
  trip_id: string;
  schedule_time: string | null;
  booking_status: string;
  payment_status: string;
  invoice_status: string;
  invoice_file_url: string | null;
  invoice_file_name: string | null;
  created_at: string;
  updated_at: string;
}

export const useTripOperationsQuery = (tripId: string | undefined) => {
  return useQuery({
    queryKey: ['trip_operations', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from('trip_operations')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at');
      if (error) throw error;
      return data as DbTripOperation[];
    },
    enabled: !!tripId,
  });
};

export const useUpsertTripOperation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (op: Partial<DbTripOperation> & { cost_item_id: string; trip_id: string }) => {
      // Try to find existing
      const { data: existing } = await supabase
        .from('trip_operations')
        .select('id')
        .eq('cost_item_id', op.cost_item_id)
        .maybeSingle();

      if (existing) {
        const { id: _, cost_item_id: __, trip_id: ___, ...updates } = op;
        const { data, error } = await supabase
          .from('trip_operations')
          .update(updates as any)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data as DbTripOperation;
      } else {
        const { data, error } = await supabase
          .from('trip_operations')
          .insert(op as any)
          .select()
          .single();
        if (error) throw error;
        return data as DbTripOperation;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trip_operations', data.trip_id] });
    },
  });
};

export const useUpdateTripOperation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripId, updates }: { id: string; tripId: string; updates: Partial<DbTripOperation> }) => {
      const { data, error } = await supabase
        .from('trip_operations')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, trip_id: tripId } as DbTripOperation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trip_operations', data.trip_id] });
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
