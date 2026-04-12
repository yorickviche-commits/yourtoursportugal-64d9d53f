import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProposalDay {
  day_number: number;
  date_label: string;
  title: string;
  subtitle: string;
  cover_image_url: string;
  items: string[];
  accommodation: { label: string; hotel_name: string; note: string } | null;
}

export interface MapStop {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Proposal {
  id: string;
  public_token: string;
  client_name: string;
  client_email: string | null;
  booking_ref: string | null;
  title: string;
  date_range: string | null;
  participants: string | null;
  hero_image_url: string | null;
  summary_text: string | null;
  language: string;
  status: string;
  days: ProposalDay[];
  map_stops: MapStop[];
  lead_id: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  approved_at: string | null;
}

export interface ProposalAnnotation {
  id: string;
  proposal_id: string;
  level: string;
  target_day_index: number | null;
  target_item_index: number | null;
  author_type: string;
  author_name: string;
  author_email: string | null;
  content: string;
  is_resolved: boolean;
  parent_id: string | null;
  created_at: string;
}

export interface ProposalEvent {
  id: string;
  proposal_id: string;
  event_type: string;
  actor_name: string;
  actor_email: string | null;
  note: string | null;
  created_at: string;
}

// ─── Proposals ───
export const useProposalsQuery = () =>
  useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapProposal);
    },
  });

export const useProposalByToken = (token: string) =>
  useQuery({
    queryKey: ['proposal', 'token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('public_token', token)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapProposal(data);
    },
    enabled: !!token,
  });

export const useProposalById = (id: string) =>
  useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapProposal(data);
    },
    enabled: !!id,
  });

function mapProposal(raw: any): Proposal {
  return {
    ...raw,
    days: Array.isArray(raw.days) ? raw.days : JSON.parse(raw.days || '[]'),
    map_stops: Array.isArray(raw.map_stops) ? raw.map_stops : JSON.parse(raw.map_stops || '[]'),
  };
}

// ─── Annotations ───
export const useProposalAnnotations = (proposalId: string) =>
  useQuery({
    queryKey: ['proposal_annotations', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_annotations')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ProposalAnnotation[];
    },
    enabled: !!proposalId,
  });

export const useCreateAnnotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ann: Omit<ProposalAnnotation, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('proposal_annotations')
        .insert(ann as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['proposal_annotations', vars.proposal_id] });
    },
  });
};

export const useResolveAnnotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_resolved }: { id: string; is_resolved: boolean }) => {
      const { error } = await supabase
        .from('proposal_annotations')
        .update({ is_resolved } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal_annotations'] });
    },
  });
};

// ─── Events ───
export const useProposalEvents = (proposalId: string) =>
  useQuery({
    queryKey: ['proposal_events', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_events')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ProposalEvent[];
    },
    enabled: !!proposalId,
  });

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ev: Omit<ProposalEvent, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('proposal_events')
        .insert(ev as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['proposal_events', vars.proposal_id] });
    },
  });
};

// ─── Mutations ───
export const useUpdateProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Proposal> & { id: string }) => {
      const { error } = await supabase
        .from('proposals')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      qc.invalidateQueries({ queryKey: ['proposal'] });
    },
  });
};

export const useCreateProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: Partial<Proposal>) => {
      const { data, error } = await supabase
        .from('proposals')
        .insert(proposal as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposta criada');
    },
  });
};
