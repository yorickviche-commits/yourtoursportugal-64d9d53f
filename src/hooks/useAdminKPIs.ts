import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Period = '7d' | '30d' | '90d' | 'year';

export function periodToRange(period: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (period === '7d') from.setDate(from.getDate() - 7);
  else if (period === '30d') from.setDate(from.getDate() - 30);
  else if (period === '90d') from.setDate(from.getDate() - 90);
  else if (period === 'year') { from.setMonth(0, 1); from.setHours(0, 0, 0, 0); }
  return { from: from.toISOString(), to: to.toISOString() };
}

export interface KPIFilterState {
  period: Period;
  agentId?: string;
}

const REFUND_KIND_MATCH = /refund/i;

export type KPIValue = number | null;

export interface SalesKPIs {
  leadsRecebidos: KPIValue;
  leadsConvertidos: KPIValue;
  tempoMedioRespostaHoras: KPIValue;
  revenueGerado: KPIValue;
  taxaConversao: KPIValue;
  aprovacaoPropostas: KPIValue;
}

export interface OperationsKPIs {
  tripsCriados: KPIValue;
  errosSinalizados: KPIValue;
  draftsWeTravel: KPIValue;
  desviosCustoOperacional: KPIValue;
}

export interface FinanceKPIs {
  revenueCobrado: KPIValue;
  pagamentosPendentes: KPIValue;
  linksWeTravelGerados: KPIValue;
  reembolsos: KPIValue;
}

export interface B2BKPIs {
  parceirosOnboarded: KPIValue;
  dealsFechados: KPIValue;
  valorMedioDeal: KPIValue;
}

export function useSalesKPIs({ period, agentId }: KPIFilterState) {
  const { from, to } = periodToRange(period);
  return useQuery({
    queryKey: ['admin-kpis-sales', period, agentId],
    queryFn: async (): Promise<SalesKPIs> => {
      let leadsQuery = supabase
        .from('leads')
        .select('id, status, created_at, pvp_override, assigned_agents, created_by')
        .gte('created_at', from)
        .lte('created_at', to);
      if (agentId) leadsQuery = leadsQuery.or(`assigned_agents.cs.{${agentId}},created_by.eq.${agentId}`);
      const { data: leads, error } = await leadsQuery;
      if (error) throw error;

      let proposalsQuery = supabase
        .from('proposals')
        .select('id, sent_at, approved_at, created_at, created_by')
        .gte('created_at', from)
        .lte('created_at', to);
      if (agentId) proposalsQuery = proposalsQuery.eq('created_by', agentId);
      const { data: proposals, error: pErr } = await proposalsQuery;
      if (pErr) throw pErr;

      const all = leads || [];
      const won = all.filter((l) => l.status === 'won');
      const revenueGerado = won.reduce((s, l) => s + (Number(l.pvp_override) || 0), 0);

      const sent = (proposals || []).filter((p) => !!p.sent_at);
      const approved = sent.filter((p) => !!p.approved_at);

      return {
        leadsRecebidos: all.length,
        leadsConvertidos: won.length,
        tempoMedioRespostaHoras: null,
        revenueGerado,
        taxaConversao: all.length ? (won.length / all.length) * 100 : 0,
        aprovacaoPropostas: sent.length ? (approved.length / sent.length) * 100 : null,
      };
    },
  });
}

export function useOperationsKPIs({ period, agentId }: KPIFilterState) {
  const { from, to } = periodToRange(period);
  return useQuery({
    queryKey: ['admin-kpis-operations', period, agentId],
    queryFn: async (): Promise<OperationsKPIs> => {
      let tripsQuery = supabase
        .from('trips')
        .select('id, created_at, has_blocker, created_by')
        .gte('created_at', from)
        .lte('created_at', to);
      if (agentId) tripsQuery = tripsQuery.eq('created_by', agentId);
      const { data: trips, error } = await tripsQuery;
      if (error) throw error;

      let linksQuery = supabase
        .from('payment_links')
        .select('id, status, created_at, created_by')
        .gte('created_at', from)
        .lte('created_at', to);
      if (agentId) linksQuery = linksQuery.eq('created_by', agentId);
      const { data: links, error: lErr } = await linksQuery;
      if (lErr) throw lErr;

      const allTrips = trips || [];
      const drafts = (links || []).filter((l) => l.status === 'draft');

      return {
        tripsCriados: allTrips.length,
        errosSinalizados: allTrips.filter((t) => t.has_blocker).length,
        draftsWeTravel: drafts.length,
        desviosCustoOperacional: null,
      };
    },
  });
}

export function useFinanceKPIs({ period, agentId }: KPIFilterState) {
  const { from, to } = periodToRange(period);
  return useQuery({
    queryKey: ['admin-kpis-finance', period, agentId],
    queryFn: async (): Promise<FinanceKPIs> => {
      let paymentsQuery = supabase
        .from('lead_payments')
        .select('id, amount, kind, paid_at, created_by')
        .gte('paid_at', from)
        .lte('paid_at', to);
      if (agentId) paymentsQuery = paymentsQuery.eq('created_by', agentId);
      const { data: payments, error } = await paymentsQuery;
      if (error) throw error;

      let linksQuery = supabase
        .from('payment_links')
        .select('id, status, is_active, created_at, created_by')
        .gte('created_at', from)
        .lte('created_at', to);
      if (agentId) linksQuery = linksQuery.eq('created_by', agentId);
      const { data: links, error: lErr } = await linksQuery;
      if (lErr) throw lErr;

      const allPayments = payments || [];
      const refunds = allPayments.filter((p) => REFUND_KIND_MATCH.test(p.kind || ''));
      const collected = allPayments.filter((p) => !REFUND_KIND_MATCH.test(p.kind || ''));

      const allLinks = links || [];
      const pendentes = allLinks.filter((l) => l.status === 'published' && l.is_active);

      return {
        revenueCobrado: collected.reduce((s, p) => s + (Number(p.amount) || 0), 0),
        pagamentosPendentes: pendentes.length,
        linksWeTravelGerados: allLinks.length,
        reembolsos: refunds.reduce((s, p) => s + (Number(p.amount) || 0), 0),
      };
    },
  });
}

export function useB2BKPIs({ period, agentId }: KPIFilterState) {
  const { from, to } = periodToRange(period);
  return useQuery({
    queryKey: ['admin-kpis-b2b', period, agentId],
    queryFn: async (): Promise<B2BKPIs> => {
      let partnersQuery = supabase
        .from('partners')
        .select('id, created_at, created_by')
        .gte('created_at', from)
        .lte('created_at', to);
      if (agentId) partnersQuery = partnersQuery.eq('created_by', agentId);
      const { data: partners, error } = await partnersQuery;
      if (error) throw error;

      let leadsQuery = supabase
        .from('leads')
        .select('id, status, client_type, pvp_override, close_date, created_at, created_by')
        .eq('client_type', 'B2B')
        .gte('created_at', from)
        .lte('created_at', to);
      if (agentId) leadsQuery = leadsQuery.eq('created_by', agentId);
      const { data: leads, error: lErr } = await leadsQuery;
      if (lErr) throw lErr;

      const won = (leads || []).filter((l) => l.status === 'won');
      const values = won.map((l) => Number(l.pvp_override) || 0);

      return {
        parceirosOnboarded: (partners || []).length,
        dealsFechados: won.length,
        valorMedioDeal: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      };
    },
  });
}
