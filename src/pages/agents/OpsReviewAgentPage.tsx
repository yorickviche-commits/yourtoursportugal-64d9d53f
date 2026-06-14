import { useMemo } from 'react';
import { ClipboardCheck } from 'lucide-react';
import GenericAgentPage, { GenericAgentItem } from '@/components/agents/GenericAgentPage';
import { useLeadsQuery } from '@/hooks/useLeadsQuery';

const daysUntil = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return null;
  return Math.round((d - Date.now()) / 86400000);
};

const OpsReviewAgentPage = () => {
  const { data: leads = [], isLoading } = useLeadsQuery();

  const items: GenericAgentItem[] = useMemo(() => {
    return leads
      .filter(l => {
        const d = daysUntil(l.travel_dates);
        return l.status === 'won' && d !== null && d <= 14 && d >= -1;
      })
      .sort((a, b) => (daysUntil(a.travel_dates) ?? 999) - (daysUntil(b.travel_dates) ?? 999))
      .map(l => {
        const d = daysUntil(l.travel_dates) ?? 0;
        return {
          id: l.id,
          title: l.client_name,
          subtitle: `${l.destination} · ${l.pax} pax`,
          meta: d <= 0 ? 'Em curso' : `D-${d}`,
          urgency: d <= 3 ? 'high' : d <= 7 ? 'med' : 'low',
          leadHref: `/leads/${l.id}?tab=operations`,
          aiSuggestion: (
            <div className="space-y-1">
              <p>Verificar: confirmações de fornecedores, pagamentos pendentes, horários de pickup e voucher final.</p>
              <p className="text-[11px] text-muted-foreground">Abre Operações para checklist completa e reenvio de pedidos pendentes via FSE Pre-Booker.</p>
            </div>
          ),
          primaryAction: {
            label: 'Abrir Operações',
            onClick: () => { window.location.href = `/leads/${l.id}?tab=operations`; },
          },
          secondaryActions: [
            { label: 'FSE Pre-Booker', onClick: () => { window.location.href = '/agents/supplier'; } },
          ],
        } as GenericAgentItem;
      });
  }, [leads]);

  return (
    <GenericAgentPage
      icon={ClipboardCheck}
      name="Operations Wizard Review"
      role="Trips à porta (≤14d) — revisão diária de operações críticas."
      accent="from-rose-500/15 to-rose-500/5"
      items={items}
      emptyLabel="Nenhum trip nos próximos 14 dias."
      loading={isLoading}
    />
  );
};

export default OpsReviewAgentPage;
