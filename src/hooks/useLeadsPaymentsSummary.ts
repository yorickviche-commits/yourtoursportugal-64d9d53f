import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Soma dos pagamentos registados por lead (`lead_payments`). */
export const useLeadsPaymentsSummary = (leadIds: string[]) => {
  return useQuery({
    queryKey: ['leads_payments_summary', [...leadIds].sort().join(',')],
    queryFn: async (): Promise<Record<string, number>> => {
      if (leadIds.length === 0) return {};
      const { data, error } = await supabase
        .from('lead_payments')
        .select('lead_id, amount')
        .in('lead_id', leadIds);
      if (error) throw error;
      const out: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        out[r.lead_id] = (out[r.lead_id] || 0) + (Number(r.amount) || 0);
      });
      return out;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });
};

export type PaymentState = 'none' | 'partial' | 'full';

export const resolvePaymentState = (paid: number, pvp: number): PaymentState => {
  if (!paid || paid <= 0) return 'none';
  if (pvp > 0 && paid >= pvp - 0.01) return 'full';
  return 'partial';
};
