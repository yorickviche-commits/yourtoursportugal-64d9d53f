import { cn } from '@/lib/utils';
import type { Agent } from '@/hooks/useAIOffice';

interface Props {
  agent: Agent;
  hasPendingApproval?: boolean;
  onClick: () => void;
}

const statusDotColor: Record<string, string> = {
  working: 'bg-[#22c55e]',
  reading: 'bg-[#22c55e]',
  waiting: 'bg-[#f59e0b]',
  idle: 'bg-[#6b7280]',
  error: 'bg-[#ef4444]',
  offline: 'bg-[#374151]',
};

const statusAnimation: Record<string, string> = {
  idle: 'animate-[bob_2s_ease-in-out_infinite]',
  working: 'animate-[typing_0.3s_ease-in-out_infinite]',
  reading: 'animate-[tilt_0.8s_ease-in-out_infinite]',
  waiting: '',
  error: 'animate-[flash_1s_ease-in-out_infinite]',
  offline: 'opacity-40',
};

export default function AgentCharacter({ agent, hasPendingApproval, onClick }: Props) {
  const isCeo = agent.agent_id === 'ceo_advisor';
  const deskW = isCeo ? 100 : 80;
  const deskH = isCeo ? 56 : 48;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 group cursor-pointer focus:outline-none relative"
      title={`${agent.display_name} — ${agent.status}`}
    >
      {/* Speech bubble for waiting */}
      {agent.status === 'waiting' && agent.waiting_for && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-1.5 py-0.5 text-[8px] text-foreground whitespace-nowrap animate-pulse z-10 shadow-sm"
          style={{ fontFamily: "'Press Start 2P', monospace" }}>
          {agent.waiting_for.slice(0, 18)}
          <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-card border-r border-b border-border rotate-45" />
        </div>
      )}

      {/* CEO star */}
      {isCeo && hasPendingApproval && (
        <span className="absolute -top-3 -right-1 text-sm animate-pulse">⭐</span>
      )}

      {/* Character */}
      <div className={cn('relative', statusAnimation[agent.status] || '')}>
        {/* Head */}
        <div
          className="w-6 h-6 rounded-sm mx-auto border border-black/20"
          style={{ backgroundColor: agent.character_color }}
        />
        {/* Body */}
        <div
          className="w-8 h-5 rounded-sm mx-auto -mt-0.5 border border-black/10"
          style={{ backgroundColor: agent.character_color, filter: 'brightness(0.8)' }}
        />
        {/* Arms */}
        <div className="absolute top-6 -left-1 w-1.5 h-4 rounded-sm" style={{ backgroundColor: agent.character_color, filter: 'brightness(0.7)' }} />
        <div className="absolute top-6 -right-1 w-1.5 h-4 rounded-sm" style={{ backgroundColor: agent.character_color, filter: 'brightness(0.7)' }} />
      </div>

      {/* Desk */}
      <div
        className="rounded-sm border border-black/10 relative mt-0.5"
        style={{
          width: deskW,
          height: deskH,
          background: 'linear-gradient(135deg, hsl(30 40% 55%), hsl(30 35% 45%))',
        }}
      >
        {/* Monitor on desk */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-3.5 bg-[#374151] rounded-sm border border-black/20">
          <div className="w-3.5 h-2 bg-[#3b82f6]/60 mx-auto mt-0.5 rounded-[1px]" />
        </div>
        {/* Status dot */}
        <div className={cn('absolute bottom-1 right-1 w-2 h-2 rounded-full border border-black/20', statusDotColor[agent.status] || statusDotColor.offline)} />
      </div>

      {/* Name */}
      <span
        className="text-[7px] text-foreground/80 mt-0.5 leading-tight text-center max-w-[90px] truncate group-hover:text-foreground transition-colors"
        style={{ fontFamily: "'Press Start 2P', monospace" }}
      >
        {agent.display_name}
      </span>
    </button>
  );
}
