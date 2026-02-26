import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  label: string;
  className: string;
}

const StatusBadge = ({ label, className }: StatusBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
