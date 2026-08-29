import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AppRoleRow {
  code: string;
  label: string;
  is_system: boolean;
}

export interface InviteRow {
  id: string;
  email: string;
  role_code: string;
  status: string;
  expires_at: string;
  last_sent_at: string | null;
  created_at: string;
}

export const SYSTEM_ROLE_CODES = [
  'super_admin', 'admin', 'sales_agent', 'operations_agent', 'finance', 'b2b_manager', 'viewer',
] as const;

export const isEnumRole = (code: string) => (SYSTEM_ROLE_CODES as readonly string[]).includes(code);

/** Catálogo de roles (sistema + personalizados). */
export function useAppRoles() {
  return useQuery({
    queryKey: ['app_roles'],
    queryFn: async (): Promise<AppRoleRow[]> => {
      const { data, error } = await supabase
        .from('app_roles' as any)
        .select('code, label, is_system')
        .order('is_system', { ascending: false })
        .order('label');
      if (error) throw error;
      return (data as any[] as AppRoleRow[]) || [];
    },
    staleTime: 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ label, code }: { label: string; code?: string }) => {
      const slug = (code || label)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!slug) throw new Error('Nome de role inválido');
      const { error } = await supabase
        .from('app_roles' as any)
        .insert({ code: slug, label: label.trim(), is_system: false } as any);
      if (error) throw error;
      return slug;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app_roles'] });
      qc.invalidateQueries({ queryKey: ['permissions_matrix'] });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, label }: { code: string; label: string }) => {
      const { error } = await supabase.from('app_roles' as any).update({ label } as any).eq('code', code);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_roles'] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from('app_roles' as any).delete().eq('code', code).eq('is_system', false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app_roles'] });
      qc.invalidateQueries({ queryKey: ['permissions_matrix'] });
    },
  });
}

/** Convites pendentes. */
export function useInvites() {
  return useQuery({
    queryKey: ['user_invites'],
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await supabase
        .from('user_invites' as any)
        .select('id, email, role_code, status, expires_at, last_sent_at, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[] as InviteRow[]) || [];
    },
  });
}

export function useSendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role, appUrl: window.location.origin },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { emailSent: boolean; warning?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user_invites'] }),
  });
}

export function useCancelInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_invites' as any)
        .update({ status: 'cancelled' } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user_invites'] }),
  });
}

/** Substitui todos os roles de um utilizador pelo role escolhido. */
export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('user_custom_roles' as any).delete().eq('user_id', userId);

      if (isEnumRole(role)) {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: role as any });
        if (error) throw error;
      } else {
        // Roles personalizados precisam de uma role base no enum para passar as RLS existentes.
        const { error: baseError } = await supabase.from('user_roles').insert({ user_id: userId, role: 'viewer' as any });
        if (baseError) throw baseError;
        const { error } = await supabase
          .from('user_custom_roles' as any)
          .insert({ user_id: userId, role_code: role } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_users'] });
      qc.invalidateQueries({ queryKey: ['permissions_matrix'] });
    },
  });
}
