import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbContact {
  id: string;
  lead_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  company: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useContactsQuery = (leadId: string | undefined) => {
  return useQuery({
    queryKey: ['contacts', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at');
      if (error) throw error;
      return data as DbContact[];
    },
    enabled: !!leadId,
  });
};

export const useCreateContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contact: Partial<DbContact>) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert(contact as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbContact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', data.lead_id] });
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbContact> }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbContact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', data.lead_id] });
    },
  });
};

export const useDeleteContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      return leadId;
    },
    onSuccess: (leadId) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', leadId] });
    },
  });
};
