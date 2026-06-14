import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useLeadsQuery, type DbLead } from '@/hooks/useLeadsQuery';
import { useProposalsQuery, type Proposal } from '@/hooks/useProposalsQuery';
import {
  Sparkles, UserPlus, FileText, Send, Briefcase, ClipboardCheck,
  ChevronRight, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentCardItem {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  urgency?: 'high' | 'med' | 'low';
}

interface AgentCardSpec {
  id: string;
  name: string;
  role: string;
  icon: typeof UserPlus;
  accent: string; // tailwind ring/bg color
  items: AgentCardItem[];
  emptyLabel: string;
  cta?: { label: string; href: string };
}

const daysUntil = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const budgetWeight = (level?: string): number => {
  const l = (level || '').toLowerCase();
  if (l.includes('luxury') || l.includes('alto') || l.includes('premium')) return 3;
  if (l.includes('mid') || l.includes('médio') || l.includes('medio') || l.includes('comfort')) return 2;
  return 1;
};

const formatTravel = (l: DbLead): string => {
  if (!l.travel_dates) return 'Datas a definir';
  const d = daysUntil(l.travel_dates);
  if (d === null) return l.travel_dates;
  if (d < 0) return `Partiu há ${Math.abs(d)}d`;
  if (d === 0) return 'Parte hoje';
  return `D-${d} · ${new Date(l.travel_dates).toLocaleDateString('pt-PT')}`;
};

const AgentControlPage = () => {
  const { data: leads = [], isLoading: leadsLoading } = useLeadsQuery();
  const { data: proposals = [], isLoading: propsLoading } = useProposalsQuery();

  const cards: AgentCardSpec[] = useMemo(() => {
    const leadsById = new Map(leads.map(l => [l.id, l]));
    const proposalsByLead = new Map<string, Proposal[]>();
    proposals.forEach(p => {
      if (!p.lead_id) return;
      const arr = proposalsByLead.get(p.lead_id) || [];
      arr.push(p);
      proposalsByLead.set(p.lead_id, arr);
    });

    // 1. Qualification: new/contacted, sorted by recency + budget weight
    const qualification = leads
      .filter(l => ['new', 'contacted'].includes(l.status))
      .sort((a, b) => {
        const wb = budgetWeight(b.budget_level) - budgetWeight(a.budget_level);
        if (wb !== 0) return wb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 5)
      .map<AgentCardItem>(l => ({
        id: l.id,
        title: l.client_name,
        subtitle: `${l.destination || 'Destino?'} · ${l.pax || '?'} pax · ${l.budget_level || 'budget?'}`,
        meta: formatTravel(l),
        href: `/leads/${l.id}`,
        urgency: budgetWeight(l.budget_level) >= 3 ? 'high' : 'med',
      }));

    // 2. Itinerary & Proposal: qualified leads without proposal OR last-minute high-budget
    const itinerary = leads
      .filter(l => ['qualified', 'contacted'].includes(l.status))
      .map(l => {
        const d = daysUntil(l.travel_dates) ?? 999;
        const hasProposal = (proposalsByLead.get(l.id) || []).length > 0;
        const score = (hasProposal ? 0 : 50) + budgetWeight(l.budget_level) * 20 + Math.max(0, 60 - d);
        return { lead: l, score, lastMinute: d <= 30 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map<AgentCardItem>(({ lead, lastMinute }) => ({
        id: lead.id,
        title: lead.client_name,
        subtitle: `${lead.destination} · ${lead.budget_level || '—'}${lastMinute ? ' · ⚡ Last-minute' : ''}`,
        meta: formatTravel(lead),
        href: `/leads/${lead.id}`,
        urgency: lastMinute ? 'high' : 'med',
      }));

    // 3. Follow-up: proposal_sent / negotiation, stalest first
    const followup = leads
      .filter(l => ['proposal_sent', 'negotiation'].includes(l.status))
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 5)
      .map<AgentCardItem>(l => {
        const stale = Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86400000);
        return {
          id: l.id,
          title: l.client_name,
          subtitle: `${l.destination} · sem mexer há ${stale}d`,
          meta: l.status === 'negotiation' ? 'Negociação' : 'Proposta enviada',
          href: `/leads/${l.id}`,
          urgency: stale > 5 ? 'high' : stale > 2 ? 'med' : 'low',
        };
      });

    // 4. FSE Supplier Pre-Booker: won leads + proposal_sent with travel < 45d
    const supplier = leads
      .filter(l => {
        const d = daysUntil(l.travel_dates);
        return l.status === 'won' || (l.status === 'proposal_sent' && d !== null && d <= 45 && d >= 0);
      })
      .sort((a, b) => (daysUntil(a.travel_dates) ?? 999) - (daysUntil(b.travel_dates) ?? 999))
      .slice(0, 5)
      .map<AgentCardItem>(l => ({
        id: l.id,
        title: l.client_name,
        subtitle: `${l.destination} · ${l.pax} pax`,
        meta: formatTravel(l),
        href: `/leads/${l.id}?tab=operations`,
        urgency: (daysUntil(l.travel_dates) ?? 999) <= 14 ? 'high' : 'med',
      }));

    // 5. Operations Wizard Review: won leads with travel D-14 or sooner
    const ops = leads
      .filter(l => {
        const d = daysUntil(l.travel_dates);
        return l.status === 'won' && d !== null && d <= 14;
      })
      .sort((a, b) => (daysUntil(a.travel_dates) ?? 999) - (daysUntil(b.travel_dates) ?? 999))
      .slice(0, 5)
      .map<AgentCardItem>(l => {
        const d = daysUntil(l.travel_dates) ?? 0;
        return {
          id: l.id,
          title: l.client_name,
          subtitle: `${l.destination} · ${l.pax} pax`,
          meta: formatTravel(l),
          href: `/leads/${l.id}?tab=operations`,
          urgency: d <= 3 ? 'high' : d <= 7 ? 'med' : 'low',
        };
      });

    return [
      {
        id: 'qualification',
        name: 'New Leads & Qualification',
        role: 'Top novos leads por valor potencial — qualificar e contactar primeiro.',
        icon: UserPlus,
        accent: 'from-blue-500/15 to-blue-500/5 border-blue-200',
        items: qualification,
        emptyLabel: 'Sem novos leads para qualificar.',
        cta: { label: 'Abrir centro do agente', href: '/agents/qualification' },
      },
      {
        id: 'itinerary',
        name: 'Itinerary Construction & Proposal',
        role: 'Leads qualificados sem proposta + last-minute de alto valor.',
        icon: FileText,
        accent: 'from-violet-500/15 to-violet-500/5 border-violet-200',
        items: itinerary,
        emptyLabel: 'Nenhuma proposta prioritária pendente.',
        cta: { label: 'Abrir centro do agente', href: '/agents/itinerary' },
      },
      {
        id: 'followup',
        name: 'Follow-up Agent',
        role: 'Propostas enviadas a esfriar — fechar antes que percam tração.',
        icon: Send,
        accent: 'from-amber-500/15 to-amber-500/5 border-amber-200',
        items: followup,
        emptyLabel: 'Sem follow-ups pendentes.',
        cta: { label: 'Abrir centro do agente', href: '/agents/followup' },
      },
      {
        id: 'supplier',
        name: 'FSE Supplier Pre-Booker',
        role: 'Pré-reservas e pedidos a fornecedores para todos os budgets ativos.',
        icon: Briefcase,
        accent: 'from-emerald-500/15 to-emerald-500/5 border-emerald-200',
        items: supplier,
        emptyLabel: 'Sem pré-reservas pendentes.',
        cta: { label: 'Abrir centro do agente', href: '/agents/supplier' },
      },
      {
        id: 'ops_review',
        name: 'Operations Wizard Review',
        role: 'Trips à porta — revisão diária de operações críticas.',
        icon: ClipboardCheck,
        accent: 'from-rose-500/15 to-rose-500/5 border-rose-200',
        items: ops,
        emptyLabel: 'Nenhum trip nos próximos 14 dias.',
        cta: { label: 'Abrir centro do agente', href: '/agents/ops-review' },
      },
    ];
  }, [leads, proposals]);

  const urgencyDot: Record<string, string> = {
    high: 'bg-rose-500',
    med: 'bg-amber-500',
    low: 'bg-emerald-500',
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[hsl(var(--info))]" />
              <h1 className="text-lg md:text-xl font-bold">Spark — AI Agents Dashboard</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Vista resumida do trabalho prioritário de cada agente. Cada cartão mostra o top 3–5 itens a tratar primeiro.
            </p>
          </div>
        </div>

        {(leadsLoading || propsLoading) && (
          <div className="text-xs text-muted-foreground">A carregar dados…</div>
        )}

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className={cn(
                  'rounded-lg border bg-gradient-to-br p-3 flex flex-col',
                  card.accent,
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="h-8 w-8 rounded-md bg-white shadow-sm flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-tight">{card.name}</h3>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{card.role}</p>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-white/70 px-1.5 py-0.5 rounded">
                    {card.items.length}
                  </span>
                </div>

                <div className="flex-1 space-y-1">
                  {card.items.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground italic py-4 text-center bg-white/40 rounded">
                      {card.emptyLabel}
                    </div>
                  ) : (
                    card.items.map(item => (
                      <Link
                        key={item.id}
                        to={item.href}
                        className="flex items-center gap-2 px-2 py-1.5 rounded bg-white hover:bg-white/80 transition-colors group"
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', urgencyDot[item.urgency || 'low'])} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium truncate">{item.title}</p>
                            {item.meta && (
                              <span className="text-[10px] text-muted-foreground shrink-0">{item.meta}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground shrink-0" />
                      </Link>
                    ))
                  )}
                </div>

                {card.cta && (
                  <Link
                    to={card.cta.href}
                    className="mt-2 text-[11px] text-center py-1.5 rounded bg-white/60 hover:bg-white text-foreground/80 hover:text-foreground transition-colors font-medium"
                  >
                    {card.cta.label} →
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Footnote */}
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Os agentes Spark preparam trabalho (drafts, scoring, pré-reservas) e devolvem-no para aprovação humana antes de qualquer envio externo.
          </span>
        </div>
      </div>
    </AppLayout>
  );
};

export default AgentControlPage;
