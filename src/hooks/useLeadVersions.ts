import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildProposalToken } from '@/lib/proposalVersion';

export interface DbLeadVersion {
  id: string;
  lead_id: string;
  version: number;
  name: string;
  general_data: Record<string, any>;
  created_at: string;
  is_ai_proposal?: boolean;
  proposed_by_label?: string | null;
  proposed_at?: string | null;
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
  qc.invalidateQueries({ queryKey: ['proposals'] });
  qc.invalidateQueries({ queryKey: ['proposals_list'] });
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

      // Duplicar a proposta/itinerário digital da versão de origem, com
      // public_token NOVO e em rascunho — o link antigo fica congelado.
      const { data: srcProposal } = await supabase
        .from('proposals').select('*').eq('lead_id', leadId).eq('version', fromVersion).maybeSingle();
      if (srcProposal) {
        const {
          id: _pid, created_at: _pc, updated_at: _pu, created_by: _pb,
          public_token: _pt, sent_at: _ps, approved_at: _pa, ...rest
        } = srcProposal as any;
        const { error: pErr } = await supabase.from('proposals').insert({
          ...rest,
          lead_id: leadId,
          version: newVersion,
          public_token: buildProposalToken((leadRow as any)?.yt_id || (leadRow as any)?.lead_code || 'ytp', newVersion),
          status: 'draft',
          sent_at: null,
          approved_at: null,
        } as any);
        if (pErr) throw pErr;
      }

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
      const [{ data: allVers }, { data: leadNow }] = await Promise.all([
        supabase.from('lead_versions').select('version,is_ai_proposal').eq('lead_id', leadId),
        supabase.from('leads').select('active_version').eq('id', leadId).maybeSingle(),
      ]);
      const target = (allVers || []).find((r: any) => r.version === version) as any;
      const isProposal = !!target?.is_ai_proposal;
      // Propostas AI nunca são LIVE: a versão LIVE mantém-se ao apagar uma.
      const prev = isProposal
        ? Number((leadNow as any)?.active_version ?? 0)
        : (allVers || []).filter((r: any) => !r.is_ai_proposal && r.version < version)
            .reduce((m: number, r: any) => Math.max(m, r.version), 0);

      // Proposta desta versão (+ anotações) desaparece com a versão.
      const { data: propRow } = await supabase
        .from('proposals').select('id').eq('lead_id', leadId).eq('version', version).maybeSingle();
      if (propRow) {
        await supabase.from('proposal_annotations').delete().eq('proposal_id', (propRow as any).id);
        const { error: pdErr } = await supabase.from('proposals').delete().eq('id', (propRow as any).id);
        if (pdErr) throw pdErr;
      }

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
      if (isProposal) return prev;
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

/** Per-version context fields (routes, exact PDF, manual PVP). `lead_versions` is the source of truth; `leads` mirrors the LIVE version. */
export const VERSION_CONTEXT_FIELDS = ['route_map_url', 'route_day_maps', 'route_map_path', 'exact_itinerary_pdf_path', 'pvp_override'] as const;

export const pickVersionContext = (row: any): Record<string, any> => {
  const out: Record<string, any> = {};
  VERSION_CONTEXT_FIELDS.forEach(k => { out[k] = (row ?? {})[k] ?? (k === 'route_day_maps' ? [] : null); });
  return out;
};

/** Saves context fields of ONE version; mirrors to `leads` only when it is the LIVE version. */
export const saveVersionContext = async (leadId: string, version: number, patch: Record<string, any>, isLive: boolean) => {
  const { error } = await supabase.from('lead_versions')
    .upsert({ lead_id: leadId, version, ...patch } as any, { onConflict: 'lead_id,version', ignoreDuplicates: false });
  if (error) throw error;
  if (isLive) {
    const { error: lErr } = await supabase.from('leads').update(patch as any).eq('id', leadId);
    if (lErr) throw lErr;
  }
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

/** Promotes an AI proposal to LIVE (humans only — enforced server-side). */
export const usePromoteAiProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, version }: { leadId: string; version: number }) => {
      const { error } = await supabase.rpc('promote_ai_proposal' as any, { p_lead_id: leadId, p_version: version } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidateLead(qc, vars.leadId);
      qc.invalidateQueries({ queryKey: ['leads', vars.leadId] });
    },
  });
};
