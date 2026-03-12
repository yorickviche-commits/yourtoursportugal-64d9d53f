import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ActivityEntry, Agent } from '@/hooks/useAIOffice';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Props {
  entries: ActivityEntry[];
  agents: Agent[];
}

export default function ActivityFeed({ entries, agents }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const agentMap = new Map(agents.map(a => [a.agent_id, a]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs" style={{ fontFamily: "'Press Start 2P', monospace" }}>
        Waiting for agent activity...
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-3">
        {[...entries].reverse().map(entry => {
          const agent = agentMap.get(entry.agent_id);
          const color = agent?.character_color || '#6b7280';
          return (
            <div
              key={entry.id}
              className={cn(
                'flex items-start gap-2 px-2 py-1.5 rounded text-xs border-l-2',
                entry.requires_action ? 'bg-destructive/5' : 'bg-card/50'
              )}
              style={{ borderLeftColor: color }}
            >
              {entry.requires_action && <span className="shrink-0 mt-0.5">🔴</span>}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{agent?.display_name || entry.agent_id}</span>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="text-foreground/80">{entry.event_summary}</span>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
