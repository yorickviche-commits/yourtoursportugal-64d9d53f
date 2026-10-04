import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Country = 'PT' | 'ES';
export const COUNTRY_LABELS: Record<Country, string> = { PT: 'Portugal', ES: 'Espanha' };

export interface RegionDestination { id: string; region_id: string; name: string; sort_order: number; is_active: boolean }
export interface Region {
  id: string; code: string; name: string; slug: string | null; country: Country;
  sort_order: number; is_active: boolean; hero_image_url: string | null;
  destinations: RegionDestination[];
}

/** Single source of truth for regions (PT + ES) and their cities. */
export function useRegions(opts: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['regions_all', !!opts.includeInactive],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Region[]> => {
      let q = supabase.from('regions').select('*').order('sort_order');
      if (!opts.includeInactive) q = q.eq('is_active', true);
      const [{ data: regs, error }, { data: dests, error: e2 }] = await Promise.all([
        q,
        supabase.from('region_destinations').select('*').order('sort_order'),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      return (regs || []).map((r: any) => ({
        ...r,
        country: (r.country || 'PT') as Country,
        destinations: (dests || []).filter((d: any) => d.region_id === r.id && (opts.includeInactive || d.is_active)),
      }));
    },
  });
}
