import type { Agent } from '@/hooks/useAIOffice';
import AgentCharacter from './AgentCharacter';

interface Props {
  agents: Agent[];
  pendingApprovals: number;
  onAgentClick: (agent: Agent) => void;
}

export default function PixelOfficeCanvas({ agents, pendingApprovals, onAgentClick }: Props) {
  // Group agents by row (y position)
  const rows = new Map<number, Agent[]>();
  agents.forEach(a => {
    const y = a.desk_position.y;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push(a);
  });
  const sortedRows = [...rows.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="flex-1 overflow-auto relative" style={{
      background: `
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 63px,
          rgba(0,0,0,0.03) 63px,
          rgba(0,0,0,0.03) 64px
        ),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 63px,
          rgba(0,0,0,0.03) 63px,
          rgba(0,0,0,0.03) 64px
        ),
        linear-gradient(135deg, hsl(30 30% 82%), hsl(30 25% 75%))
      `,
    }}>
      {/* Office walls - top */}
      <div className="h-10 bg-gradient-to-b from-[hsl(215,20%,30%)] to-[hsl(215,15%,40%)] border-b-2 border-[hsl(30,30%,50%)] flex items-center justify-center gap-6">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="w-10 h-6 bg-[hsl(200,60%,75%)]/40 rounded-sm border border-[hsl(215,20%,50%)]" />
        ))}
      </div>

      {/* Office floor with desks */}
      <div className="flex flex-col items-center gap-6 py-6 px-4 min-h-[400px]">
        {sortedRows.map(([y, rowAgents]) => (
          <div key={y} className="flex items-end justify-center gap-4 md:gap-8 flex-wrap">
            {rowAgents
              .sort((a, b) => a.desk_position.x - b.desk_position.x)
              .map(agent => (
                <AgentCharacter
                  key={agent.agent_id}
                  agent={agent}
                  hasPendingApproval={agent.agent_id === 'ceo_advisor' && pendingApprovals > 0}
                  onClick={() => onAgentClick(agent)}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
