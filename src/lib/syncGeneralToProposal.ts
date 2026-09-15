import { supabase } from '@/integrations/supabase/client';
import { buildParticipantsLabel } from '@/lib/participantsLabel';

interface SyncArgs {
  leadId: string;
  version: number;
  pax: number;
  paxChildren?: number | null;
  travelDates?: string | null;
  travelEndDate?: string | null;
}

/**
 * Propaga o nº de participantes e as datas dos Dados Gerais para o travel plan e para a
 * proposta/itinerário digital DA MESMA versão. As outras versões nunca são tocadas.
 */
export async function syncGeneralToProposal({
  leadId, version, pax, paxChildren, travelDates, travelEndDate,
}: SyncArgs): Promise<void> {
  const { data: planRow } = await supabase
    .from('travel_plans')
    .select('id, days')
    .eq('lead_id', leadId)
    .eq('version', version)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const days = (Array.isArray((planRow as any)?.days) ? (planRow as any).days : []) as any[];
  const startDate = days[0]?.date || travelDates || null;
  const endDate = days[days.length - 1]?.date || travelEndDate || travelDates || null;

  const { data: proposalRow } = await supabase
    .from('proposals')
    .select('id, language')
    .eq('lead_id', leadId)
    .eq('version', version)
    .maybeSingle();

  const language = (proposalRow as any)?.language || 'en';
  const participants = buildParticipantsLabel(pax, paxChildren, language);

  if (planRow) {
    await supabase
      .from('travel_plans')
      .update({ pax: participants, start_date: startDate, end_date: endDate } as any)
      .eq('id', (planRow as any).id);
  }

  if (proposalRow) {
    const dateRange = startDate && endDate ? `${startDate} — ${endDate}` : startDate || '';
    await supabase
      .from('proposals')
      .update({ participants, date_range: dateRange } as any)
      .eq('id', (proposalRow as any).id);
  }
}
