import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import AgentPageShell from '@/components/agents/AgentPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface GenericAgentItem {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  urgency?: 'high' | 'med' | 'low';
  leadHref?: string;
  /** AI-generated suggestion to show in the detail panel */
  aiSuggestion: ReactNode;
  /** Optional primary action (the "approve" button) */
  primaryAction?: { label: string; onClick: () => Promise<void> | void; loading?: boolean };
  /** Optional secondary actions */
  secondaryActions?: { label: string; onClick: () => void }[];
}

interface Props {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  role: string;
  accent?: string;
  items: GenericAgentItem[];
  emptyLabel?: string;
  loading?: boolean;
}

const urgencyDot: Record<string, string> = {
  high: 'bg-rose-500',
  med: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const GenericAgentPage = ({ icon, name, role, accent, items, emptyLabel, loading }: Props) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id);
  }, [items, selectedId]);

  const current = items.find(i => i.id === selectedId) || null;

  return (
    <AgentPageShell icon={icon} name={name} role={role} accent={accent}>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3">
        {/* List */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="px-3 py-2 border-b text-xs font-semibold flex items-center justify-between">
            <span>Fila de trabalho</span>
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {loading ? (
              <p className="p-4 text-xs text-muted-foreground">A carregar…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground italic">{emptyLabel || 'Sem itens.'}</p>
            ) : items.map(it => (
              <button
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-muted/30 transition-colors flex items-start gap-2',
                  selectedId === it.id && 'bg-blue-50 border-l-2 border-blue-500',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0 mt-1.5', urgencyDot[it.urgency || 'low'])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{it.title}</p>
                    {it.meta && <span className="text-[10px] text-muted-foreground shrink-0">{it.meta}</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{it.subtitle}</p>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="space-y-3">
          {!current ? (
            <div className="rounded-lg border bg-white p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">Fila vazia</p>
              <p className="text-xs text-muted-foreground mt-1">{emptyLabel || 'Nada pendente.'}</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{current.title}</p>
                  <p className="text-xs text-muted-foreground">{current.subtitle}{current.meta ? ` · ${current.meta}` : ''}</p>
                </div>
                {current.leadHref && (
                  <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
                    <Link to={current.leadHref}>Abrir lead <ExternalLink className="h-3 w-3" /></Link>
                  </Button>
                )}
              </div>

              <div className="mt-4 rounded-md bg-blue-50/60 border border-blue-200 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-blue-800 mb-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Sugestão do agente
                </div>
                <div className="text-foreground/90 leading-relaxed">{current.aiSuggestion}</div>
              </div>

              {(current.primaryAction || current.secondaryActions?.length) && (
                <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
                  {current.secondaryActions?.map((a, i) => (
                    <Button key={i} variant="outline" size="sm" className="text-xs" onClick={a.onClick}>{a.label}</Button>
                  ))}
                  {current.primaryAction && (
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={current.primaryAction.loading}
                      onClick={() => current.primaryAction!.onClick()}
                    >
                      {current.primaryAction.label}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AgentPageShell>
  );
};

export default GenericAgentPage;
