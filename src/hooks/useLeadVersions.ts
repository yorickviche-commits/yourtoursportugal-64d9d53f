import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbLeadVersion {
  id: string;
  lead_id: string;
  version: number;
  name: string;
  general_data: Record<string, any>;
  created_at: string;
}

/** Fields of `leads` that belong to "Dados Gerais" and are snapshotted per version. */
export const GENERAL_FIELDS = [
  'yt_id', 'client_name', 'email', 'phone', 'client_type', 'destination',
  'travel_dates', 'travel_end_date', 'number_of_days', 'dates_type',
  'pax', 'pax_children', 'pax_infants', 'budget_level', 'notes', 'sales_owner',
  'status', 'comfort_level', 'travel_style', 'source',
] as const;

export const pickGeneralData = (lead: any): Record<string, any> => {
  const out: Record<string, any> = {};
  GENERAL_FIELDS.forEach(k => { out[k] = (lead ?? {})[k] ?? null; });
  return out;
};

export const useLeadVersionsQuery = (leadId: string | undefined) =>
  useQuery({
    queryKey: ['lead_versions', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_versions')
        .select('*')
        .eq('lead_id', leadId!)
        .order('version', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DbLeadVersion[];
    },
    enabled: !!leadId,
  });

const invalidateLead = (qc: ReturnType<typeof useQueryClient>, leadId: string) => {
  qc.invalidateQueries({ queryKey: ['lead_versions', leadId] });
  qc.invalidateQueries({ queryKey: ['leads'] });
  qc.invalidateQueries({ queryKey: ['lead_planner', leadId] });
  qc.invalidateQueries({ queryKey: ['lead_costing', leadId] });
  qc.invalidateQueries({ queryKey: ['travel_plan', leadId] });
  qc.invalidateQueries({ queryKey: ['lead_costing_data_proposal', leadId] });
  qc.invalidateQueries({ queryKey: ['leads_costing_summary'] });
};

/** Creates version N+1 as a full copy of the live version (general data, planner, costing, travel plan). */
export const useCreateLeadVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, fromVersion }: { leadId: string; fromVersion: number }) => {
      const [{ data: leadRow, error: leadErr }, { data: versions }] = await Promise.all([
        supabase.from('leads').select('*').eq('id', leadId).single(),
        supabase.from('lead_versions').select('version').eq('lead_id', leadId),
      ]);
      if (leadErr) throw leadErr;
      const maxExisting = (versions || []).reduce((m: number, r: any) => Math.max(m, r.version), fromVersion);
      const newVersion = maxExisting + 1;

      const [planner, costing, plans] = await Promise.all([
        supabase.from('lead_planner_data').select('*').eq('lead_id', leadId).eq('version', fromVersion),
        supabase.from('lead_costing_data').select('*').eq('lead_id', leadId).eq('version', fromVersion),
        supabase.from('travel_plans').select('*').eq('lead_id', leadId).eq('version', fromVersion),
      ]);

      const strip = (rows: any[] | null) =>
        (rows || []).map(({ id: _id, created_at, updated_at, created_by, ...rest }: any) => ({
          ...rest, lead_id: leadId, version: newVersion,
        }));

      const ins = await Promise.all([
        supabase.from('lead_versions').insert({
          lead_id: leadId, version: newVersion, name: `V${newVersion}`,
          general_data: pickGeneralData(leadRow) as any,
        } as any),
        strip(planner.data).length ? supabase.from('lead_planner_data').insert(strip(planner.data) as any) : Promise.resolve({ error: null } as any),
        strip(costing.data).length ? supabase.from('lead_costing_data').insert(strip(costing.data) as any) : Promise.resolve({ error: null } as any),
        strip(plans.data).length ? supabase.from('travel_plans').insert(strip(plans.data) as any) : Promise.resolve({ error: null } as any),
      ]);
      const failed = ins.find((r: any) => r?.error);
      if (failed?.error) throw failed.error;

      const { error: upErr } = await supabase.from('leads').update({ active_version: newVersion } as any).eq('id', leadId);
      if (upErr) throw upErr;
      return newVersion;
    },
    onSuccess: (_v, vars) => invalidateLead(qc, vars.leadId),
  });
};

export const useRenameLeadVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, version, name }: { leadId: string; version: number; name: string }) => {
      const { error } = await supabase
        .from('lead_versions').update({ name } as any)
        .eq('lead_id', leadId).eq('version', version);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['lead_versions', vars.leadId] }),
  });
};

/** Deletes the most recent version and makes the previous one live again. */
export const useDeleteLeadVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, version }: { leadId: string; version: number }) => {
      if (version <= 0) throw new Error('A versão base (V0) não pode ser apagada.');
      const prev = version - 1;

      const del = await Promise.all([
        supabase.from('lead_planner_data').delete().eq('lead_id', leadId).eq('version', version),
        supabase.from('lead_costing_data').delete().eq('lead_id', leadId).eq('version', version),
        supabase.from('travel_plans').delete().eq('lead_id', leadId).eq('version', version),
        supabase.from('lead_versions').delete().eq('lead_id', leadId).eq('version', version),
      ]);
      const failed = del.find((r: any) => r?.error);
      if (failed?.error) throw failed.error;

      // Restore the general fields of the lead from the version that becomes live.
      const { data: prevRow } = await supabase
        .from('lead_versions').select('general_data')
        .eq('lead_id', leadId).eq('version', prev).maybeSingle();
      const general = ((prevRow as any)?.general_data ?? {}) as Record<string, any>;
      const restore: Record<string, any> = { active_version: prev };
      GENERAL_FIELDS.forEach(k => {
        if (general[k] !== undefined && general[k] !== null) restore[k] = general[k];
      });
      const { error } = await supabase.from('leads').update(restore as any).eq('id', leadId);
      if (error) throw error;
      return prev;
    },
    onSuccess: (_d, vars) => {
      invalidateLead(qc, vars.leadId);
      qc.invalidateQueries({ queryKey: ['leads', vars.leadId] });
    },
  });
};

/** Writes the general-data snapshot of a specific version. */
export const saveVersionGeneralData = async (leadId: string, version: number, general: Record<string, any>) => {
  const { data } = await supabase
    .from('lead_versions').select('id').eq('lead_id', leadId).eq('version', version).maybeSingle();
  if (data) {
    const { error } = await supabase.from('lead_versions').update({ general_data: general as any } as any).eq('id', (data as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('lead_versions')
      .insert({ lead_id: leadId, version, name: `V${version}`, general_data: general as any } as any);
    if (error) throw error;
  }
};
