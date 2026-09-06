import { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react';
import type { FeedbackModule } from '@/lib/feedbackContext';

interface Hint {
  module?: FeedbackModule;
  leadRef?: string | null;
}

interface FeedbackContextValue {
  hint: Hint;
  setHint: (h: Hint) => void;
}

const Ctx = createContext<FeedbackContextValue>({ hint: {}, setHint: () => {} });

export const FeedbackHintProvider = ({ children }: { children: ReactNode }) => {
  const [hint, setHintState] = useState<Hint>({});
  const setHint = useCallback((h: Hint) => setHintState(h), []);
  return <Ctx.Provider value={{ hint, setHint }}>{children}</Ctx.Provider>;
};

export const useFeedbackHint = () => useContext(Ctx).hint;

/**
 * Publica o módulo/referência da página atual para o pop-up de feedback.
 * Usado nas páginas onde a rota não distingue o módulo (ex: tabs da lead).
 */
export function usePublishFeedbackHint(module: FeedbackModule | undefined, leadRef?: string | null) {
  const { setHint } = useContext(Ctx);
  useEffect(() => {
    setHint({ module, leadRef });
    return () => setHint({});
  }, [module, leadRef, setHint]);
}
