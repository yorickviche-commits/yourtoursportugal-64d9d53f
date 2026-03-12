import { useState } from 'react';
import { useAIOffice, type Agent } from '@/hooks/useAIOffice';
import AppLayout from '@/components/AppLayout';
import OfficeTopBar from '@/components/ai-office/OfficeTopBar';
import PixelOfficeCanvas from '@/components/ai-office/PixelOfficeCanvas';
import ActivityFeed from '@/components/ai-office/ActivityFeed';
import AgentDetailPanel from '@/components/ai-office/AgentDetailPanel';
import CeoApprovalPanel from '@/components/ai-office/CeoApprovalPanel';
import { Button } from '@/components/ui/button';

export default function AIWorkOfficePage() {
  const { agents, activityFeed, pendingApprovals, loading, error, statusCounts, handleApproval, refetch } = useAIOffice();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [showCeoPanel, setShowCeoPanel] = useState(false);

  const handleAgentClick = (agent: Agent) => {
    if (agent.agent_id === 'ceo_advisor') {
      setShowCeoPanel(true);
    } else {
      setSelectedAgent(agent);
      setShowAgentPanel(true);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center space-y-3">
            <p style={{ fontFamily: "'Press Start 2P', monospace" }} className="text-xs text-foreground animate-pulse">
              Booting AI Office...
            </p>
            <span className="inline-block w-3 h-5 bg-foreground animate-[blink_1s_step-end_infinite]" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center space-y-4">
            <p style={{ fontFamily: "'Press Start 2P', monospace" }} className="text-xs text-destructive">
              CONNECTION LOST
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={refetch} variant="outline" size="sm">Retry</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-1rem)] md:h-screen overflow-hidden">
        <OfficeTopBar
          statusCounts={statusCounts}
          pendingCount={pendingApprovals.length}
          onCeoClick={() => setShowCeoPanel(true)}
        />

        {/* Office - 65% */}
        <div className="flex-[65] min-h-0 overflow-hidden">
          <PixelOfficeCanvas
            agents={agents}
            pendingApprovals={pendingApprovals.length}
            onAgentClick={handleAgentClick}
          />
        </div>

        {/* Activity Feed - 35% */}
        <div className="flex-[35] min-h-0 border-t border-border bg-card/50">
          <div className="h-full flex flex-col">
            <div className="px-3 py-1.5 border-b border-border">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider"
                style={{ fontFamily: "'Press Start 2P', monospace" }}>
                Activity Feed
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <ActivityFeed entries={activityFeed} agents={agents} />
            </div>
          </div>
        </div>
      </div>

      <AgentDetailPanel
        agent={selectedAgent}
        open={showAgentPanel}
        onClose={() => setShowAgentPanel(false)}
        activityLog={activityFeed}
      />

      <CeoApprovalPanel
        open={showCeoPanel}
        onClose={() => setShowCeoPanel(false)}
        approvals={pendingApprovals}
        onDecide={handleApproval}
      />
    </AppLayout>
  );
}
