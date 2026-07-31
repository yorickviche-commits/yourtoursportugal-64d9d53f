import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MagpieListParams {
  page: number;
  limit: number;
  location?: string;
  account_id?: string;
  search?: string;
}

export interface MagpieCatalogProduct {
  magpie_id: string;
  name?: string;
  category?: string | null;
  location?: string | null;
  duration?: unknown;
  currency?: string | null;
  internal_id?: string | null;
  gallery?: string[];
  image_url?: string | null;
  account?: { id?: string; name?: string } | null;
  already_imported: boolean;
  [key: string]: unknown;
}

export interface MagpieListResponse {
  products: MagpieCatalogProduct[];
  categories: string[];
  locations: (string | null)[];
  pagination: {
    limit_value: number;
    total_pages: number;
    current_page: number;
    next_page: number | null;
    prev_page: number | null;
  };
}

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Surface the readable message the function returned when available.
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json();
        if (payload?.error) message = payload.error;
      } catch {
        /* keep original */
      }
    }
    throw new Error(message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function useMagpieCatalog(params: MagpieListParams) {
  return useQuery({
    queryKey: ['magpie_catalog', params],
    queryFn: () => invoke<MagpieListResponse>('magpie-list', params),
    staleTime: 60_000,
  });
}

export interface SyncResult {
  requested: number;
  succeeded: number;
  failed: number;
  results: { magpie_id: string; ok: boolean; action?: string; error?: string }[];
}

export function useMagpieImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (magpie_ids: string[]) => invoke<SyncResult>('magpie-import', { magpie_ids }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['magpie_catalog'] });
      qc.invalidateQueries({ queryKey: ['magpie_products'] });
      qc.invalidateQueries({ queryKey: ['magpie_sync_log'] });
      if (res.failed > 0) {
        toast.warning(`${res.succeeded} importado(s), ${res.failed} com erro`);
      } else {
        toast.success(`${res.succeeded} produto(s) importado(s)`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMagpieRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (magpie_ids?: string[]) =>
      invoke<SyncResult>('magpie-refresh', magpie_ids?.length ? { magpie_ids } : {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['magpie_products'] });
      qc.invalidateQueries({ queryKey: ['magpie_sync_log'] });
      if (res.failed > 0) toast.warning(`${res.succeeded} atualizado(s), ${res.failed} com erro`);
      else toast.success(`${res.succeeded} produto(s) sincronizado(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface ImportedProduct {
  id: string;
  magpie_id: string;
  name: string;
  category: string | null;
  location: string | null;
  currency: string | null;
  duration_text: string | null;
  account_name: string | null;
  availability_status: string;
  last_synced_at: string | null;
  sync_status: string;
  sync_error: string | null;
  images: unknown;
  retail_rate_adult: number | null;
  product_local: ProductLocal[] | ProductLocal | null;
  [key: string]: unknown;
}

export interface ProductLocal {
  id: string;
  magpie_id: string;
  workflow_status: string;
  is_visible: boolean;
  internal_tags: string[];
  commercial_notes: string | null;
  custom_title: string | null;
  custom_summary: string | null;
  sort_weight: number;
}

export function useImportedProducts() {
  return useQuery({
    queryKey: ['magpie_products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('magpie_products')
        .select('*, product_local(*)')
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as ImportedProduct[];
    },
  });
}

export function useImportedProduct(magpieId?: string) {
  return useQuery({
    queryKey: ['magpie_product', magpieId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('magpie_products')
        .select('*, product_local(*)')
        .eq('magpie_id', magpieId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ImportedProduct | null;
    },
    enabled: !!magpieId,
  });
}

export function useSaveProductLocal(magpieId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<ProductLocal>) => {
      const { error } = await supabase
        .from('product_local')
        .upsert({ magpie_id: magpieId, ...values }, { onConflict: 'magpie_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['magpie_product', magpieId] });
      qc.invalidateQueries({ queryKey: ['magpie_products'] });
      toast.success('Dados internos guardados');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface SyncLogRow {
  id: string;
  run_type: string;
  started_at: string;
  finished_at: string | null;
  products_requested: number;
  products_succeeded: number;
  products_failed: number;
  http_status: number | null;
  error_message: string | null;
  details: unknown;
}

export function useSyncLog() {
  return useQuery({
    queryKey: ['magpie_sync_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('magpie_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SyncLogRow[];
    },
  });
}

/** Extracts the first usable image URL from the normalized images jsonb. */
export function firstImage(images: unknown): string | null {
  if (Array.isArray(images)) {
    for (const img of images) {
      if (typeof img === 'string') return img;
      const url = (img as { url?: string; ttd_url?: string })?.url ?? (img as { ttd_url?: string })?.ttd_url;
      if (url) return url;
    }
  }
  return null;
}

export function local(p: ImportedProduct): ProductLocal | null {
  const l = p.product_local;
  if (!l) return null;
  return Array.isArray(l) ? (l[0] ?? null) : l;
}
