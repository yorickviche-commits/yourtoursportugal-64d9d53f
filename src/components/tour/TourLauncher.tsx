import { HelpCircle } from 'lucide-react';
import { useTour } from './TourProvider';

export const TourLauncher = () => {
  const { start, running } = useTour();
  if (running) return null;
  return (
    <button
      onClick={start}
      title="Reabrir tutorial"
      className="fixed bottom-6 right-[180px] z-40 h-12 w-12 bg-white hover:bg-slate-50 text-[#0a2540] border border-slate-200 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
};

export default TourLauncher;
