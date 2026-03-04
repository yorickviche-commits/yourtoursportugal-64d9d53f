import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbCostItem {
  id: string;
  trip_id: string;
  category: string;
  description: string;
  supplier: string | null;
  unit_cost: number;
  quantity: number;
  margin_percent: number;
  total_cost: number; // generated column
  notes: string | null;
  currency: string;
  pricing_type: string;
  num_adults: number;
  price_adults: number;
  status: string;
  day_number: number;
  created_at: string;
  updated_at: string;
}

export const useCostItemsQuery = (tripId: string | undefined) => {
  return useQuery({
    queryKey: ['cost_items', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from('cost_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at');
      if (error) throw error;
      return data as DbCostItem[];
    },
    enabled: !!tripId,
  });
};

export const useCreateCostItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<DbCostItem>) => {
      const { data, error } = await supabase
        .from('cost_items')
        .insert({
          trip_id: item.trip_id,
          category: item.category || 'other',
          description: item.description || '',
          supplier: item.supplier || null,
          unit_cost: item.unit_cost || 0,
          quantity: item.quantity || 1,
          margin_percent: item.margin_percent || 0,
          notes: item.notes || null,
          currency: item.currency || 'EUR',
        })
        .select()
        .single();
      if (error) throw error;
      return data as DbCostItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cost_items', data.trip_id] });
    },
  });
};

export const useUpdateCostItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbCostItem> }) => {
      // Remove total_cost from updates as it's generated
      const { total_cost, ...cleanUpdates } = updates;
      const { data, error } = await supabase
        .from('cost_items')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbCostItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cost_items', data.trip_id] });
    },
  });
};

export const useDeleteCostItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripId }: { id: string; tripId: string }) => {
      const { error } = await supabase.from('cost_items').delete().eq('id', id);
      if (error) throw error;
      return tripId;
    },
    onSuccess: (tripId) => {
      queryClient.invalidateQueries({ queryKey: ['cost_items', tripId] });
    },
  });
};
