import { cn } from '@/lib/utils';

export type ClientType = 'B2C' | 'B2B';

export const normalizeClientType = (v?: string | null): ClientType =>
  (v || '').toUpperCase() === 'B2B' ? 'B2B' : 'B2C';

/** Compact tag showing whether a lead is a direct client (B2C) or a partner/agency (B2B). */
const ClientTypeBadge = ({ value, className }: { value?: string | null; className?: string }) => {
  const type = normalizeClientType(value);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border',
        type === 'B2B'
          ? 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.4)]'
          : 'bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.4)]',
        className,
      )}
    >
      {type}
    </span>
  );
};

export default ClientTypeBadge;
