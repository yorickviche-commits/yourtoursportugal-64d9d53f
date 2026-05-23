import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PhotoScope =
  | { type: 'lead'; id: string }
  | { type: 'proposal'; id: string };

/**
 * Returns helpers to read and write the used_photos registry.
 * Scope is either a lead_id or proposal_id — never both.
 */
export function useUsedPhotos(scope: PhotoScope) {
  const scopeColumn = scope.type === 'lead' ? 'lead_id' : 'proposal_id';
  const scopeId = scope.id;

  const getUsedPhotoIds = useCallback(async (): Promise<string[]> => {
    if (!scopeId) return [];
    const { data, error } = await supabase
      .from('used_photos')
      .select('photo_id')
      .eq(scopeColumn, scopeId);
    if (error) {
      console.error('useUsedPhotos.getUsedPhotoIds error:', error.message);
      return [];
    }
    return (data || []).map((r: any) => r.photo_id);
  }, [scopeColumn, scopeId]);

  const registerPhotos = useCallback(async (
    photos: { photo_id: string; photo_url: string; used_in: string }[]
  ): Promise<void> => {
    if (!scopeId || photos.length === 0) return;
    const rows = photos.map(p => ({
      [scopeColumn]: scopeId,
      photo_id: p.photo_id,
      photo_url: p.photo_url,
      used_in: p.used_in,
    }));
    const { error } = await supabase
      .from('used_photos')
      .upsert(rows as any, { onConflict: `${scopeColumn},photo_id`, ignoreDuplicates: true });
    if (error) console.error('useUsedPhotos.registerPhotos error:', error.message);
  }, [scopeColumn, scopeId]);

  const clearUsedPhotos = useCallback(async (): Promise<void> => {
    if (!scopeId) return;
    const { error } = await supabase
      .from('used_photos')
      .delete()
      .eq(scopeColumn, scopeId);
    if (error) console.error('useUsedPhotos.clearUsedPhotos error:', error.message);
  }, [scopeColumn, scopeId]);

  return { getUsedPhotoIds, registerPhotos, clearUsedPhotos };
}

/** Extract photo ID from Unsplash URL (client-side mirror of edge function helper) */
export function extractPhotoId(url: string): string {
  const match = url.match(/photo-([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url.slice(-16);
}
