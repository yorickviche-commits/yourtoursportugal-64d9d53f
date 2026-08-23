import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { YtbConfidentiality, YtbDocType, YtbStatus } from '@/lib/ytBrain';
import { BRAIN_BUCKET } from '@/lib/ytBrain';

export interface YtbFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface YtbDocument {
  id: string;
  folder_id: string | null;
  title: string;
  type: YtbDocType;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  url: string | null;
  description: string | null;
  status: YtbStatus;
  confidentiality: YtbConfidentiality;
  tags: string[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  category_ids?: string[];
}

export interface YtbCategory {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

const sb = supabase as any;

/* ─── access level (mapped onto the existing role system) ───────────── */
export type BrainAccess = 'admin' | 'editor' | 'viewer';

export function useBrainAccess(): { access: BrainAccess; canEdit: boolean; isAdmin: boolean } {
  const { roles } = useAuth();
  const isAdmin = roles.includes('super_admin') || roles.includes('admin');
  const canEdit = isAdmin || roles.some(r =>
    ['sales_agent', 'operations_agent', 'finance', 'b2b_manager'].includes(r));
  return { access: isAdmin ? 'admin' : canEdit ? 'editor' : 'viewer', canEdit, isAdmin };
}

/* ─── activity log ──────────────────────────────────────────────────── */
export async function logBrain(action: string, entityType: string, entityId?: string, details: any = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await sb.from('ytb_activity_log').insert({
      user_id: user?.id ?? null, action, entity_type: entityType,
      entity_id: entityId ?? null, details,
    });
  } catch { /* non-blocking */ }
}

const triggerIngest = async (documentId: string) => {
  try { await supabase.functions.invoke('ytb-ingest', { body: { document_id: documentId } }); }
  catch { /* indexing is best-effort */ }
};

/* ─── folders ───────────────────────────────────────────────────────── */
export const useYtbFolders = (includeDeleted = false) =>
  useQuery({
    queryKey: ['ytb_folders', includeDeleted],
    queryFn: async () => {
      let q = sb.from('ytb_folders').select('*').order('name');
      if (!includeDeleted) q = q.eq('is_deleted', false);
      const { data, error } = await q;
      if (error) throw error;
      return data as YtbFolder[];
    },
  });

export const useFolderMutations = () => {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: ['ytb_folders'] });
    qc.invalidateQueries({ queryKey: ['ytb_documents'] });
  };

  const create = useMutation({
    mutationFn: async ({ name, parent_folder_id }: { name: string; parent_folder_id: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await sb.from('ytb_folders')
        .insert({ name, parent_folder_id, created_by: user?.id ?? null }).select().single();
      if (error) throw error;
      await logBrain('create', 'folder', data.id, { name });
      return data as YtbFolder;
    },
    onSuccess: done,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<YtbFolder>) => {
      const { error } = await sb.from('ytb_folders').update(patch).eq('id', id);
      if (error) throw error;
      await logBrain(patch.parent_folder_id !== undefined ? 'move' : 'update', 'folder', id, patch);
    },
    onSuccess: done,
  });

  // Recursive soft delete (folder + subfolders + documents)
  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { data: all } = await sb.from('ytb_folders').select('id,parent_folder_id').eq('is_deleted', false);
      const ids: string[] = [];
      const walk = (fid: string) => {
        ids.push(fid);
        (all ?? []).filter((f: any) => f.parent_folder_id === fid).forEach((f: any) => walk(f.id));
      };
      walk(id);
      const { error } = await sb.from('ytb_folders').update({ is_deleted: true }).in('id', ids);
      if (error) throw error;
      const { data: docs } = await sb.from('ytb_documents').select('id').in('folder_id', ids).eq('is_deleted', false);
      if (docs?.length) {
        await sb.from('ytb_documents').update({ is_deleted: true }).in('id', docs.map((d: any) => d.id));
        await sb.from('ytb_embeddings').delete().in('document_id', docs.map((d: any) => d.id));
      }
      await logBrain('delete', 'folder', id, { cascade: ids.length });
    },
    onSuccess: done,
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('ytb_folders').update({ is_deleted: false }).eq('id', id);
      if (error) throw error;
      await logBrain('restore', 'folder', id);
    },
    onSuccess: done,
  });

  return { create, update, softDelete, restore };
};

/* ─── documents ─────────────────────────────────────────────────────── */
export interface DocFilter {
  folderId?: string | null;      // undefined = ignore folder
  scope?: 'folder' | 'all' | 'recent' | 'trash';
  search?: string;
  categoryId?: string | null;
  confidentiality?: YtbConfidentiality | null;
  status?: YtbStatus | null;
  type?: YtbDocType | null;
}

export const useYtbDocuments = (filter: DocFilter) =>
  useQuery({
    queryKey: ['ytb_documents', filter],
    queryFn: async () => {
      let q = sb.from('ytb_documents')
        .select('*, ytb_document_categories(category_id)')
        .order('updated_at', { ascending: false });

      q = filter.scope === 'trash' ? q.eq('is_deleted', true) : q.eq('is_deleted', false);
      if (filter.scope === 'folder') {
        q = filter.folderId ? q.eq('folder_id', filter.folderId) : q.is('folder_id', null);
      }
      if (filter.scope === 'recent') q = q.limit(30);
      if (filter.confidentiality) q = q.eq('confidentiality', filter.confidentiality);
      if (filter.status) q = q.eq('status', filter.status);
      if (filter.type) q = q.eq('type', filter.type);
      if (filter.search?.trim()) {
        const s = filter.search.replace(/[%,]/g, ' ').trim();
        q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,content.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []).map((d: any) => ({
        ...d,
        category_ids: (d.ytb_document_categories ?? []).map((c: any) => c.category_id),
      })) as YtbDocument[];
      if (filter.categoryId) rows = rows.filter(r => r.category_ids?.includes(filter.categoryId!));
      return rows;
    },
  });

export interface DocInput {
  id?: string;
  folder_id: string | null;
  title: string;
  type: YtbDocType;
  content?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  url?: string | null;
  description?: string | null;
  status: YtbStatus;
  confidentiality: YtbConfidentiality;
  tags: string[];
  category_ids: string[];
}

export const useDocumentMutations = () => {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['ytb_documents'] });

  const setCategories = async (documentId: string, categoryIds: string[]) => {
    await sb.from('ytb_document_categories').delete().eq('document_id', documentId);
    if (categoryIds.length) {
      await sb.from('ytb_document_categories')
        .insert(categoryIds.map(cid => ({ document_id: documentId, category_id: cid })));
    }
  };

  const create = useMutation({
    mutationFn: async (input: DocInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { category_ids, ...doc } = input;
      const { data, error } = await sb.from('ytb_documents')
        .insert({ ...doc, created_by: user?.id ?? null, updated_by: user?.id ?? null })
        .select().single();
      if (error) throw error;
      await setCategories(data.id, category_ids);
      await logBrain('create', 'document', data.id, { title: doc.title, type: doc.type });
      void triggerIngest(data.id);
      return data as YtbDocument;
    },
    onSuccess: done,
  });

  const update = useMutation({
    mutationFn: async ({ id, category_ids, ...patch }: { id: string; category_ids?: string[] } & Partial<DocInput>) => {
      const { data: prev } = await sb.from('ytb_documents').select('*').eq('id', id).single();
      const { data: { user } } = await supabase.auth.getUser();
      // snapshot of the previous version
      const { count } = await sb.from('ytb_document_versions')
        .select('id', { count: 'exact', head: true }).eq('document_id', id);
      await sb.from('ytb_document_versions').insert({
        document_id: id, version_number: (count ?? 0) + 1,
        title: prev?.title, content: prev?.content, file_path: prev?.file_path, url: prev?.url,
        edited_by: user?.id ?? null,
      });
      const { error } = await sb.from('ytb_documents')
        .update({ ...patch, updated_by: user?.id ?? null }).eq('id', id);
      if (error) throw error;
      if (category_ids) await setCategories(id, category_ids);
      await logBrain('update', 'document', id, patch);
      void triggerIngest(id);
    },
    onSuccess: done,
  });

  const move = useMutation({
    mutationFn: async ({ ids, folder_id }: { ids: string[]; folder_id: string | null }) => {
      const { error } = await sb.from('ytb_documents').update({ folder_id }).in('id', ids);
      if (error) throw error;
      await logBrain('move', 'document', ids[0], { ids, folder_id });
    },
    onSuccess: done,
  });

  const bulkCategorize = useMutation({
    mutationFn: async ({ ids, categoryIds }: { ids: string[]; categoryIds: string[] }) => {
      for (const id of ids) await setCategories(id, categoryIds);
      await logBrain('update', 'document', ids[0], { ids, categoryIds });
    },
    onSuccess: done,
  });

  const softDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from('ytb_documents').update({ is_deleted: true }).in('id', ids);
      if (error) throw error;
      await sb.from('ytb_embeddings').delete().in('document_id', ids);
      await logBrain('delete', 'document', ids[0], { ids });
    },
    onSuccess: done,
  });

  const restore = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from('ytb_documents').update({ is_deleted: false }).in('id', ids);
      if (error) throw error;
      await logBrain('restore', 'document', ids[0], { ids });
      for (const id of ids) void triggerIngest(id);
    },
    onSuccess: done,
  });

  const hardDelete = useMutation({
    mutationFn: async (docs: YtbDocument[]) => {
      const paths = docs.map(d => d.file_path).filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from(BRAIN_BUCKET).remove(paths);
      const ids = docs.map(d => d.id);
      const { error } = await sb.from('ytb_documents').delete().in('id', ids);
      if (error) throw error;
      await logBrain('hard_delete', 'document', ids[0], { ids });
    },
    onSuccess: done,
  });

  return { create, update, move, bulkCategorize, softDelete, restore, hardDelete };
};

/* ─── categories ────────────────────────────────────────────────────── */
export const useYtbCategories = () =>
  useQuery({
    queryKey: ['ytb_categories'],
    queryFn: async () => {
      const { data, error } = await sb.from('ytb_categories').select('*').order('name');
      if (error) throw error;
      return data as YtbCategory[];
    },
  });

export const useCategoryMutations = () => {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: ['ytb_categories'] });
    qc.invalidateQueries({ queryKey: ['ytb_documents'] });
  };
  const upsert = useMutation({
    mutationFn: async (cat: Partial<YtbCategory>) => {
      if (cat.id) {
        const { error } = await sb.from('ytb_categories')
          .update({ name: cat.name, color: cat.color, description: cat.description }).eq('id', cat.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('ytb_categories')
          .insert({ name: cat.name, color: cat.color, description: cat.description });
        if (error) throw error;
      }
      await logBrain(cat.id ? 'update' : 'create', 'category', cat.id, cat);
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await sb.from('ytb_document_categories').delete().eq('category_id', id);
      const { error } = await sb.from('ytb_categories').delete().eq('id', id);
      if (error) throw error;
      await logBrain('delete', 'category', id);
    },
    onSuccess: done,
  });
  return { upsert, remove };
};

/* ─── classifications ───────────────────────────────────────────────── */
export const useYtbClassifications = () =>
  useQuery({
    queryKey: ['ytb_classifications'],
    queryFn: async () => {
      const { data: classes, error } = await sb.from('ytb_classifications').select('*').order('name');
      if (error) throw error;
      const { data: values } = await sb.from('ytb_classification_values').select('*').order('sort_order');
      return (classes ?? []).map((c: any) => ({
        ...c, values: (values ?? []).filter((v: any) => v.classification_id === c.id),
      }));
    },
  });

export const useClassificationMutations = () => {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['ytb_classifications'] });
  const addValue = useMutation({
    mutationFn: async ({ classification_id, value, sort_order }: { classification_id: string; value: string; sort_order: number }) => {
      const { error } = await sb.from('ytb_classification_values').insert({ classification_id, value, sort_order });
      if (error) throw error;
    },
    onSuccess: done,
  });
  const renameValue = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await sb.from('ytb_classification_values').update({ value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: done,
  });
  const removeValue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('ytb_classification_values').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: done,
  });
  return { addValue, renameValue, removeValue };
};

/* ─── versions ──────────────────────────────────────────────────────── */
export const useYtbVersions = (documentId?: string) =>
  useQuery({
    queryKey: ['ytb_versions', documentId],
    queryFn: async () => {
      const { data, error } = await sb.from('ytb_document_versions').select('*')
        .eq('document_id', documentId).order('version_number', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!documentId,
  });

/* ─── indexing state ────────────────────────────────────────────────── */
export const useYtbIndexState = (documentId?: string) =>
  useQuery({
    queryKey: ['ytb_index_state', documentId],
    queryFn: async () => {
      const { count } = await sb.from('ytb_embeddings')
        .select('id', { count: 'exact', head: true }).eq('document_id', documentId);
      return count ?? 0;
    },
    enabled: !!documentId,
    refetchInterval: (q) => (q.state.data ? false : 4000),
  });

/* ─── activity feed ─────────────────────────────────────────────────── */
export const useYtbActivity = (page = 0, pageSize = 25) =>
  useQuery({
    queryKey: ['ytb_activity', page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const { data, error } = await sb.from('ytb_activity_log').select('*')
        .order('created_at', { ascending: false }).range(from, from + pageSize - 1);
      if (error) throw error;
      return data as any[];
    },
  });

export { triggerIngest };
