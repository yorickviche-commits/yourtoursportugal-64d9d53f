import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbBookingEmail {
  id: string;
  operation_id: string | null;
  lead_operation_id: string | null;
  supplier_email: string | null;
  subject: string;
  body: string;
  sent_by: string | null;
  sent_at: string;
}

/** Fetch booking emails for a trip operation */
export const useBookingEmailsByOperation = (operationId: string | undefined) => {
  return useQuery({
    queryKey: ['booking_emails', 'operation', operationId],
    queryFn: async () => {
      if (!operationId) return [];
      const { data, error } = await supabase
        .from('booking_emails_log')
        .select('*')
        .eq('operation_id', operationId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data as DbBookingEmail[];
    },
    enabled: !!operationId,
  });
};

/** Fetch booking emails for a lead operation */
export const useBookingEmailsByLeadOperation = (leadOperationId: string | undefined) => {
  return useQuery({
    queryKey: ['booking_emails', 'lead_operation', leadOperationId],
    queryFn: async () => {
      if (!leadOperationId) return [];
      const { data, error } = await (supabase
        .from('booking_emails_log') as any)
        .select('*')
        .eq('lead_operation_id', leadOperationId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data as DbBookingEmail[];
    },
    enabled: !!leadOperationId,
  });
};

/** Fetch all booking emails for a lead (via lead_operations) */
export const useBookingEmailsByLeadId = (leadId: string | undefined) => {
  return useQuery({
    queryKey: ['booking_emails', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      // First get all lead operation ids
      const { data: ops, error: opsError } = await supabase
        .from('lead_operations' as any)
        .select('id')
        .eq('lead_id', leadId);
      if (opsError) throw opsError;
      if (!ops || ops.length === 0) return [];

      const opIds = (ops as any[]).map((o: any) => o.id);
      const { data, error } = await supabase
        .from('booking_emails_log')
        .select('*')
        .in('lead_operation_id' as any, opIds)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data as DbBookingEmail[];
    },
    enabled: !!leadId,
  });
};

/** Fetch all booking emails for a trip (via trip_operations) */
export const useBookingEmailsByTripId = (tripId: string | undefined) => {
  return useQuery({
    queryKey: ['booking_emails', 'trip', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      const { data: ops, error: opsError } = await supabase
        .from('trip_operations')
        .select('id')
        .eq('trip_id', tripId);
      if (opsError) throw opsError;
      if (!ops || ops.length === 0) return [];

      const opIds = ops.map(o => o.id);
      const { data, error } = await supabase
        .from('booking_emails_log')
        .select('*')
        .in('operation_id', opIds)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data as DbBookingEmail[];
    },
    enabled: !!tripId,
  });
};

export const useCreateBookingEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (log: {
      operation_id?: string | null;
      lead_operation_id?: string | null;
      supplier_email?: string;
      subject: string;
      body: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('booking_emails_log')
        .insert({
          operation_id: log.operation_id || null,
          lead_operation_id: log.lead_operation_id || null,
          supplier_email: log.supplier_email,
          subject: log.subject,
          body: log.body,
          sent_by: user?.id || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking_emails'] });
    },
  });
};
