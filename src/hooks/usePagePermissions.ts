import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PAGES, PageKey, permKey } from '@/lib/pagePermissions';

/**
 * Resolves which pages the current user can access based on their roles
 * combined with the role→page matrix in `permissions`.
 * super_admin and admin bypass the matrix (full access).
 */
export function usePagePermissions() {
  const { roles, roleCodes, user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['permissions_matrix'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('role, permission, granted');
      if (error) throw error;
      return data as { role: string; permission: string; granted: boolean }[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isAdmin = roles.includes('super_admin') || roles.includes('admin');

  const canAccess = (page: PageKey): boolean => {
    if (authLoading) return false;
    if (isAdmin) return true;
    if (!query.data) return false;
    const key = permKey(page);
    // Any role granting the page unlocks it.
    return roles.some(r => query.data!.some(p => p.role === r && p.permission === key && p.granted));
  };

  const allowedPages = PAGES.filter(p => canAccess(p.key)).map(p => p.key);

  return {
    canAccess,
    allowedPages,
    isAdmin,
    loading: authLoading || query.isLoading,
  };
}
