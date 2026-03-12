import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  Play, Zap, Calculator, FileText, Workflow, RefreshCw,
  AlertTriangle, Clock, CheckCircle2, XCircle, Eye, Send,
  UserCheck, Search, BarChart3, MessageSquare, Loader2
} from 'lucide-react';
import { useAgentPipeline } from '@/hooks/useAgentPipeline';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Agent, ActivityEntry } from '@/hooks/useAIOffice';

interface Props {
  agent: Agent | null;
  open: boolean;
  onClose: () => void;
  activityLog: ActivityEntry[];
}

const statusLabel: Record<string, { label: string; className: string }> = {
  working: { label: 'Working', className: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30' },
  reading: { label: 'Reading', className: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30' },
  waiting: { label: 'Waiting', className: 'bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30' },
  idle: { label: 'Idle', className: 'bg-muted text-muted-foreground border-border' },
  error: { label: 'Error', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  offline: { label: 'Offline', className: 'bg-muted text-muted-foreground border-border' },
};

// Agent-specific commands
const agentCommands: Record<string, { label: string; icon: any; action: string; description: string }[]> = {
  lead_qualifier: [
    { label: 'Qualify All New Leads', icon: UserCheck, action: 'qualify_all', description: 'Score & qualify all leads with status "new"' },
    { label: 'Re-score Lead', icon: RefreshCw, action: 'rescore', description: 'Re-evaluate a specific lead scoring' },
    { label: 'Check Stale Leads', icon: Clock, action: 'check_stale', description: 'Find leads without updates >48h' },
  ],
  proposal_builder: [
    { label: 'Generate Travel Plan', icon: Zap, action: 'plan', description: 'Create day-by-day travel plan for qualified lead' },
    { label: 'Full Pipeline', icon: Workflow, action: 'full_pipeline', description: 'Plan → Budget → Itinerary end-to-end' },
    { label: 'Regenerate Plan', icon: RefreshCw, action: 'regenerate_plan', description: 'Redo plan for lead with existing version' },
  ],
  followup_writer: [
    { label: 'Draft Follow-up Email', icon: Send, action: 'followup_email', description: 'Generate follow-up for leads without contact >3 days' },
    { label: 'Check Pending Follow-ups', icon: Eye, action: 'check_followups', description: 'List leads needing follow-up' },
  ],
  b2b_partner: [
    { label: 'Sync Partner Rates', icon: RefreshCw, action: 'sync_rates', description: 'Refresh rates from partner database' },
    { label: 'Check Expiring Contracts', icon: AlertTriangle, action: 'check_contracts', description: 'Partners with contracts expiring <30 days' },
  ],
  itinerary_architect: [
    { label: 'Generate Itinerary', icon: FileText, action: 'itinerary', description: 'Create digital itinerary from approved plan' },
    { label: 'Generate Travel Plan', icon: Zap, action: 'plan', description: 'Build structured day-by-day plan' },
    { label: 'Search Destination Images', icon: Search, action: 'search_images', description: 'Find photos for itinerary days' },
  ],
  pricing_margin: [
    { label: 'Calculate Budget', icon: Calculator, action: 'cost', description: 'Auto-fulfill costing from travel plan' },
    { label: 'Check Margin Health', icon: BarChart3, action: 'check_margins', description: 'Identify trips with margin <25%' },
    { label: 'Recalculate All', icon: RefreshCw, action: 'recalculate', description: 'Redo budget with latest supplier rates' },
  ],
  operations_coordinator: [
    { label: 'Create Operations Tasks', icon: Play, action: 'create_ops_tasks', description: 'Generate tasks from confirmed trip costing' },
    { label: 'Check Unconfirmed Bookings', icon: AlertTriangle, action: 'check_bookings', description: 'Suppliers not yet confirmed for D-7 trips' },
  ],
  supplier_comms: [
    { label: 'Draft Booking Emails', icon: Send, action: 'draft_bookings', description: 'Generate booking request emails for trip' },
    { label: 'Check Pending Responses', icon: Clock, action: 'check_responses', description: 'Suppliers without response >48h' },
  ],
  crm_manager: [
    { label: 'Sync CRM Data', icon: RefreshCw, action: 'sync_crm', description: 'Pull latest from NetHunt' },
    { label: 'Update Lead Stages', icon: UserCheck, action: 'update_stages', description: 'Sync pipeline stages to CRM' },
  ],
  payment_monitor: [
    { label: 'Check Overdue Payments', icon: AlertTriangle, action: 'check_payments', description: 'Find payments past due date' },
    { label: 'Payment Summary', icon: BarChart3, action: 'payment_summary', description: 'Current payment status across trips' },
  ],
  customer_success: [
    { label: 'Check Active Trips', icon: Eye, action: 'check_active', description: 'Trips in progress needing attention' },
    { label: 'Send Satisfaction Survey', icon: MessageSquare, action: 'send_survey', description: 'Post-trip follow-up for completed trips' },
  ],
  review_reputation: [
    { label: 'Check Pending Reviews', icon: Eye, action: 'check_reviews', description: 'Completed trips without reviews' },
    { label: 'Generate Review Request', icon: Send, action: 'review_request', description: 'Draft review request email' },
  ],
};

// Smart alerts generation
interface SmartAlert {
  type: 'warning' | 'error' | 'info';
  message: string;
  detail?: string;
}

function useAgentSmartAlerts(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent_smart_alerts', agentId],
    enabled: !!agentId,
    refetchInterval: 60000,
    queryFn: async (): Promise<SmartAlert[]> => {
      if (!agentId) return [];
      const alerts: SmartAlert[] = [];
      const now = new Date();

      if (agentId === 'lead_qualifier' || agentId === 'proposal_builder' || agentId === 'followup_writer') {
        // Check stale leads
        const { data: staleLeads } = await supabase
          .from('leads')
          .select('id, client_name, status, updated_at')
          .in('status', ['new', 'contacted', 'qualified'])
          .order('updated_at', { ascending: true })
          .limit(10);

        if (staleLeads) {
          const stale = staleLeads.filter(l => differenceInHours(now, new Date(l.updated_at)) > 48);
          if (stale.length > 0) {
            alerts.push({
              type: 'warning',
              message: `${stale.length} leads sem atualização há +48h`,
              detail: stale.slice(0, 3).map(l => l.client_name).join(', '),
            });
          }

          if (agentId === 'lead_qualifier') {
            const newLeads = staleLeads.filter(l => l.status === 'new');
            if (newLeads.length > 0) {
              alerts.push({
                type: 'info',
                message: `${newLeads.length} leads novos por qualificar`,
                detail: newLeads.slice(0, 3).map(l => l.client_name).join(', '),
              });
            }
          }

          if (agentId === 'proposal_builder') {
            const qualified = staleLeads.filter(l => l.status === 'qualified');
            if (qualified.length > 0) {
              alerts.push({
                type: 'info',
                message: `${qualified.length} leads qualificados sem proposta`,
              });
            }
          }

          if (agentId === 'followup_writer') {
            const contacted = staleLeads.filter(l =>
              l.status === 'contacted' && differenceInHours(now, new Date(l.updated_at)) > 72
            );
            if (contacted.length > 0) {
              alerts.push({
                type: 'warning',
                message: `${contacted.length} leads sem follow-up há +3 dias`,
                detail: contacted.slice(0, 3).map(l => l.client_name).join(', '),
              });
            }
          }
        }
      }

      if (agentId === 'pricing_margin') {
        const { data: pendingApprovals } = await supabase
          .from('ceo_approval_queue')
          .select('id, title, created_at')
          .eq('status', 'pending');

        if (pendingApprovals && pendingApprovals.length > 0) {
          const old = pendingApprovals.filter(a => differenceInHours(now, new Date(a.created_at)) > 24);
          if (old.length > 0) {
            alerts.push({
              type: 'error',
              message: `${old.length} aprovações pendentes há +24h`,
              detail: old.slice(0, 2).map(a => a.title).join(', '),
            });
          } else {
            alerts.push({
              type: 'info',
              message: `${pendingApprovals.length} aprovações pendentes`,
            });
          }
        }
      }

      if (agentId === 'operations_coordinator' || agentId === 'supplier_comms') {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, status, due_date')
          .eq('status', 'todo')
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true })
          .limit(20);

        if (tasks) {
          const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now);
          if (overdue.length > 0) {
            alerts.push({
              type: 'error',
              message: `${overdue.length} tarefas em atraso`,
              detail: overdue.slice(0, 2).map(t => t.title).join(', '),
            });
          }
          const upcoming = tasks.filter(t => {
            if (!t.due_date) return false;
            const h = differenceInHours(new Date(t.due_date), now);
            return h > 0 && h <= 48;
          });
          if (upcoming.length > 0) {
            alerts.push({
              type: 'warning',
              message: `${upcoming.length} tarefas vencem nas próximas 48h`,
            });
          }
        }
      }

      if (agentId === 'payment_monitor') {
        const { data: trips } = await supabase
          .from('trips')
          .select('id, client_name, status, start_date')
          .in('status', ['confirmed', 'in_progress'])
          .order('start_date', { ascending: true })
          .limit(20);

        if (trips) {
          const departing = trips.filter(t => {
            if (!t.start_date) return false;
            const h = differenceInHours(new Date(t.start_date), now);
            return h > 0 && h <= 168;
          });
          if (departing.length > 0) {
            alerts.push({
              type: 'info',
              message: `${departing.length} viagens partem nos próximos 7 dias`,
            });
          }
        }
      }

      return alerts;
    },
  });
}

export default function AgentDetailPanel({ agent, open, onClose, activityLog }: Props) {
  const { runAgent, running } = useAgentPipeline();
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);
  const { data: smartAlerts = [] } = useAgentSmartAlerts(agent?.agent_id);

  if (!agent) return null;

  const agentLog = activityLog.filter(e => e.agent_id === agent.agent_id).slice(0, 10);
  const st = statusLabel[agent.status] || statusLabel.offline;
  const commands = agentCommands[agent.agent_id] || [];

  const handleCommand = async (action: string) => {
    // Pipeline actions route through useAgentPipeline
    if (['plan', 'cost', 'itinerary', 'full_pipeline'].includes(action)) {
      // We need a lead — for now get most recent qualified lead
      setExecutingCommand(action);
      try {
        const targetStatus = action === 'cost' ? 'qualified' : action === 'itinerary' ? 'proposal_sent' : 'qualified';
        const { data: leads } = await supabase
          .from('leads')
          .select('id, client_name')
          .in('status', ['new', 'contacted', 'qualified', 'proposal_sent'])
          .order('updated_at', { ascending: false })
          .limit(1);

        if (leads && leads.length > 0) {
          await runAgent(action as any, leads[0].id);
        }
      } catch (e) {
        // toast handled in hook
      } finally {
        setExecutingCommand(null);
      }
      return;
    }

    // Other actions — log intent and show feedback
    setExecutingCommand(action);
    try {
      await supabase.from('agent_activity_log').insert({
        agent_id: agent.agent_id,
        event_type: 'command',
        event_summary: `Manual command: ${action}`,
        requires_action: false,
      });
      // Simulate command acknowledgment
      await new Promise(r => setTimeout(r, 1200));
    } finally {
      setExecutingCommand(null);
    }
  };

  const alertIcon = (type: string) => {
    if (type === 'error') return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    if (type === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0" />;
    return <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--info))] shrink-0" />;
  };

  const alertBg = (type: string) => {
    if (type === 'error') return 'bg-destructive/10 border-destructive/20';
    if (type === 'warning') return 'bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/20';
    return 'bg-[hsl(var(--info))]/10 border-[hsl(var(--info))]/20';
  };

  // Waiting time alert
  const waitingTooLong = agent.status === 'waiting' && agent.updated_at &&
    differenceInMinutes(new Date(), new Date(agent.updated_at)) > 30;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] max-w-full p-0">
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: agent.character_color }} />
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm">{agent.display_name}</SheetTitle>
              <p className="text-[11px] text-muted-foreground truncate">{agent.role_description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={`text-[10px] ${st.className}`}>{st.label}</Badge>
            {waitingTooLong && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 animate-pulse">
                ⏰ Waiting &gt;30min
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)]">
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
              <div className="p-2.5 rounded-md bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20">
                <p className="text-[10px] uppercase text-[hsl(var(--warning))] font-semibold mb-0.5">Waiting For</p>
                <p className="text-sm text-foreground">{agent.waiting_for}</p>
              </div>
            )}

            {/* Smart Alerts */}
            {smartAlerts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2">🧠 Intelligence</p>
                <div className="space-y-1.5">
                  {smartAlerts.map((alert, i) => (
                    <div key={i} className={`p-2 rounded-md border flex items-start gap-2 ${alertBg(alert.type)}`}>
                      {alertIcon(alert.type)}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{alert.message}</p>
                        {alert.detail && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{alert.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Commands */}
            {commands.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2">⚡ Commands</p>
                <div className="space-y-1.5">
                  {commands.map((cmd) => {
                    const Icon = cmd.icon;
                    const isRunning = executingCommand === cmd.action || running === cmd.action;
                    return (
                      <button
                        key={cmd.action}
                        onClick={() => handleCommand(cmd.action)}
                        disabled={!!executingCommand || !!running}
                        className="w-full flex items-center gap-3 p-2.5 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        ) : (
                          <Icon className="h-4 w-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground">{cmd.label}</p>
                          <p className="text-[10px] text-muted-foreground">{cmd.description}</p>
                        </div>
                        {!isRunning && (
                          <Play className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Activity log */}
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2">Recent Activity</p>
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
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
