import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import GenericAgentPage, { GenericAgentItem } from '@/components/agents/GenericAgentPage';
import { useLeadsQuery } from '@/hooks/useLeadsQuery';
import { useProposalsQuery } from '@/hooks/useProposalsQuery';

const budgetWeight = (level?: string) => {
  const l = (level || '').toLowerCase();
  if (l.includes('luxury') || l.includes('alto') || l.includes('premium')) return 3;
  if (l.includes('mid') || l.includes('médio') || l.includes('medio') || l.includes('comfort')) return 2;
  return 1;
};

const daysUntil = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return null;
  return Math.round((d - Date.now()) / 86400000);
};

const ItineraryAgentPage = () => {
  const { data: leads = [], isLoading } = useLeadsQuery();
  const { data: proposals = [] } = useProposalsQuery();

  const items: GenericAgentItem[] = useMemo(() => {
    const propsByLead = new Map<string, number>();
    proposals.forEach(p => p.lead_id && propsByLead.set(p.lead_id, (propsByLead.get(p.lead_id) || 0) + 1));

    return leads
      .filter(l => ['qualified', 'contacted'].includes(l.status))
      .map(l => {
        const d = daysUntil(l.travel_dates) ?? 999;
        const hasProposal = (propsByLead.get(l.id) || 0) > 0;
        const score = (hasProposal ? 0 : 50) + budgetWeight(l.budget_level) * 20 + Math.max(0, 60 - d);
        const lastMinute = d <= 30 && d >= 0;
        return { lead: l, score, lastMinute, hasProposal, d };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ lead, lastMinute, hasProposal, d }) => ({
        id: lead.id,
        title: lead.client_name,
        subtitle: `${lead.destination} · ${lead.budget_level || '—'}${lastMinute ? ' · ⚡ Last-minute' : ''}`,
        meta: d >= 0 && d < 999 ? `D-${d}` : 'sem datas',
        urgency: lastMinute ? 'high' : 'med',
        leadHref: `/leads/${lead.id}`,
        aiSuggestion: (
          <div className="space-y-1">
            <p>
              {hasProposal
                ? 'Já existe uma proposta criada para esta lead. Reabre o builder para iterar ou enviar.'
                : 'Não existe proposta ainda. Recomendo abrir o Travel Planner e gerar uma proposta inicial.'}
            </p>
            {lastMinute && (
              <p className="text-rose-700 font-medium">⚡ Last-minute: viagem em {d} dia{d === 1 ? '' : 's'} — prioridade máxima.</p>
            )}
          </div>
        ),
        primaryAction: {
          label: hasProposal ? 'Abrir Travel Planner' : 'Construir Proposta',
          onClick: () => { window.location.href = `/leads/${lead.id}?tab=planner`; },
        },
        secondaryActions: [
          { label: 'Ver Custos', onClick: () => { window.location.href = `/leads/${lead.id}?tab=costs`; } },
        ],
      } as GenericAgentItem));
  }, [leads, proposals]);

  return (
    <GenericAgentPage
      icon={FileText}
      name="Itinerary Construction & Proposal"
      role="Leads qualificadas sem proposta + last-minute de alto valor — constrói propostas a partir daqui."
      accent="from-violet-500/15 to-violet-500/5"
      items={items}
      emptyLabel="Sem propostas pendentes."
      loading={isLoading}
    />
  );
};

export default ItineraryAgentPage;
