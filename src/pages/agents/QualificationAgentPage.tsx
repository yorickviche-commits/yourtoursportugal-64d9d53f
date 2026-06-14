import { useMemo } from 'react';
import { UserPlus } from 'lucide-react';
import GenericAgentPage, { GenericAgentItem } from '@/components/agents/GenericAgentPage';
import { useLeadsQuery, useUpdateLead } from '@/hooks/useLeadsQuery';
import { useToast } from '@/hooks/use-toast';

const budgetWeight = (level?: string) => {
  const l = (level || '').toLowerCase();
  if (l.includes('luxury') || l.includes('alto') || l.includes('premium')) return 3;
  if (l.includes('mid') || l.includes('médio') || l.includes('medio') || l.includes('comfort')) return 2;
  return 1;
};

const QualificationAgentPage = () => {
  const { data: leads = [], isLoading } = useLeadsQuery();
  const updateLead = useUpdateLead();
  const { toast } = useToast();

  const items: GenericAgentItem[] = useMemo(() => {
    return leads
      .filter(l => ['new', 'contacted'].includes(l.status))
      .sort((a, b) => budgetWeight(b.budget_level) - budgetWeight(a.budget_level)
        || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(l => {
        const w = budgetWeight(l.budget_level);
        const score = w * 20 + (l.pax || 0) * 5 + (l.destination ? 10 : 0) + (l.travel_dates ? 15 : 0);
        const recommend = score >= 50 ? 'qualified' : 'rejected';
        return {
          id: l.id,
          title: l.client_name,
          subtitle: `${l.destination || 'Destino?'} · ${l.pax || '?'} pax · ${l.budget_level || 'budget?'}`,
          meta: l.travel_dates ? new Date(l.travel_dates).toLocaleDateString('pt-PT') : 'datas?',
          urgency: w >= 3 ? 'high' : w >= 2 ? 'med' : 'low',
          leadHref: `/leads/${l.id}`,
          aiSuggestion: (
            <div className="space-y-1">
              <p><span className="font-semibold">Score estimado:</span> {Math.min(100, score)}/100</p>
              <p>
                {recommend === 'qualified'
                  ? 'Lead com sinais positivos (budget + destino + datas). Recomendo passar a Qualificada e marcar contacto inicial.'
                  : 'Sinais fracos (sem destino claro, datas em falta ou budget baixo). Recomendo Rejeitar com email educado.'}
              </p>
              <p className="text-[11px] text-muted-foreground">Fonte: {l.source || 'direct'} · criado em {new Date(l.created_at).toLocaleDateString('pt-PT')}</p>
            </div>
          ),
          primaryAction: recommend === 'qualified' ? {
            label: 'Aprovar → Qualificar',
            loading: updateLead.isPending,
            onClick: async () => {
              await updateLead.mutateAsync({ id: l.id, updates: { status: 'qualified' } });
              toast({ title: 'Lead qualificada', description: l.client_name });
            },
          } : {
            label: 'Aprovar → Rejeitar',
            loading: updateLead.isPending,
            onClick: async () => {
              await updateLead.mutateAsync({ id: l.id, updates: { status: 'rejected' } });
              toast({ title: 'Lead rejeitada', description: l.client_name });
            },
          },
          secondaryActions: [
            { label: 'Marcar Contactado', onClick: async () => {
              await updateLead.mutateAsync({ id: l.id, updates: { status: 'contacted' } });
              toast({ title: 'Lead contactada' });
            } },
          ],
        } as GenericAgentItem;
      });
  }, [leads, updateLead, toast]);

  return (
    <GenericAgentPage
      icon={UserPlus}
      name="New Leads & Qualification"
      role="Triagem rápida de leads novas: aprova qualificação ou rejeição com 1 clique."
      accent="from-blue-500/15 to-blue-500/5"
      items={items}
      emptyLabel="Sem leads novas para triar."
      loading={isLoading}
    />
  );
};

export default QualificationAgentPage;
