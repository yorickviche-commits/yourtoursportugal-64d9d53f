import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KPIFilters {
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface UserKPIs {
  proposalsSent: number;
  proposalsWon: number;
  proposalsLost: number;
  proposalsPending: number;
  totalVolume: number;
  confirmedVolume: number;
  avgMargin: number;
  conversionRate: number;
  monthly: { month: string; count: number; volume: number }[];
}

const emptyKPI: UserKPIs = {
  proposalsSent: 0, proposalsWon: 0, proposalsLost: 0, proposalsPending: 0,
  totalVolume: 0, confirmedVolume: 0, avgMargin: 0, conversionRate: 0, monthly: [],
};

function computeFromLeads(leads: any[]): UserKPIs {
  const won = leads.filter(l => l.status === 'won');
  const lost = leads.filter(l => l.status === 'lost' || l.status === 'rejected');
  const pending = leads.filter(l => !['won', 'lost', 'rejected'].includes(l.status));
  const totalVolume = leads.reduce((s, l) => s + (Number(l.pvp_override) || 0), 0);
  const confirmedVolume = won.reduce((s, l) => s + (Number(l.pvp_override) || 0), 0);
  const margins = leads.map(l => Number(l.margin_pct)).filter(n => !Number.isNaN(n) && n > 0);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 30;
  const monthlyMap = new Map<string, { count: number; volume: number }>();
  leads.forEach(l => {
    const d = new Date(l.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = monthlyMap.get(key) || { count: 0, volume: 0 };
    cur.count += 1;
    cur.volume += Number(l.pvp_override) || 0;
    monthlyMap.set(key, cur);
  });
  const monthly = Array.from(monthlyMap.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
  return {
    proposalsSent: leads.length,
    proposalsWon: won.length,
    proposalsLost: lost.length,
    proposalsPending: pending.length,
    totalVolume,
    confirmedVolume,
    avgMargin,
    conversionRate: leads.length ? (won.length / leads.length) * 100 : 0,
    monthly,
  };
}

async function fetchLeadsForUser(userId: string, filters: KPIFilters) {
  let q: any = supabase.from('leads').select('id, status, created_at, pvp_override, assigned_agents, created_by');
  q = q.or(`assigned_agents.cs.{${userId}},created_by.eq.${userId}`);
  if (filters.from) q = q.gte('created_at', filters.from);
  if (filters.to) q = q.lte('created_at', filters.to);
  const { data } = await q;
  return data || [];
}

export function useUserKPIs(userId: string | undefined, filters: KPIFilters) {
  return useQuery({
    queryKey: ['user-kpis', userId, filters],
    enabled: !!userId,
    queryFn: async (): Promise<UserKPIs> => {
      if (!userId) return emptyKPI;
      const leads = await fetchLeadsForUser(userId, filters);
      return computeFromLeads(leads);
    },
  });
}

export function useTeamKPIs(filters: KPIFilters) {
  return useQuery({
    queryKey: ['team-kpis', filters],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, email, avatar_url').in('id', ids);
      let q: any = supabase.from('leads').select('id, status, created_at, pvp_override, assigned_agents, created_by');
      if (filters.from) q = q.gte('created_at', filters.from);
      if (filters.to) q = q.lte('created_at', filters.to);
      const { data: leads = [] } = await q;
      return (profiles || []).map((p: any) => {
        const own = (leads || []).filter((l: any) =>
          (Array.isArray(l.assigned_agents) && l.assigned_agents.includes(p.id)) || l.created_by === p.id
        );
        return { user: p, kpis: computeFromLeads(own) };
      });
    },
  });
}
