import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadCostingSummary {
  pvp: number;
  net: number;
  marginPct: number;
}

/** Aggregates PVP / Net / Margin from `lead_costing_data` (LIVE version per lead). */
export const useLeadsCostingSummary = (leadIds: string[]) => {
  return useQuery({
    queryKey: ['leads_costing_summary', [...leadIds].sort().join(',')],
    queryFn: async (): Promise<Record<string, LeadCostingSummary>> => {
      if (leadIds.length === 0) return {};
      const [{ data, error }, { data: leadRows, error: leadErr }] = await Promise.all([
        supabase.from('lead_costing_data').select('lead_id, version, items').in('lead_id', leadIds),
        supabase.from('leads').select('id, active_version').in('id', leadIds),
      ]);
      if (error) throw error;
      if (leadErr) throw leadErr;

      // The LIVE version is always `leads.active_version` (never max(version)).
      const liveByLead = new Map<string, number>();
      (leadRows || []).forEach((l: any) => liveByLead.set(l.id, l.active_version ?? 0));

      const out: Record<string, LeadCostingSummary> = {};
      (data || []).forEach((row: any) => {
        if (row.version !== (liveByLead.get(row.lead_id) ?? 0)) return;
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
