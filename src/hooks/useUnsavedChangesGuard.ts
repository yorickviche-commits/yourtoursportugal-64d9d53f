import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Guarda contra navegação com alterações por gravar.
 * - Ativa beforeunload nativo (fechar/refresh browser).
 * - Intercepta cliques em <a href="/..."> internos para pedir confirmação.
 * - Intercepta botão de voltar (popstate).
 *
 * Devolve estado do modal + handlers para o consumidor renderizar a AlertDialog.
 */
export function useUnsavedChangesGuard(dirty: boolean, onSave: () => Promise<void> | void) {
  const navigate = useNavigate();
  const dirtyRef = useRef(dirty);
  const onSaveRef = useRef(onSave);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Browser close/refresh
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Internal link clicks
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement | null)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || target.getAttribute('target') === '_blank') return;
      // ignore same-page anchors
      if (href === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingUrl(href);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  // Back button
  useEffect(() => {
    if (!dirty) return;
    const state = { __guard: Date.now() };
    window.history.pushState(state, '');
    const onPop = () => {
      if (!dirtyRef.current) return;
      // re-push to keep user on page until they decide
      window.history.pushState(state, '');
      setPendingUrl(-1 as any);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dirty]);

  const cancel = useCallback(() => setPendingUrl(null), []);
  const discard = useCallback(() => {
    const url = pendingUrl;
    setPendingUrl(null);
    dirtyRef.current = false;
    if (url === -1 as any) window.history.back();
    else if (typeof url === 'string') navigate(url);
  }, [pendingUrl, navigate]);
  const saveAndLeave = useCallback(async () => {
    try {
      setSaving(true);
      await onSaveRef.current();
      const url = pendingUrl;
      setPendingUrl(null);
      dirtyRef.current = false;
      if (url === -1 as any) window.history.back();
      else if (typeof url === 'string') navigate(url);
    } finally {
      setSaving(false);
    }
  }, [pendingUrl, navigate]);

  return { open: pendingUrl !== null, saving, cancel, discard, saveAndLeave };
}
