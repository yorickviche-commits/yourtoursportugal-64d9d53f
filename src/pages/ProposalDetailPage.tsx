import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useProposalById, useProposalAnnotations, useProposalEvents, useCreateAnnotation, useCreateEvent, useResolveAnnotation } from '@/hooks/useProposalsQuery';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Reply, ExternalLink, Copy, Clock, MessageSquare, Send, CheckCircle, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const statusColors: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  revision_requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-purple-100 text-purple-700',
};

const ProposalDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: proposal, isLoading } = useProposalById(id || '');
  const { data: annotations = [] } = useProposalAnnotations(id || '');
  const { data: events = [] } = useProposalEvents(id || '');
  const createAnnotation = useCreateAnnotation();
  const createEvent = useCreateEvent();
  const resolveAnnotation = useResolveAnnotation();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'unresolved' | 'all' | 'timeline'>('unresolved');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const navigate = useNavigate();

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`proposal-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'proposal_annotations', filter: `proposal_id=eq.${id}` }, payload => {
        const ann = payload.new as any;
        if (ann.author_type === 'client') {
          toast.info(`Novo comentário de ${ann.author_name}`);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'proposal_events', filter: `proposal_id=eq.${id}` }, payload => {
        const ev = payload.new as any;
        if (ev.event_type === 'approved') toast.success(`Proposta aprovada por ${ev.actor_name}!`);
        if (ev.event_type === 'revision_requested') toast.warning(`Alterações pedidas por ${ev.actor_name}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleReply = (parentAnn: any) => {
    if (!replyText.trim()) return;
    createAnnotation.mutate({
      proposal_id: id!,
      level: parentAnn.level,
      target_day_index: parentAnn.target_day_index,
      target_item_index: parentAnn.target_item_index,
      author_type: 'ytp_team',
      author_name: profile?.full_name || 'Equipa YTP',
      author_email: profile?.email || null,
      content: replyText,
      is_resolved: false,
      parent_id: parentAnn.id,
    });
    createEvent.mutate({
      proposal_id: id!,
      event_type: 'reply_added',
      actor_name: profile?.full_name || 'Equipa YTP',
      actor_email: profile?.email || null,
      note: replyText.slice(0, 100),
    });
    setReplyText('');
    setReplyId(null);
  };

  if (isLoading) return <AppLayout><div className="text-muted-foreground py-8 text-center">A carregar...</div></AppLayout>;
  if (!proposal) return <AppLayout><div className="py-8 text-center">Proposta não encontrada</div></AppLayout>;

  const rootAnnotations = annotations.filter(a => !a.parent_id);
  const unresolvedAnns = rootAnnotations.filter(a => !a.is_resolved);
  const replies = (parentId: string) => annotations.filter(a => a.parent_id === parentId);

  const displayAnns = tab === 'unresolved' ? unresolvedAnns : rootAnnotations;

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/proposal/${proposal.public_token}`);
    toast.success('Link copiado!');
  };

  const getLevelBadge = (ann: any) => {
    if (ann.level === 'proposal') return 'Geral';
    if (ann.level === 'day') return `Dia ${(ann.target_day_index ?? 0) + 1}`;
    return `Dia ${(ann.target_day_index ?? 0) + 1} > Item ${(ann.target_item_index ?? 0) + 1}`;
  };

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Proposal preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColors[proposal.status])}>
                  {proposal.status}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{proposal.booking_ref}</span>
              </div>
              <h1 className="text-lg font-bold">{proposal.client_name}</h1>
              <p className="text-sm text-muted-foreground">{proposal.title}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-1" /> Link
              </Button>
              <a href={`/proposal/${proposal.public_token}`} target="_blank" rel="noopener">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" /> Ver
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={() => navigate(`/proposals/${id}/edit`)}>
                Editar
              </Button>
            </div>
          </div>

          {/* Mini proposal preview */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {proposal.hero_image_url && (
              <div className="h-48 relative">
                <img src={proposal.hero_image_url} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            )}
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {proposal.date_range && <span>{proposal.date_range}</span>}
                {proposal.participants && <span>• {proposal.participants}</span>}
                <span>• {proposal.language.toUpperCase()}</span>
              </div>
              <p className="text-sm text-muted-foreground">{proposal.summary_text}</p>
              <div className="space-y-2">
                {proposal.days.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">J{d.day_number}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{d.title}</span>
                      <span className="text-xs text-muted-foreground">{d.items.length} items</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Annotations sidebar */}
        <div className="w-full lg:w-[380px] shrink-0">
          <div className="bg-card rounded-xl border border-border overflow-hidden sticky top-4">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Anotações do Cliente
                {unresolvedAnns.length > 0 && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{unresolvedAnns.length}</span>
                )}
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['unresolved', 'all', 'timeline'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                    tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
                  )}
                >
                  {t === 'unresolved' ? `Pendentes (${unresolvedAnns.length})` : t === 'all' ? 'Todas' : 'Timeline'}
                </button>
              ))}
            </div>

            <div className="max-h-[600px] overflow-y-auto p-3 space-y-3">
              {tab === 'timeline' ? (
                events.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Sem eventos</p>
                ) : (
                  [...events].reverse().map(ev => (
                    <div key={ev.id} className="flex items-start gap-2 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{ev.actor_name}</span>
                        <span className="text-muted-foreground ml-1">{ev.event_type}</span>
                        {ev.note && <p className="text-muted-foreground mt-0.5">{ev.note}</p>}
                        <span className="text-muted-foreground/60 text-[10px]">{new Date(ev.created_at).toLocaleString('pt-PT')}</span>
                      </div>
                    </div>
                  ))
                )
              ) : displayAnns.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {tab === 'unresolved' ? 'Sem anotações pendentes' : 'Sem anotações'}
                </p>
              ) : (
                displayAnns.map(ann => (
                  <div key={ann.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-medium">{getLevelBadge(ann)}</span>
                      <span className={cn("w-2 h-2 rounded-full", ann.is_resolved ? "bg-emerald-400" : "bg-amber-400")} />
                      <span className="text-xs font-medium">{ann.author_name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(ann.created_at).toLocaleDateString('pt-PT')}</span>
                    </div>
                    <p className="text-sm">{ann.content}</p>

                    {/* Replies */}
                    {replies(ann.id).map(r => (
                      <div key={r.id} className="ml-4 pl-3 border-l-2 border-primary/20">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-primary font-medium">{r.author_name}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-PT')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.content}</p>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setReplyId(replyId === ann.id ? null : ann.id)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Reply className="h-3 w-3" /> Responder
                      </button>
                      <button
                        onClick={() => resolveAnnotation.mutate({ id: ann.id, is_resolved: !ann.is_resolved })}
                        className="text-xs text-muted-foreground hover:text-emerald-600 flex items-center gap-1"
                      >
                        {ann.is_resolved ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        {ann.is_resolved ? 'Reabrir' : 'Resolver'}
                      </button>
                    </div>

                    {replyId === ann.id && (
                      <div className="flex gap-2 mt-1">
                        <input
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Resposta..."
                          className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button onClick={() => handleReply(ann)} className="px-2 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs">
                          <Send className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProposalDetailPage;
