import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbTripItineraryItem {
  id: string;
  trip_id: string;
  day_number: number;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  sort_order: number;
  supplier: string | null;
  num_people: number;
  net_total: number;
  paid_amount: number;
  reservation_status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export const useTripItineraryQuery = (tripId: string | undefined) => {
  return useQuery({
    queryKey: ['trip_itinerary_items', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from('trip_itinerary_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('day_number')
        .order('sort_order');
      if (error) throw error;
      return data as DbTripItineraryItem[];
    },
    enabled: !!tripId,
  });
};

export const useCreateTripItineraryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<DbTripItineraryItem>) => {
      const { data, error } = await supabase
        .from('trip_itinerary_items')
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbTripItineraryItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trip_itinerary_items', data.trip_id] });
    },
  });
};

export const useUpdateTripItineraryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbTripItineraryItem> }) => {
      const { data, error } = await supabase
        .from('trip_itinerary_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbTripItineraryItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trip_itinerary_items', data.trip_id] });
    },
  });
};

export const useDeleteTripItineraryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripId }: { id: string; tripId: string }) => {
      const { error } = await supabase.from('trip_itinerary_items').delete().eq('id', id);
      if (error) throw error;
      return tripId;
    },
    onSuccess: (tripId) => {
      queryClient.invalidateQueries({ queryKey: ['trip_itinerary_items', tripId] });
    },
  });
};
