import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { MessageSquare, Paperclip, ThumbsUp } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useMyFeedback, usePublicFeedback, useMyVotes } from '@/hooks/useFeedbackQuery';
import { useToggleFeedbackVote } from '@/hooks/useFeedbackMutations';
import { TypeBadge, StatusBadge, SeverityDot } from '@/components/feedback/FeedbackBadges';
import FeedbackDetailSheet from '@/components/feedback/FeedbackDetailSheet';
import { moduleLabel } from '@/lib/feedbackContext';
import { CLOSED_STATUSES, OPEN_STATUSES, type FeedbackStatus, type FeedbackType, type FeedbackSeverity } from '@/lib/feedbackConstants';

const MyFeedbackPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: mine = [], isLoading } = useMyFeedback();
  const { data: publicItems = [] } = usePublicFeedback();
  const { data: myVotes } = useMyVotes();
  const toggleVote = useToggleFeedbackVote();
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');

  const openId = params.get('open');
  const setOpenId = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id); else next.delete('open');
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => mine.filter(r => {
    if (filter === 'all') return true;
    const list = filter === 'open' ? OPEN_STATUSES : CLOSED_STATUSES;
    return list.includes(r.status as FeedbackStatus);
  }), [mine, filter]);

  const others = useMemo(
    () => publicItems
      .filter(p => p.reported_by !== user?.id && OPEN_STATUSES.includes(p.status as FeedbackStatus))
      .sort((a, b) => Number(b.votes) - Number(a.votes)),
    [publicItems, user?.id],
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Os Meus Reportes</h1>
            <p className="text-xs text-muted-foreground">Bugs, melhorias e sugestões que enviaste.</p>
          </div>
          <Button size="sm" onClick={() => window.dispatchEvent(new Event('tcc:open-feedback'))}>
            Novo reporte
          </Button>
        </header>

        <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <TabsList className="h-8">
            <TabsTrigger value="open" className="text-xs">Abertos</TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">Resolvidos</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">A carregar…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Ainda não tens reportes nesta vista.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map(r => (
              <button
                key={r.id}
                onClick={() => setOpenId(r.id!)}
                className={cn(
                  'rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-[#0a2540]',
                  r.severity === 'blocker' && 'border-l-4 border-l-red-600',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] text-muted-foreground">{r.ref}</span>
                  <TypeBadge type={r.type as FeedbackType} />
                  <StatusBadge status={r.status as FeedbackStatus} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium">{r.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{moduleLabel(r.module!)}</span>
                  <SeverityDot severity={r.severity as FeedbackSeverity | null} />
                  <span>{format(new Date(r.created_at!), 'dd/MM/yyyy HH:mm')}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{Number(r.votes ?? 0)}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{Number(r.comments_count ?? 0)}</span>
                  <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{Number(r.attachments_count ?? 0)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Reportes de outros colegas</h2>
          <p className="text-xs text-muted-foreground">Vota nos que também te afetam para ajudar a definir prioridades.</p>
          {others.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada em aberto de outros colegas.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {others.map(o => {
                const voted = myVotes?.has(o.id) ?? false;
                return (
                  <div key={o.id} className="flex items-center gap-3 p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">{o.ref}</span>
                        <TypeBadge type={o.type as FeedbackType} />
                        <StatusBadge status={o.status as FeedbackStatus} />
                      </div>
                      <p className="truncate text-sm">{o.title}</p>
                      <p className="text-[11px] text-muted-foreground">{moduleLabel(o.module)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={voted ? 'default' : 'outline'}
                      className="h-8 shrink-0 text-xs"
                      onClick={() => toggleVote.mutate({ feedbackId: o.id, voted }, {
                        onError: e => toast.error(e.message),
                      })}
                    >
                      <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                      {Number(o.votes)}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <FeedbackDetailSheet id={openId} mode="reporter" onClose={() => setOpenId(null)} />
    </AppLayout>
  );
};

export default MyFeedbackPage;
