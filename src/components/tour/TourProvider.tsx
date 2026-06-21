import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS, TooltipRenderProps } from 'react-joyride';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tourSteps, YTStep } from './tourSteps';

const STORAGE_KEY = 'yt_tour_completed';
const TOUR_VERSION = 'v1';

interface TourCtx { start: () => void; running: boolean; }
const TourContext = createContext<TourCtx>({ start: () => {}, running: false });
export const useTour = () => useContext(TourContext);

const tagColors: Record<string, string> = {
  Sales: 'bg-blue-100 text-blue-800 border-blue-200',
  Ops: 'bg-amber-100 text-amber-800 border-amber-200',
  Ambos: 'bg-slate-100 text-slate-700 border-slate-200',
};

const YTTooltip = ({
  index, size, step, backProps, primaryProps, skipProps, closeProps, isLastStep, tooltipProps,
}: TooltipRenderProps) => {
  const s = step as YTStep;
  return (
    <div
      {...tooltipProps}
      className="bg-background border border-border rounded-xl shadow-2xl w-[380px] max-w-[92vw] max-h-[80vh] flex flex-col overflow-hidden"
    >
      {/* HEADER + AÇÕES (no topo para garantir que estão sempre visíveis) */}
      <div className="bg-[#0a2540] text-white px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide', tagColors[s.tag])}>
                {s.tag}
              </span>
              {s.ai && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-400/30 font-semibold uppercase tracking-wide inline-flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> IA
                </span>
              )}
              <span className="text-[10px] text-white/60 ml-auto">{index + 1} / {size}</span>
            </div>
            <h3 className="text-sm font-semibold leading-tight">{s.title}</h3>
          </div>
          <button {...closeProps} className="text-white/60 hover:text-white shrink-0" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <button {...skipProps} className="text-[11px] text-white/60 hover:text-white">
            Saltar
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button {...backProps} size="sm" variant="outline" className="h-7 px-3 text-xs bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white">
                Anterior
              </Button>
            )}
            <Button {...primaryProps} size="sm" className="h-7 px-3 text-xs bg-white text-[#0a2540] hover:bg-white/90 font-semibold">
              {isLastStep ? 'Concluir' : 'Próximo →'}
            </Button>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 text-sm text-foreground leading-relaxed overflow-y-auto">
        {step.content}
      </div>
    </div>
  );
};

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  // Auto-launch on first login
  useEffect(() => {
    if (!user) return;
    const done = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (done === TOUR_VERSION) return;
    const t = setTimeout(() => {
      setStepIndex(0);
      setRun(true);
    }, 800);
    return () => clearTimeout(t);
  }, [user]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      localStorage.setItem(STORAGE_KEY, TOUR_VERSION);
      setRun(false);
      setStepIndex(0);
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      const nextStep = tourSteps[nextIndex];
      if (nextStep?.route && nextStep.route !== location.pathname) {
        setRun(false);
        navigate(nextStep.route);
        setTimeout(() => {
          setStepIndex(nextIndex);
          setRun(true);
        }, 500);
      } else {
        setStepIndex(nextIndex);
      }
    }
  }, [navigate, location.pathname]);

  return (
    <TourContext.Provider value={{ start, running: run }}>
      {children}
      <Joyride
        steps={tourSteps}
        stepIndex={stepIndex}
        run={run}
        continuous
        showSkipButton
        scrollToFirstStep
        disableOverlayClose
        spotlightPadding={6}
        tooltipComponent={YTTooltip}
        callback={handleCallback}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: '#0a2540',
            overlayColor: 'rgba(10, 37, 64, 0.55)',
            primaryColor: '#0a2540',
          },
        }}
        floaterProps={{ disableAnimation: false }}
      />
    </TourContext.Provider>
  );
};
