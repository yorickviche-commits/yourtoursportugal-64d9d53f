import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InternalUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function useInternalUsers() {
  return useQuery({
    queryKey: ['internal-users'],
    queryFn: async (): Promise<InternalUser[]> => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', ids);
      return (profiles || []) as InternalUser[];
    },
    staleTime: 60_000,
  });
}
