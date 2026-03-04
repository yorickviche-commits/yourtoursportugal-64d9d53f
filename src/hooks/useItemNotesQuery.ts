import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbItemNote {
  id: string;
  entity_type: string;
  entity_id: string;
  note_text: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_by: string | null;
  created_at: string;
}

export const useItemNotesQuery = (entityType: string | undefined, entityId: string | undefined) => {
  return useQuery({
    queryKey: ['item_notes', entityType, entityId],
    queryFn: async () => {
      if (!entityType || !entityId) return [];
      const { data, error } = await supabase
        .from('item_notes')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DbItemNote[];
    },
    enabled: !!entityType && !!entityId,
  });
};

export const useCreateItemNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (note: { entity_type: string; entity_id: string; note_text?: string; attachment_url?: string; attachment_name?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('item_notes')
        .insert({ ...note, created_by: user?.id || null } as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbItemNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['item_notes', data.entity_type, data.entity_id] });
    },
  });
};

export const useDeleteItemNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityType, entityId }: { id: string; entityType: string; entityId: string }) => {
      const { error } = await supabase.from('item_notes').delete().eq('id', id);
      if (error) throw error;
      return { entityType, entityId };
    },
    onSuccess: ({ entityType, entityId }) => {
      queryClient.invalidateQueries({ queryKey: ['item_notes', entityType, entityId] });
    },
  });
};
