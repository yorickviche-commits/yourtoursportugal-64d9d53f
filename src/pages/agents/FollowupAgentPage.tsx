import { useMemo } from 'react';
import { Send } from 'lucide-react';
import GenericAgentPage, { GenericAgentItem } from '@/components/agents/GenericAgentPage';
import { useLeadsQuery, useUpdateLead } from '@/hooks/useLeadsQuery';
import { useToast } from '@/hooks/use-toast';

const FollowupAgentPage = () => {
  const { data: leads = [], isLoading } = useLeadsQuery();
  const updateLead = useUpdateLead();
  const { toast } = useToast();

  const items: GenericAgentItem[] = useMemo(() => {
    return leads
      .filter(l => ['proposal_sent', 'negotiation'].includes(l.status))
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .map(l => {
        const stale = Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86400000);
        return {
          id: l.id,
          title: l.client_name,
          subtitle: `${l.destination} · sem mexer há ${stale}d`,
          meta: l.status === 'negotiation' ? 'Negociação' : 'Proposta enviada',
          urgency: stale > 5 ? 'high' : stale > 2 ? 'med' : 'low',
          leadHref: `/leads/${l.id}`,
          aiSuggestion: (
            <div className="space-y-1">
              <p>
                Sem actividade há <span className="font-semibold">{stale} dia{stale === 1 ? '' : 's'}</span>.
                Recomendo enviar um follow-up curto (estilo "founder") a perguntar se faz sentido marcar uma call breve para esclarecer dúvidas.
              </p>
              <p className="text-[11px] text-muted-foreground">Abre o Email Composer dentro da lead para gerar e enviar o draft via Gmail.</p>
            </div>
          ),
          primaryAction: {
            label: 'Abrir Email Composer',
            onClick: () => { window.location.href = `/leads/${l.id}?tab=communications`; },
          },
          secondaryActions: [
            { label: 'Marcar Ganho', onClick: async () => {
              await updateLead.mutateAsync({ id: l.id, updates: { status: 'won' } });
              toast({ title: 'Lead marcada como ganha' });
            } },
            { label: 'Marcar Perdido', onClick: async () => {
              await updateLead.mutateAsync({ id: l.id, updates: { status: 'lost' } });
              toast({ title: 'Lead marcada como perdida' });
            } },
          ],
        } as GenericAgentItem;
      });
  }, [leads, updateLead, toast]);

  return (
    <GenericAgentPage
      icon={Send}
      name="Follow-up Agent"
      role="Propostas a esfriar — fecha antes que percam tração."
      accent="from-amber-500/15 to-amber-500/5"
      items={items}
      emptyLabel="Sem follow-ups pendentes."
      loading={isLoading}
    />
  );
};

export default FollowupAgentPage;
