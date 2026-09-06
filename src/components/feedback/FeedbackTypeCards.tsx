import { Bug, Zap, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TYPE_LABELS, TYPE_DESCRIPTIONS, type FeedbackType } from '@/lib/feedbackConstants';

const CARDS: { type: FeedbackType; icon: typeof Bug; accent: string }[] = [
  { type: 'bug', icon: Bug, accent: 'text-red-600' },
  { type: 'improvement', icon: Zap, accent: 'text-amber-600' },
  { type: 'suggestion', icon: Lightbulb, accent: 'text-sky-600' },
];

const FeedbackTypeCards = ({ onSelect }: { onSelect: (t: FeedbackType) => void }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {CARDS.map(({ type, icon: Icon, accent }, i) => (
      <button
        key={type}
        autoFocus={i === 0}
        onClick={() => onSelect(type)}
        className={cn(
          'flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-all',
          'hover:border-[#0a2540] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      >
        <Icon className={cn('h-6 w-6', accent)} />
        <span className="text-sm font-semibold">{TYPE_LABELS[type]}</span>
        <span className="text-xs text-muted-foreground">{TYPE_DESCRIPTIONS[type]}</span>
      </button>
    ))}
  </div>
);

export default FeedbackTypeCards;
