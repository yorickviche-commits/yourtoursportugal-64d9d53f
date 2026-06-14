import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadCostingSummary {
  pvp: number;
  net: number;
  marginPct: number;
}

/** Aggregates PVP / Net / Margin from `lead_costing_data` (latest version per lead). */
export const useLeadsCostingSummary = (leadIds: string[]) => {
  return useQuery({
    queryKey: ['leads_costing_summary', [...leadIds].sort().join(',')],
    queryFn: async (): Promise<Record<string, LeadCostingSummary>> => {
      if (leadIds.length === 0) return {};
      const { data, error } = await supabase
        .from('lead_costing_data')
        .select('lead_id, version, items')
        .in('lead_id', leadIds);
      if (error) throw error;

      // Pick latest version per lead.
      const latestByLead = new Map<string, number>();
      (data || []).forEach((row: any) => {
        const cur = latestByLead.get(row.lead_id);
        if (cur == null || row.version > cur) latestByLead.set(row.lead_id, row.version);
      });

      const out: Record<string, LeadCostingSummary> = {};
      (data || []).forEach((row: any) => {
        if (row.version !== latestByLead.get(row.lead_id)) return;
        const items = Array.isArray(row.items) ? row.items : [];
        const agg = out[row.lead_id] || { pvp: 0, net: 0, marginPct: 0 };
        for (const it of items) {
          if (it?.status === 'eliminar') continue;
          agg.pvp += Number(it?.pvpTotal) || 0;
          agg.net += Number(it?.netTotal) || 0;
        }
        out[row.lead_id] = agg;
      });

      // Compute margin%
      Object.values(out).forEach(s => {
        s.marginPct = s.net > 0 ? ((s.pvp - s.net) / s.net) * 100 : 0;
      });
      return out;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });
};
