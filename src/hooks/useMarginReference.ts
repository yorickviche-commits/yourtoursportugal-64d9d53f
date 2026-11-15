import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { marginReferenceValue } from '@/lib/marginReference';

export const MARGIN_REFERENCE_QUERY_KEY = ['margin-reference'];

export function useMarginReference() {
  return useQuery({
    queryKey: MARGIN_REFERENCE_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('value')
        .eq('category', 'operations').eq('key', 'minimum_margin_threshold').maybeSingle();
      if (error) throw error;
      return marginReferenceValue(data?.value);
    },
    staleTime: 60_000,
  });
}