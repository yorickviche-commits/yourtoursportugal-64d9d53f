import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DbLead {
  id: string;
  lead_code: string;
  yt_id: string | null;
  client_name: string;
  email: string;
  client_type: string;
  phone: string;
  destination: string;
  travel_dates: string;
  travel_end_date: string;
  number_of_days: number;
  dates_type: string;
  pax: number;
  pax_children: number;
  pax_infants: number;
  status: string;
  source: string;
  budget_level: string;
  sales_owner: string;
  notes: string;
  travel_style: string[] | null;
  comfort_level: string;
  magic_question: string;
  active_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useLeadsQuery = () => {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DbLead[];
    },
  });
};

export const useLeadQuery = (id: string | undefined) => {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: async () => {
      if (!id) return null;
      // Try to find by id (uuid) or by lead_code
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or(`id.eq.${id},lead_code.eq.${id}`)
        .maybeSingle();
      if (error) throw error;
      return data as DbLead | null;
    },
    enabled: !!id,
  });
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (lead: Partial<DbLead>) => {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          client_name: lead.client_name || '',
          email: lead.email || '',
          client_type: lead.client_type || 'B2C',
          phone: lead.phone || '',
          destination: lead.destination || '',
          travel_dates: lead.travel_dates || '',
          travel_end_date: lead.travel_end_date || '',
          number_of_days: lead.number_of_days || 0,
          dates_type: lead.dates_type || 'concrete',
          pax: lead.pax || 2,
          pax_children: lead.pax_children || 0,
          pax_infants: lead.pax_infants || 0,
          status: lead.status || 'new',
          source: lead.source || 'direct',
          budget_level: lead.budget_level || '€€',
          sales_owner: lead.sales_owner || '',
          notes: lead.notes || '',
          travel_style: lead.travel_style || [],
          comfort_level: lead.comfort_level || '',
          magic_question: lead.magic_question || '',
          active_version: lead.active_version || 0,
          lead_code: lead.lead_code || '',
          yt_id: lead.yt_id || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao criar lead', description: err.message, variant: 'destructive' });
    },
  });
};

export const useUpdateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbLead> }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbLead;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', data.id] });
    },
  });
};

export const useDeleteLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Não foi possível remover a lead — apenas administradores podem eliminar leads.');
      }
      return id;
    },
    onSuccess: (id) => {
      // Remove immediately from cached list, then refetch from server
      queryClient.setQueryData<DbLead[]>(['leads'], (old) =>
        old ? old.filter((l) => l.id !== id) : old,
      );
      queryClient.removeQueries({ queryKey: ['leads', id] });
      queryClient.refetchQueries({ queryKey: ['leads'], exact: true });
    },
  });
};
