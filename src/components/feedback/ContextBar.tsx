import { Info } from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CapturedContext } from '@/lib/feedbackContext';

interface Props {
  ctx: CapturedContext;
  reporterName: string;
  roles: string[];
}

const ContextBar = ({ ctx, reporterName, roles }: Props) => {
  const parts = [
    `📍 ${ctx.page_route}`,
    ctx.lead_ref,
    `👤 ${reporterName}${roles.length ? ` (${roles.join(', ')})` : ''}`,
    `🕒 ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    ctx.browser,
    ctx.os,
    ctx.viewport,
    ctx.app_version,
  ].filter(Boolean);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{parts.join(' · ')}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        Este contexto é enviado automaticamente para ajudar a reproduzir o problema.
      </TooltipContent>
    </Tooltip>
  );
};

export default ContextBar;
