import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { ReportField, ReportType, OptionsSource } from '@/types/reports';

/** Menu do builder: campos disponíveis para um tipo de relatório. */
export function useReportFields(reportType: ReportType = 'files') {
  return useQuery({
    queryKey: ['report_fields', reportType],
    queryFn: async (): Promise<ReportField[]> => {
      const { data, error } = await supabase
        .from('report_fields')
        .select('*')
        .eq('report_type', reportType)
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as ReportField[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Acesso a colunas financeiras (o servidor é a verdade; isto só limpa a UI). */
export function useFinancialAccess() {
  const { roleCodes, isAdmin, user } = useAuth();
  const query = useQuery({
    queryKey: ['permissions_financial'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('role, permission, granted')
        .eq('permission', 'access_financial_reports');
      if (error) throw error;
      return data as { role: string; permission: string; granted: boolean }[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const canSeeFinancial = isAdmin
    ? true
    : (query.data || []).some(p => p.granted && roleCodes.includes(p.role));

  return { canSeeFinancial, loading: query.isLoading };
}

/** Opções de valores para um filtro, de acordo com options_source. */
export function useFieldOptions(field: ReportField | null | undefined) {
  const source = (field?.options_source || null) as OptionsSource;
  const type = source?.type ?? 'free';

  return useQuery({
    queryKey: ['report_field_options', field?.key, type],
    enabled: !!field && (type === 'enum' || type === 'table' || type === 'distinct'),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ value: string; label: string }[]> => {
      if (!source) return [];
      if (source.type === 'enum') {
        return source.values.map(v => ({ value: v, label: v }));
      }
      if (source.type === 'table') {
        const cols = Array.from(new Set([source.value, source.label])).join(', ');
        let q = supabase.from(source.table as any).select(cols);
        if (source.order) q = q.order(source.order as string, { ascending: true, nullsFirst: false });
        const { data, error } = await q.limit(1000);
        if (error) throw error;
        return ((data || []) as any[])
          .map(r => ({ value: String(r[source.value] ?? ''), label: String(r[source.label] ?? r[source.value] ?? '') }))
          .filter(o => o.value !== '');
      }
      // distinct → valores distintos na view rpt_files
      const { data, error } = await supabase
        .from('rpt_files' as any)
        .select(field!.key)
        .limit(5000);
      if (error) throw error;
      const set = new Set<string>();
      ((data || []) as any[]).forEach(r => {
        const v = r[field!.key];
        if (v === null || v === undefined || v === '') return;
        if (Array.isArray(v)) v.forEach(x => set.add(String(x)));
        else String(v).split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt')).map(v => ({ value: v, label: v }));
    },
  });
}
