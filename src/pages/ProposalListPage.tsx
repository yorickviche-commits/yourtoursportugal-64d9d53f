import AppLayout from '@/components/AppLayout';
import { useProposalsQuery } from '@/hooks/useProposalsQuery';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ExternalLink, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  revision_requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-purple-100 text-purple-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  approved: 'Aprovada',
  revision_requested: 'Alterações pedidas',
  confirmed: 'Confirmada',
};

const filters = ['all', 'draft', 'sent', 'approved', 'revision_requested'] as const;
const filterLabels: Record<string, string> = {
  all: 'Todas',
  draft: 'Rascunho',
  sent: 'Pendentes',
  approved: 'Aprovadas',
  revision_requested: 'Alterações',
};

const ProposalListPage = () => {
  const { data: proposals = [], isLoading } = useProposalsQuery();
  const [filter, setFilter] = useState<string>('all');
  const navigate = useNavigate();

  const filtered = filter === 'all' ? proposals : proposals.filter(p => p.status === filter);

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/proposal/${token}`);
    toast.success('Link copiado!');
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Propostas Cliente</h1>
          <Button onClick={() => navigate('/proposals/new')} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Proposta
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {filterLabels[f]}
              {f !== 'all' && (
                <span className="ml-1.5 opacity-70">({proposals.filter(p => p.status === f).length})</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm py-8 text-center">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Nenhuma proposta encontrada</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/proposals/${p.id}`)}
                className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[p.status] || statusColors.draft)}>
                        {statusLabels[p.status] || p.status}
                      </span>
                      {p.booking_ref && <span className="text-xs text-muted-foreground font-mono">{p.booking_ref}</span>}
                    </div>
                    <h3 className="text-sm font-semibold truncate">{p.client_name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{p.title}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {p.date_range && <span>{p.date_range}</span>}
                      {p.participants && <span>• {p.participants}</span>}
                      <span>• {new Date(p.created_at).toLocaleDateString('pt-PT')}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); copyLink(p.public_token); }}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Copiar link"
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <a
                      href={`/proposal/${p.public_token}`}
                      target="_blank"
                      rel="noopener"
                      onClick={e => e.stopPropagation()}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Ver proposta"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProposalListPage;
