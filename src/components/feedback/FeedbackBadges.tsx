import { cn } from '@/lib/utils';
import {
  TYPE_LABELS, TYPE_CLASSES, STATUS_LABELS, STATUS_CLASSES,
  SEVERITY_DOT, SEVERITY_LABELS, PRIORITY_CLASSES, PRIORITY_LABELS,
  type FeedbackType, type FeedbackStatus, type FeedbackSeverity, type FeedbackPriority,
} from '@/lib/feedbackConstants';

export const TypeBadge = ({ type, className }: { type: FeedbackType; className?: string }) => (
  <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium', TYPE_CLASSES[type], className)}>
    {TYPE_LABELS[type]}
  </span>
);

export const StatusBadge = ({ status, className }: { status: FeedbackStatus; className?: string }) => (
  <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium', STATUS_CLASSES[status], className)}>
    {STATUS_LABELS[status]}
  </span>
);

export const SeverityDot = ({ severity }: { severity: FeedbackSeverity | null | undefined }) => {
  if (!severity) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title={SEVERITY_LABELS[severity]}>
      <span className={cn('h-2 w-2 rounded-full', SEVERITY_DOT[severity])} />
      {SEVERITY_LABELS[severity]}
    </span>
  );
};

export const PriorityChip = ({ priority }: { priority: FeedbackPriority | null | undefined }) => {
  if (!priority) return null;
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold', PRIORITY_CLASSES[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
};
