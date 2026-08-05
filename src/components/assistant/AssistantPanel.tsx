import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot, X, Minus, Maximize2, Minimize2, Send, Plus, History, Trash2, ArrowRight, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssistantChat } from '@/hooks/useAssistantChat';

interface Props {
  onClose: () => void;
  onMinimize: () => void;
}

const routeSuggestions = (path: string, leadId?: string): string[] => {
  if (leadId) {
    return [
      'Resume o estado desta lead',
      'Margem prevista vs real desta lead',
      'O que falta confirmar nas operações?',
      'Qual o próximo passo comercial?',
    ];
  }
  if (path.startsWith('/trips')) return ['Viagens nos próximos 7 dias', 'Que viagens têm bloqueios?', 'Reservas sem confirmação'];
  if (path.startsWith('/comercial') || path.startsWith('/partners')) return ['Preços net do fornecedor…', 'Condições de cancelamento de…', 'Fornecedores no Douro'];
  if (path.startsWith('/products') || path.startsWith('/catalog')) return ['Que produtos incluem Douro?', 'Preço e duração de…', 'Produtos com cancelamento flexível'];
  if (path.startsWith('/payments')) return ['Links de pagamento ativos', 'Que leads não têm link criado?'];
  if (path.startsWith('/tasks')) return ['Tarefas em atraso', 'Tarefas de operações abertas'];
  return [
    'O que é urgente hoje?',
    'Leads em espera de proposta',
    'Viagens nos próximos 7 dias',
    'Tarefas em atraso',
  ];
};

const AssistantPanel = ({ onClose, onMinimize }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [maximized, setMaximized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const leadId = location.pathname.startsWith('/leads/') ? params.id : undefined;

  const context = useMemo(
    () => ({ route: location.pathname, lead_id: leadId ?? null }),
    [location.pathname, leadId],
  );

  const {
    conversations, active, activeId, setActiveId, startNew, deleteConversation, send, loading,
  } = useAssistantChat(context);

  const messages = active?.messages ?? [];
  const last = messages[messages.length - 1];
  const chips = (last?.role === 'assistant' && last.suggestions?.length)
    ? last.suggestions
    : messages.length === 0 ? routeSuggestions(location.pathname, leadId) : [];

  useEffect(() => { inputRef.current?.focus(); }, [activeId, loading]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, loading]);

  const submit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value) return;
    setInput('');
    void send(value);
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col bg-card border shadow-2xl',
        maximized
          ? 'inset-2 md:inset-8 rounded-xl'
          : 'inset-x-0 bottom-0 top-0 md:inset-y-4 md:right-4 md:left-auto md:w-[420px] md:rounded-xl',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-[#0a2540] text-white md:rounded-t-xl">
        <Bot className="h-4 w-4" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">YT Copilot</p>
          <p className="text-[10px] text-white/60 truncate">
            {loading ? 'a analisar dados…' : 'leads · fornecedores · produtos · operações'}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/10"
          title="Histórico" onClick={() => setShowHistory(v => !v)}>
          <History className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/10"
          title="Nova conversa" onClick={() => { startNew(); setShowHistory(false); }}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/10"
          title={maximized ? 'Reduzir' : 'Maximizar'} onClick={() => setMaximized(v => !v)}>
          {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/10"
          title="Minimizar" onClick={onMinimize}>
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/10"
          title="Fechar" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* History */}
        {showHistory && (
          <div className="w-44 shrink-0 border-r bg-muted/30 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations.map(c => (
                  <div
                    key={c.id}
                    className={cn(
                      'group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs cursor-pointer',
                      c.id === activeId ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                    )}
                    onClick={() => setActiveId(c.id)}
                  >
                    <span className="flex-1 truncate">{c.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); deleteConversation(c.id); }}
                      title="Eliminar conversa"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Conversation */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1">
            <div className={cn('p-3 space-y-3', maximized && 'max-w-3xl mx-auto')}>
              {messages.length === 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Em que posso ajudar?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pergunta sobre estados e dados de leads, fornecedores e condições, preços de
                    produtos, operações, margens ou pagamentos.
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <div className="w-full space-y-2">
                      <div className={cn(
                        'prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed',
                        '[&_p]:my-1.5 [&_ul]:my-1.5 [&_li]:my-0.5 [&_table]:text-xs',
                        m.error && 'text-destructive',
                      )}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                      {!!m.next_steps?.length && (
                        <div className="flex flex-wrap gap-1.5">
                          {m.next_steps.map((s, k) => (
                            <Button
                              key={k}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => s.route && navigate(s.route)}
                              disabled={!s.route}
                            >
                              {s.label} <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> a consultar dados…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Suggestions */}
          {!loading && chips.length > 0 && (
            <div className={cn('px-3 pb-2 flex flex-wrap gap-1.5', maximized && 'max-w-3xl mx-auto w-full')}>
              {chips.map((s, i) => (
                <button
                  key={i}
                  onClick={() => submit(s)}
                  className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className={cn('border-t p-2.5', maximized && 'max-w-3xl mx-auto w-full')}>
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Pergunta sobre leads, fornecedores, preços…"
                rows={1}
                className="min-h-[38px] max-h-32 resize-none text-sm"
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => submit()} disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantPanel;
