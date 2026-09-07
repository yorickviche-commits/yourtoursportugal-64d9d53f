import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { ReportDefinition, SavedReport, SavedReportCategory } from '@/types/reports';

export function useSavedReports(reportType = 'files') {
  return useQuery({
    queryKey: ['saved_reports', reportType],
    queryFn: async (): Promise<SavedReport[]> => {
      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('report_type', reportType)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as SavedReport[];
    },
    staleTime: 30_000,
  });
}

export interface SaveReportInput {
  id?: string;
  name: string;
  note?: string | null;
  category: SavedReportCategory;
  visibility: 'private' | 'team';
  definition: ReportDefinition;
  report_type?: string;
}

export function useSavedReportMutations(reportType = 'files') {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['saved_reports', reportType] });

  const create = useMutation({
    mutationFn: async (input: SaveReportInput) => {
      const { data, error } = await supabase
        .from('saved_reports')
        .insert({
          report_type: input.report_type || reportType,
          name: input.name,
          note: input.note ?? null,
          category: input.category,
          visibility: input.visibility,
          definition: input.definition as any,
          owner_id: user?.id ?? null,
          is_suggested: false,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as SavedReport;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (input: SaveReportInput & { id: string; updateDefinition?: boolean }) => {
      const patch: Record<string, any> = {
        name: input.name,
        note: input.note ?? null,
        category: input.category,
        visibility: input.visibility,
      };
      if (input.updateDefinition) patch.definition = input.definition as any;
      const { data, error } = await supabase
        .from('saved_reports')
        .update(patch)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as SavedReport;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_reports').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const it of items) {
        const { error } = await supabase
          .from('saved_reports')
          .update({ sort_order: it.sort_order })
          .eq('id', it.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder };
}
