import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import { FEEDBACK_BUCKET, OPEN_STATUSES, CLOSED_STATUSES, type FeedbackStatus } from '@/lib/feedbackConstants';

export type FeedbackRow = Database['public']['Tables']['platform_feedback']['Row'];
export type FeedbackOverviewRow = Database['public']['Views']['platform_feedback_overview']['Row'];
export type FeedbackComment = Database['public']['Tables']['platform_feedback_comments']['Row'];
export type FeedbackEvent = Database['public']['Tables']['platform_feedback_events']['Row'];
export type FeedbackAttachment = Database['public']['Tables']['platform_feedback_attachments']['Row'];
export type PublicFeedbackItem = Database['public']['Functions']['list_public_feedback']['Returns'][number];

export const feedbackKeys = {
  mine: ['feedback', 'mine'] as const,
  list: ['feedback', 'list'] as const,
  detail: (id: string) => ['feedback', 'detail', id] as const,
  publicList: ['feedback', 'public'] as const,
  myVotes: ['feedback', 'my-votes'] as const,
  newCount: ['feedback', 'new-count'] as const,
};

/** Todos os reportes visíveis (reporter vê os seus, admins vêem tudo). */
export function useFeedbackList() {
  return useQuery({
    queryKey: feedbackKeys.list,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_feedback_overview')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedbackOverviewRow[];
    },
    staleTime: 15_000,
  });
}

export function useMyFeedback() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...feedbackKeys.mine, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_feedback_overview')
        .select('*')
        .eq('reported_by', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedbackOverviewRow[];
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

export function useFeedbackDetail(id: string | null) {
  return useQuery({
    queryKey: feedbackKeys.detail(id ?? 'none'),
    queryFn: async () => {
      const [item, comments, events, attachments] = await Promise.all([
        supabase.from('platform_feedback_overview').select('*').eq('id', id!).maybeSingle(),
        supabase.from('platform_feedback_comments').select('*').eq('feedback_id', id!).order('created_at'),
        supabase.from('platform_feedback_events').select('*').eq('feedback_id', id!).order('created_at'),
        supabase.from('platform_feedback_attachments').select('*').eq('feedback_id', id!).order('created_at'),
      ]);
      if (item.error) throw item.error;

      const files = (attachments.data ?? []) as FeedbackAttachment[];
      const signed: Record<string, string> = {};
      if (files.length) {
        const res = await supabase.storage
          .from(FEEDBACK_BUCKET)
          .createSignedUrls(files.map(f => f.storage_path), 3600);
        (res.data ?? []).forEach((s, i) => {
          if (s.signedUrl) signed[files[i].storage_path] = s.signedUrl;
        });
      }

      return {
        item: (item.data ?? null) as FeedbackOverviewRow | null,
        comments: (comments.data ?? []) as FeedbackComment[],
        events: (events.data ?? []) as FeedbackEvent[],
        attachments: files,
        signedUrls: signed,
      };
    },
    enabled: !!id,
  });
}

/** Lista mínima de reportes de colegas (abertos), para votação. */
export function usePublicFeedback() {
  return useQuery({
    queryKey: feedbackKeys.publicList,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_public_feedback');
      if (error) throw error;
      return (data ?? []) as PublicFeedbackItem[];
    },
    staleTime: 30_000,
  });
}

export function useMyVotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...feedbackKeys.myVotes, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_feedback_votes')
        .select('feedback_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return new Set((data ?? []).map(v => v.feedback_id));
    },
    enabled: !!user?.id,
  });
}

/** Contador de reportes em "new" para o badge da sidebar. */
export function useNewFeedbackCount() {
  const { isAdmin } = useAuth();
  const { data } = useQuery({
    queryKey: feedbackKeys.newCount,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('platform_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  return data ?? 0;
}

export interface FeedbackKPIs {
  open: number;
  openBySeverity: Record<string, number>;
  newThisWeek: number;
  newPrevWeek: number;
  avgResolutionDays: number | null;
  avgTriageDays: number | null;
  resolvedThisMonth: number;
  topModules: { module: string; count: number }[];
}

export function computeKPIs(rows: FeedbackOverviewRow[]): FeedbackKPIs {
  const now = new Date();
  const day = 86_400_000;
  const openRows = rows.filter(r => OPEN_STATUSES.includes(r.status as FeedbackStatus));

  const openBySeverity: Record<string, number> = {};
  openRows.forEach(r => {
    if (r.severity) openBySeverity[r.severity] = (openBySeverity[r.severity] ?? 0) + 1;
  });

  const weekAgo = new Date(now.getTime() - 7 * day);
  const twoWeeksAgo = new Date(now.getTime() - 14 * day);
  const newThisWeek = rows.filter(r => new Date(r.created_at!) >= weekAgo).length;
  const newPrevWeek = rows.filter(r => {
    const d = new Date(r.created_at!);
    return d >= twoWeeksAgo && d < weekAgo;
  }).length;

  const monthAgo = new Date(now.getTime() - 30 * day);
  const resolvedRecent = rows.filter(r => r.resolved_at && new Date(r.resolved_at) >= monthAgo);
  const avgResolutionDays = resolvedRecent.length
    ? resolvedRecent.reduce((s, r) => s + (new Date(r.resolved_at!).getTime() - new Date(r.created_at!).getTime()), 0)
      / resolvedRecent.length / day
    : null;

  const triagedRecent = rows.filter(r => r.triaged_at && new Date(r.triaged_at) >= monthAgo);
  const avgTriageDays = triagedRecent.length
    ? triagedRecent.reduce((s, r) => s + (new Date(r.triaged_at!).getTime() - new Date(r.created_at!).getTime()), 0)
      / triagedRecent.length / day
    : null;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const resolvedThisMonth = rows.filter(r => r.resolved_at && new Date(r.resolved_at) >= monthStart).length;

  const moduleCounts: Record<string, number> = {};
  openRows.filter(r => r.type === 'bug').forEach(r => {
    moduleCounts[r.module!] = (moduleCounts[r.module!] ?? 0) + 1;
  });
  const topModules = Object.entries(moduleCounts)
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    open: openRows.length,
    openBySeverity,
    newThisWeek,
    newPrevWeek,
    avgResolutionDays,
    avgTriageDays,
    resolvedThisMonth,
    topModules,
  };
}

export { OPEN_STATUSES, CLOSED_STATUSES };
