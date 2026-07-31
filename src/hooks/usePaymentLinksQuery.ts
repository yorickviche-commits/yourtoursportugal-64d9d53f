import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ParticipantFees = 'all' | 'none' | 'credit_card' | 'service';

export interface Installment {
  price: number;
  days_before_departure: number;
}

export interface PaymentLink {
  id: string;
  lead_id: string;
  proposal_id: string | null;
  wetravel_uuid: string | null;
  url: string | null;
  title: string;
  trip_ref: string | null;
  start_date: string | null;
  end_date: string | null;
  amount_cents: number;
  currency: string;
  expires_at: string | null;
  participant_fees: ParticipantFees;
  days_before_departure: number;
  deposit_cents: number | null;
  installments: Installment[];
  allow_auto_payment: boolean;
  allow_partial_payment: boolean;
  status: 'draft' | 'published' | 'failed';
  last_error: string | null;
  created_at: string;
}

export interface CreatePaymentLinkInput {
  lead_id: string;
  proposal_id?: string | null;
  title: string;
  trip_ref?: string | null;
  start_date: string;
  end_date: string;
  amount_cents: number;
  currency?: string;
  expires_at?: string | null;
  participant_fees?: ParticipantFees;
  days_before_departure?: number;
  deposit_cents?: number | null;
  installments?: Installment[];
  allow_auto_payment?: boolean;
  allow_partial_payment?: boolean;
}

export const usePaymentLinks = (leadId?: string) =>
  useQuery({
    queryKey: ['payment_links', leadId ?? 'all'],
    queryFn: async (): Promise<PaymentLink[]> => {
      let q = (supabase.from('payment_links' as any) as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (leadId) q = q.eq('lead_id', leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PaymentLink[];
    },
  });

async function invokeFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('wetravel-create-payment-link', { body });
  if (error) {
    // Surface the real API message from the error response body when available
    let msg = error.message;
    try {
      const ctx: any = (error as any).context;
      const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (parsed?.error) msg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
    } catch { /* keep generic message */ }
    if ((data as any)?.error) msg = (data as any).error;
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any)?.payment_link as PaymentLink;
}


export const useCreatePaymentLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentLinkInput) => invokeFn({ action: 'create', ...input }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment_links'] }); },
  });
};

export const usePublishPaymentLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentLinkId: string) => invokeFn({ action: 'publish', payment_link_id: paymentLinkId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment_links'] }); },
  });
};
