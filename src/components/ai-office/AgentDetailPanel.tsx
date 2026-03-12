import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Agent, ActivityEntry } from '@/hooks/useAIOffice';

interface Props {
  agent: Agent | null;
  open: boolean;
  onClose: () => void;
  activityLog: ActivityEntry[];
}

const statusLabel: Record<string, { label: string; className: string }> = {
  working: { label: 'Working', className: 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30' },
  reading: { label: 'Reading', className: 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30' },
  waiting: { label: 'Waiting', className: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30' },
  idle: { label: 'Idle', className: 'bg-[#6b7280]/20 text-[#6b7280] border-[#6b7280]/30' },
  error: { label: 'Error', className: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30' },
  offline: { label: 'Offline', className: 'bg-[#374151]/20 text-[#374151] border-[#374151]/30' },
};

export default function AgentDetailPanel({ agent, open, onClose, activityLog }: Props) {
  if (!agent) return null;

  const agentLog = activityLog.filter(e => e.agent_id === agent.agent_id).slice(0, 10);
  const st = statusLabel[agent.status] || statusLabel.offline;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[380px] max-w-full p-0">
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md border border-black/10" style={{ backgroundColor: agent.character_color }} />
            <div>
              <SheetTitle className="text-sm">{agent.display_name}</SheetTitle>
              <p className="text-[11px] text-muted-foreground">{agent.role_description}</p>
            </div>
          </div>
          <Badge variant="outline" className={`mt-2 text-[10px] ${st.className}`}>{st.label}</Badge>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Current task */}
          {agent.current_task && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Current Task</p>
              <p className="text-sm text-foreground">{agent.current_task}</p>
            </div>
          )}

          {/* Waiting for */}
          {agent.status === 'waiting' && agent.waiting_for && (
            <div className="p-2 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20">
              <p className="text-[10px] uppercase text-[#f59e0b] font-semibold mb-0.5">Waiting For</p>
              <p className="text-sm text-foreground">{agent.waiting_for}</p>
            </div>
          )}

          {/* Activity log */}
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2">Recent Activity</p>
            <ScrollArea className="h-[350px]">
              {agentLog.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-2">
                  {agentLog.map(entry => (
                    <div key={entry.id} className="text-xs border-l-2 pl-2 py-1" style={{ borderLeftColor: agent.character_color }}>
                      <p className="text-foreground">{entry.event_summary}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: pt })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
