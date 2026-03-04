import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  team: string;
  assigned_to: string;
  due_date: string | null;
  trip_id: string | null;
  lead_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useTasksQuery = (team?: string) => {
  return useQuery({
    queryKey: ['tasks', team],
    queryFn: async () => {
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (team) query = query.eq('team', team);
      const { data, error } = await query;
      if (error) throw error;
      return data as DbTask[];
    },
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<DbTask>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert(task as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbTask> }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};
