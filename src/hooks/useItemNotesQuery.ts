import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbItemNote {
  id: string;
  entity_type: string;
  entity_id: string | null;
  entity_key: string | null;
  note_text: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  author_name?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const useItemNotesQuery = (entityType: string | undefined, entityKey: string | undefined) => {
  return useQuery({
    queryKey: ['item_notes', entityType, entityKey],
    queryFn: async () => {
      if (!entityType || !entityKey) return [];
      const { data, error } = await supabase
        .from('item_notes')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_key', entityKey)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const notes = (data || []) as DbItemNote[];
      const ids = [...new Set(notes.map(n => n.created_by).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
        const map = new Map((profs || []).map((p: any) => [p.id, p.full_name || p.email]));
        notes.forEach(n => { n.author_name = n.created_by ? map.get(n.created_by) ?? null : null; });
      }
      return notes;
    },
    enabled: !!entityType && !!entityKey,
  });
};

export const useCreateItemNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (note: { entity_type: string; entity_key: string; note_text?: string; attachment_url?: string; attachment_name?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('item_notes')
        .insert({
          ...note,
          entity_id: UUID_RE.test(note.entity_key) ? note.entity_key : null,
          created_by: user?.id || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as DbItemNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['item_notes', data.entity_type, data.entity_key] });
    },
  });
};

export const useUpdateItemNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note_text }: { id: string; note_text: string; entityType: string; entityKey: string }) => {
      const { error } = await supabase
        .from('item_notes')
        .update({ note_text, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['item_notes', v.entityType, v.entityKey] });
    },
  });
};

export const useDeleteItemNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityType, entityKey }: { id: string; entityType: string; entityKey: string; storagePath?: string | null }) => {
      const { error } = await supabase.from('item_notes').delete().eq('id', id);
      if (error) throw error;
      return { entityType, entityKey };
    },
    onSuccess: async (r, v) => {
      if (v.storagePath) await supabase.storage.from('item-notes').remove([v.storagePath]);
      queryClient.invalidateQueries({ queryKey: ['item_notes', r.entityType, r.entityKey] });
    },
  });
};
