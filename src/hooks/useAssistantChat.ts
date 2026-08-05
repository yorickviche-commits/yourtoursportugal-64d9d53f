import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  next_steps?: { label: string; route?: string }[];
  error?: boolean;
}

export interface AssistantConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: AssistantMessage[];
}

const KEY = 'yt_assistant_conversations_v1';
const MAX_CONVERSATIONS = 30;

const load = (): AssistantConversation[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const save = (list: AssistantConversation[]) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)));
  } catch { /* quota */ }
};

const newConversation = (): AssistantConversation => ({
  id: (crypto?.randomUUID?.() ?? String(Date.now())),
  title: 'Nova conversa',
  updatedAt: new Date().toISOString(),
  messages: [],
});

export const useAssistantChat = (context: Record<string, unknown>) => {
  const [conversations, setConversations] = useState<AssistantConversation[]>(() => {
    const stored = load();
    return stored.length ? stored : [newConversation()];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = load();
    return stored[0]?.id ?? '';
  });
  const [loading, setLoading] = useState(false);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  useEffect(() => { save(conversations); }, [conversations]);

  const active = conversations.find(c => c.id === activeId) ?? conversations[0];

  const patchActive = useCallback((fn: (c: AssistantConversation) => AssistantConversation) => {
    setConversations(prev => {
      const next = prev.map(c => (c.id === (activeId || prev[0]?.id) ? fn(c) : c));
      const idx = next.findIndex(c => c.id === (activeId || prev[0]?.id));
      if (idx > 0) {
        const [moved] = next.splice(idx, 1);
        next.unshift(moved);
      }
      return next;
    });
  }, [activeId]);

  const startNew = useCallback(() => {
    const conv = newConversation();
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      const result = next.length ? next : [newConversation()];
      setActiveId(cur => (cur === id ? result[0].id : cur));
      return result;
    });
  }, []);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;

    const history = [...(active?.messages ?? []), { role: 'user' as const, content: clean }];
    patchActive(c => ({
      ...c,
      title: c.messages.length === 0 ? clean.slice(0, 60) : c.title,
      updatedAt: new Date().toISOString(),
      messages: history,
    }));
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context: contextRef.current,
        },
      });

      let reply = '';
      let suggestions: string[] = [];
      let next_steps: { label: string; route?: string }[] = [];
      let failed = false;

      if (error) {
        let msg = error.message || 'Erro ao contactar o assistente.';
        const ctx: any = (error as any).context;
        if (ctx?.text) {
          try {
            const parsed = JSON.parse(await ctx.text());
            if (parsed?.error) msg = parsed.error;
          } catch { /* ignore */ }
        }
        reply = msg;
        failed = true;
      } else if (data?.error) {
        reply = data.error;
        failed = true;
      } else {
        reply = data?.reply || 'Sem resposta.';
        suggestions = data?.suggestions ?? [];
        next_steps = data?.next_steps ?? [];
      }

      patchActive(c => ({
        ...c,
        updatedAt: new Date().toISOString(),
        messages: [...history, { role: 'assistant', content: reply, suggestions, next_steps, error: failed }],
      }));
    } finally {
      setLoading(false);
    }
  }, [active, loading, patchActive]);

  return {
    conversations,
    active,
    activeId: active?.id,
    setActiveId,
    startNew,
    deleteConversation,
    send,
    loading,
  };
};
