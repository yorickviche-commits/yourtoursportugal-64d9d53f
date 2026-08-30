// Propostas são versionadas por lead: uma linha em `proposals` por
// (lead_id, version). Fora do detalhe da lead, tudo deve ler a versão LIVE
// (`leads.active_version`).
import { supabase } from '@/integrations/supabase/client';

export const getLeadLiveVersion = async (leadId: string): Promise<number> => {
  const { data } = await supabase.from('leads').select('active_version').eq('id', leadId).maybeSingle();
  return Number((data as any)?.active_version ?? 0);
};

/** Token público único por versão — nunca muda depois de criado. */
export const buildProposalToken = (leadCode: string, version: number) => {
  const slug = (leadCode || 'ytp').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const rand = Math.random().toString(36).slice(2, 6);
  return `ytp-${slug}-v${version}-${rand}`;
};
