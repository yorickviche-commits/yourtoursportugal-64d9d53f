import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/hooks/useActivityLog';
import { FEEDBACK_BUCKET } from '@/lib/feedbackConstants';
import type { Database } from '@/integrations/supabase/types';
import { feedbackKeys } from '@/hooks/useFeedbackQuery';

type FeedbackInsert = Database['public']['Tables']['platform_feedback']['Insert'];
type FeedbackUpdate = Database['public']['Tables']['platform_feedback']['Update'];

const extOf = (file: File) => {
  const fromName = file.name.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (file.type.split('/')[1] || 'png').toLowerCase();
};

const imageSize = (file: File) =>
  new Promise<{ width: number | null; height: number | null }>(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url); };
    img.src = url;
  });

export function useCreateFeedback() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ payload, files }: { payload: FeedbackInsert; files: File[] }) => {
      const { data, error } = await supabase
        .from('platform_feedback')
        .insert(payload)
        .select('id, ref')
        .single();
      if (error) throw error;

      const failed: string[] = [];
      for (const file of files) {
        const path = `${data.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(file)}`;
        const up = await supabase.storage.from(FEEDBACK_BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (up.error) { failed.push(file.name); continue; }
        const { width, height } = await imageSize(file);
        const att = await supabase.from('platform_feedback_attachments').insert({
          feedback_id: data.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          width,
          height,
          uploaded_by: user?.id ?? null,
        });
        if (att.error) failed.push(file.name);
      }

      await logActivity('feedback_submitted', 'platform_feedback', data.ref ?? data.id, {
        type: payload.type,
        module: payload.module,
      });

      return { id: data.id, ref: data.ref as string, failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: FeedbackUpdate }) => {
      const { error } = await supabase.from('platform_feedback').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      qc.invalidateQueries({ queryKey: feedbackKeys.detail(vars.id) });
    },
  });
}

export function useBulkUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: FeedbackUpdate }) => {
      const { error } = await supabase.from('platform_feedback').update(patch).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

export function useAddFeedbackComment() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ feedbackId, body, isInternal }: { feedbackId: string; body: string; isInternal: boolean }) => {
      const { error } = await supabase.from('platform_feedback_comments').insert({
        feedback_id: feedbackId,
        author_id: user!.id,
        author_name: profile?.full_name ?? profile?.email ?? null,
        body,
        is_internal: isInternal,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: feedbackKeys.detail(vars.feedbackId) });
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useToggleFeedbackVote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ feedbackId, voted }: { feedbackId: string; voted: boolean }) => {
      if (voted) {
        const { error } = await supabase.from('platform_feedback_votes')
          .delete().eq('feedback_id', feedbackId).eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('platform_feedback_votes')
          .insert({ feedback_id: feedbackId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

export function useDeleteFeedbackAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath, feedbackId }: { id: string; storagePath: string; feedbackId: string }) => {
      await supabase.storage.from(FEEDBACK_BUCKET).remove([storagePath]);
      const { error } = await supabase.from('platform_feedback_attachments').delete().eq('id', id);
      if (error) throw error;
      return feedbackId;
    },
    onSuccess: (feedbackId) => {
      qc.invalidateQueries({ queryKey: feedbackKeys.detail(feedbackId) });
    },
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_feedback').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

export function useLogFeedbackEvent() {
  return useMutation({
    mutationFn: async ({ feedbackId, eventType, toValue }: { feedbackId: string; eventType: string; toValue?: string }) => {
      await logActivity(eventType, 'platform_feedback', feedbackId, { to: toValue ?? null });
    },
  });
}
