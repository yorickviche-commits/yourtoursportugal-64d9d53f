import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbDocument {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const useDocumentsQuery = (entityType: string | undefined, entityId: string | undefined) => {
  return useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: async () => {
      if (!entityType || !entityId) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DbDocument[];
    },
    enabled: !!entityType && !!entityId,
  });
};

export const useCreateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doc: Partial<DbDocument>) => {
      const { data, error } = await supabase
        .from('documents')
        .insert(doc as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbDocument;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', data.entity_type, data.entity_id] });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityType, entityId }: { id: string; entityType: string; entityId: string }) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      return { entityType, entityId };
    },
    onSuccess: ({ entityType, entityId }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
    },
  });
};
