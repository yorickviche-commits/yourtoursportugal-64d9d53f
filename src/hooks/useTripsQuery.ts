import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbTrip {
  id: string;
  trip_code: string;
  client_name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  sales_owner: string;
  budget_level: string;
  pax: number;
  urgency: string;
  total_value: number;
  notes: string;
  has_blocker: boolean;
  blocker_note: string;
  lead_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useTripsQuery = () => {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data as DbTrip[];
    },
  });
};

export const useTripQuery = (id: string | undefined) => {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as DbTrip | null;
    },
    enabled: !!id,
  });
};

export const useCreateTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trip: Partial<DbTrip>) => {
      const { data, error } = await supabase
        .from('trips')
        .insert(trip as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbTrip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
};

export const useUpdateTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbTrip> }) => {
      const { data, error } = await supabase
        .from('trips')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbTrip;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips', data.id] });
    },
  });
};
