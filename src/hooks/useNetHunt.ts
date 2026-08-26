import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Exact NetHunt stage options, grouped for the UI select. */
export const NETHUNT_STAGES = {
  SALES: [
    'SALES - New Lead',
    'SALES - - Budgeting & Fine-Tuning',
    'SALES - Final Negotiation & Ready to Book',
    'SALES - Archive',
  ],
  OPERATIONS: [
    'OPERATIONS - Deposit/Payment Received',
    'OPERATIONS - Suppliers Bookings & Confirmations',
    'OPERATIONS - Technical Briefing (Internal & Suppliers Final Validations)',
    'OPERATIONS - Trip Ready / In Execution',
    'OPERATIONS - Post-Trip Loop / Feedback',
    'OPERATIONS - Deferred / Postponed Trip',
    'OPERATIONS - Archive',
  ],
} as const;

export const SOURCE_OPTIONS = [
  { value: 'website', label: 'YT Website' },
  { value: 'ota', label: "OTA's" },
  { value: 'direct', label: 'Direct (Email/Phone/Sms)' },
  { value: 'partner', label: 'Partners & Resellers' },
];

const WORKSPACE_ID = '67bf55d388a689554e6a1c1b';
const DEALS_FOLDER = '67bf55d488a689554e6a1c22';

export function netHuntRecordUrl(recordId: string, folderId = DEALS_FOLDER) {
  const payload = JSON.stringify({
    workspaceId: WORKSPACE_ID,
    folderId,
    recordId,
    recordPage: { recordId },
  });
  return `https://nethunt.com/web/#nethunt/${btoa(payload)}`;
}

export interface TimelineEvent {
  id: string;
  lead_id: string | null;
  nethunt_record_id: string | null;
  event_id: string;
  event_type: string;
  event_time: string | null;
  pinned: boolean | null;
  creator_name: string | null;
  creator_email: string | null;
  subject: string | null;
  snippet: string | null;
  body_html: string | null;
  payload: any;
}

export interface NHTask {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  completed: boolean | null;
  all_day: boolean | null;
  due_at: string | null;
  due_date: string | null;
  assignee_emails: string[] | null;
  creator_email: string | null;
  lead_id: string | null;
  nethunt_record_id: string | null;
  nethunt_synced_at: string | null;
  created_at: string;
}

export const useLeadTimeline = (leadId?: string) =>
  useQuery({
    queryKey: ['nethunt-timeline', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nethunt_timeline')
        .select('*')
        .eq('lead_id', leadId!)
        .order('event_time', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as unknown as TimelineEvent[];
    },
  });

export const useNHTasks = (leadId?: string) =>
  useQuery({
    queryKey: ['nethunt-tasks', leadId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('*')
        .order('due_at', { ascending: true, nullsFirst: false });
      if (leadId) q = q.eq('lead_id', leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as NHTask[];
    },
  });

type PushEntity = 'lead' | 'task' | 'comment' | 'task_create' | 'task_complete';

async function push(entity: PushEntity, id: string | null, changes: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('nethunt-push', {
    body: { entity, id, changes },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

/** Updates the lead locally and immediately mirrors the change to NetHunt. */
export const usePushLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Record<string, unknown> }) => {
      const { error } = await supabase.from('leads').update(changes as any).eq('id', id);
      if (error) throw error;
      return push('lead', id, changes);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['lead', v.id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
};

export const useAddComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, text }: { leadId: string; text: string }) =>
      push('comment', leadId, { text }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['nethunt-timeline', v.leadId] }),
  });
};

export const useCreateNHTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (changes: Record<string, unknown>) => push('task_create', null, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nethunt-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useUpdateNHTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Record<string, unknown> }) =>
      push('task', id, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nethunt-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

/** Gmail history for a lead (NetHunt's API does not expose emails). */
export interface GmailItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  date: string;
  direction: 'IN' | 'OUT';
  url: string;
}

export const useLeadGmail = (email?: string | null, ytId?: string | null) =>
  useQuery({
    queryKey: ['lead-gmail', email ?? '', ytId ?? ''],
    enabled: !!(email || ytId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-record-emails', {
        body: { emails: email ? [email] : [], queries: ytId ? [ytId] : [], limit: 30 },
      });
      if (error) throw error;
      return ((data as any)?.emails || []) as GmailItem[];
    },
  });

export async function fetchGmailBody(messageId: string) {
  const { data, error } = await supabase.functions.invoke('gmail-record-emails', {
    body: { messageId },
  });
  if (error) throw error;
  return ((data as any)?.body_html || '') as string;
}

/** Triggers an immediate NetHunt → Lovable pull. */
export const useSyncNow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('nethunt-pull', { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nethunt-timeline'] });
      qc.invalidateQueries({ queryKey: ['nethunt-tasks'] });
      qc.invalidateQueries({ queryKey: ['lead-gmail'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
};

/** Force a full timeline sync for a single linked lead. */
export const useSyncLeadFull = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, leadId }: { recordId: string; leadId: string }) => {
      const { data, error } = await supabase.functions.invoke('nethunt-pull', {
        body: { recordId, fullTimeline: true, folder: 'deals' },
      });
      if (error) throw error;
      return data as { ok: boolean; deals?: number; timeline?: { leads?: number; counts?: Record<string, number> }; error?: string };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['nethunt-timeline', v.leadId] });
      qc.invalidateQueries({ queryKey: ['lead-gmail', v.leadId] });
      qc.invalidateQueries({ queryKey: ['lead-crm', v.leadId] });
      qc.invalidateQueries({ queryKey: ['nethunt-sync-log', v.leadId] });
    },
  });
};

export interface SyncLogEntry {
  id: string;
  direction: string;
  entity: string;
  action: string;
  status: string;
  detail: any;
  created_at: string;
}

/** Recent sync log entries for a lead (useful for diagnostics). */
export const useLeadSyncLog = (leadId?: string) =>
  useQuery({
    queryKey: ['nethunt-sync-log', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nethunt_sync_log')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as SyncLogEntry[];
    },
  });

/** Render a NetHunt field_change payload as readable text. */
export function describeFieldChange(payload: any): { title: string; lines: string[] } {
  const fa = payload?.fieldActions as Record<string, any> | undefined;
  if (!fa || typeof fa !== 'object') return { title: 'Alteração de registo', lines: [] };
  const lines: string[] = [];
  for (const [field, action] of Object.entries(fa)) {
    const a = action as any;
    const oldVal = a?.remove ?? a?.set ?? null;
    const newVal = a?.add ?? a?.set ?? null;
    const oldText = oldVal === null || oldVal === undefined ? '—' : String(oldVal);
    const newText = newVal === null || newVal === undefined ? '—' : String(newVal);
    lines.push(`${field}: ${oldText} → ${newText}`);
  }
  const firstField = Object.keys(fa)[0];
  return { title: firstField ? `${firstField} alterado` : 'Alteração de registo', lines };
}
