import { useEffect, useState } from 'react';
import { Bug } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import FeedbackDialog from './FeedbackDialog';

const isTypingTarget = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable;
};

const FeedbackLauncher = () => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('tcc:open-feedback', handler);
    return () => window.removeEventListener('tcc:open-feedback', handler);
  }, []);

  return (
    <>
      {!isMobile && (
        <button
          onClick={() => setOpen(true)}
          title="Reportar bug / sugestão (Ctrl+Shift+F)"
          aria-label="Reportar bug ou sugestão"
          className="fixed bottom-6 right-[292px] z-40 h-12 w-12 bg-white hover:bg-slate-50 text-[#0a2540] border border-slate-200 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <Bug className="h-5 w-5" />
        </button>
      )}
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default FeedbackLauncher;
