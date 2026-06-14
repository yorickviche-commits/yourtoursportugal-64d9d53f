import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useLeads } from '@/hooks/useLeads';
import { useAgentPendingActions, useApproveAction, useRejectAction } from '@/hooks/useAgentPendingActions';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sparkles, Mail, FileText, Star, MessageSquare, ListChecks,
  ChevronRight, Zap, CheckCircle, XCircle, Search, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/leads';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:           { label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  contacted:     { label: 'Contactado', color: 'bg-indigo-100 text-indigo-700' },
  qualified:     { label: 'Qualificado', color: 'bg-emerald-100 text-emerald-700' },
  proposal_sent: { label: 'Proposta', color: 'bg-violet-100 text-violet-700' },
  negotiation:   { label: 'Negociação', color: 'bg-amber-100 text-amber-700' },
  won:           { label: 'Ganho', color: 'bg-green-100 text-green-700' },
  lost:          { label: 'Perdido', color: 'bg-gray-100 text-gray-600' },
};

const SPARK_TASKS = [
  { id: 'draft_followup', label: 'Redigir follow-up', icon: Mail,
    description: 'Spark prepara um email de follow-up personalizado para o lead.' },
  { id: 'score_lead', label: 'Avaliar lead', icon: Star,
    description: 'Spark analisa contexto e atribui pontuação 0–100 com justificação.' },
  { id: 'suggest_itinerary', label: 'Sugerir esqueleto de itinerário', icon: Lightbulb,
    description: 'Spark propõe um esqueleto de dias com base no perfil e destino.' },
  { id: 'summarize_history', label: 'Resumir histórico', icon: MessageSquare,
    description: 'Spark resume todas as comunicações e notas existentes do lead.' },
  { id: 'next_action', label: 'Sugerir próxima acção', icon: ListChecks,
    description: 'Spark identifica o próximo passo comercial mais provável de fechar.' },
];

const AgentControlPage = () => {
  const { leads } = useLeads();
  const { data: actions = [] } = useAgentPendingActions();
  const approve = useApproveAction();
  const reject = useRejectAction();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Sort by most recent activity, exclude won/lost from main focus
  const filteredLeads = useMemo(() => {
    const active = leads.filter(l => !['won', 'lost'].includes(l.status));
    const q = query.trim().toLowerCase();
    const filtered = q
      ? active.filter(l =>
          l.clientName.toLowerCase().includes(q) ||
          l.destination.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q)
        )
      : active;
    return [...filtered].sort((a, b) =>
      new Date(b.lastContact || b.createdAt).getTime() -
      new Date(a.lastContact || a.createdAt).getTime()
    );
  }, [leads, query]);

  const pendingActions = actions.filter(a => a.status === 'pending');

  const handleDelegate = (lead: Lead, taskLabel: string) => {
    toast({
      title: 'Tarefa enviada ao Spark',
      description: `${taskLabel} · ${lead.clientName} (${lead.id})`,
    });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Spark · Assistente Comercial</h1>
            <p className="text-xs text-muted-foreground">
              Delegue tarefas repetitivas: emails, scoring, resumos e sugestões de próxima acção.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700">Spark activo</span>
          </div>
        </div>

        {/* What Spark does — quick explainer */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200/60 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
            <div className="text-xs text-foreground/80 leading-relaxed">
              <strong className="text-foreground">O que o Spark faz:</strong> escolha um lead e delegue uma tarefa.
              O Spark prepara o trabalho (rascunho de email, scoring, resumo, sugestão de itinerário) e devolve para a sua aprovação antes de qualquer envio ao cliente.
            </div>
          </div>
        </div>

        {/* Pending approvals */}
        {pendingActions.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-yellow-600" />
              <h2 className="text-sm font-semibold">Acções a aguardar a sua aprovação</h2>
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                {pendingActions.length}
              </span>
            </div>
            <div className="space-y-2">
              {pendingActions.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.entity_ref} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200"
                    onClick={() => reject.mutateAsync({ id: a.id }).then(() => toast({ title: 'Rejeitado' }))}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => approve.mutateAsync(a.id).then(() => toast({ title: 'Aprovado' }))}>
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two-column: leads + spark task panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

          {/* Leads list */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Procurar lead, destino ou ID..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-7 border-0 focus-visible:ring-0 px-0 text-sm"
              />
              <span className="text-[10px] text-muted-foreground">{filteredLeads.length} activos</span>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {filteredLeads.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">Sem leads activos</div>
              )}
              {filteredLeads.map(lead => {
                const s = STATUS_LABEL[lead.status] || STATUS_LABEL.new;
                const selected = selectedLead?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={cn(
                      'w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center gap-3',
                      selected && 'bg-violet-50 hover:bg-violet-50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{lead.clientName}</span>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', s.color)}>{s.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.id} · {lead.destination} · {lead.pax} pax · {lead.travelDates}
                      </p>
                      {lead.notes && (
                        <p className="text-[11px] text-foreground/60 truncate mt-1 italic">"{lead.notes}"</p>
                      )}
                    </div>
                    <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', selected && 'rotate-90 text-violet-600')} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spark tasks panel */}
          <div className="bg-card border border-border rounded-xl p-4 h-fit lg:sticky lg:top-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <h2 className="text-sm font-semibold">Encarregar Spark</h2>
            </div>

            {!selectedLead ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Seleccione um lead à esquerda para ver as tarefas disponíveis.
              </p>
            ) : (
              <>
                <div className="p-2.5 bg-muted/40 rounded-lg mb-3">
                  <p className="text-xs font-semibold truncate">{selectedLead.clientName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedLead.id} · {selectedLead.destination}
                  </p>
                  <Link
                    to={`/leads/${selectedLead.id}`}
                    className="text-[11px] text-violet-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    Abrir ficha completa <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-1.5">
                  {SPARK_TASKS.map(task => {
                    const Icon = task.icon;
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleDelegate(selectedLead, task.label)}
                        className="w-full text-left p-2.5 rounded-lg border border-border hover:border-violet-300 hover:bg-violet-50/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon className="h-3.5 w-3.5 text-violet-600" />
                          <span className="text-xs font-semibold">{task.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{task.description}</p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AgentControlPage;
