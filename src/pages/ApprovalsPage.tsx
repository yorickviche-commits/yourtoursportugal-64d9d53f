import { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { approvalTypeConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useApprovalsQuery, useUpdateApproval } from '@/hooks/useApprovalsQuery';
import { logActivity } from '@/hooks/useActivityLog';
import { useToast } from '@/hooks/use-toast';

const ApprovalsPage = () => {
  const { data: approvals = [], isLoading } = useApprovalsQuery();
  const updateApproval = useUpdateApproval();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    await updateApproval.mutateAsync({ id, updates: { status: 'approved', resolved_by: 'current_user', resolved_at: new Date().toISOString() } });
    await logActivity('approval_approved', 'approval', id);
    toast({ title: 'Aprovado!' });
    setExpandedId(null);
  };

  const handleRequestChanges = async (id: string) => {
    await updateApproval.mutateAsync({ id, updates: { status: 'changes_requested', resolved_by: 'current_user', resolved_at: new Date().toISOString() } });
    await logActivity('approval_changes_requested', 'approval', id);
    toast({ title: 'Alterações solicitadas' });
    setExpandedId(null);
  };

  const pending = approvals.filter(a => a.status === 'pending');
  const done = approvals.filter(a => a.status !== 'pending');

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Approval Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pending.length} items waiting for review</p>
        </div>

        <div className="space-y-3">
          {pending.map(item => {
            const priorityColors: Record<string, string> = { low: 'text-muted-foreground', medium: 'text-warning', high: 'text-urgent' };
            return (
              <div key={item.id} className="bg-card rounded-lg border">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <StatusBadge {...(approvalTypeConfig[item.type as keyof typeof approvalTypeConfig] || approvalTypeConfig['itinerary'])} />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.client_name} · by {item.submitted_by} · <span className={priorityColors[item.priority] || ''}>{item.priority} priority</span></p>
                        <p className="text-sm text-muted-foreground mt-2">{item.summary}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t mx-4">
                  <button onClick={() => handleApprove(item.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-success text-success-foreground hover:bg-success/90 transition-colors">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button onClick={() => handleRequestChanges(item.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                    <X className="h-3.5 w-3.5" /> Request Changes
                  </button>
                </div>
              </div>
            );
          })}
          {pending.length === 0 && (
            <div className="bg-card rounded-lg border p-8 text-center"><p className="text-muted-foreground text-sm">All caught up! No pending approvals.</p></div>
          )}
        </div>

        {done.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Resolved</h2>
            <div className="space-y-2">
              {done.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 opacity-60">
                  <div className="flex items-center gap-3">
                    <StatusBadge {...(approvalTypeConfig[item.type as keyof typeof approvalTypeConfig] || approvalTypeConfig['itinerary'])} />
                    <span className="text-sm">{item.title}</span>
                  </div>
                  <span className={`text-xs font-medium ${item.status === 'approved' ? 'text-success' : 'text-urgent'}`}>
                    {item.status === 'approved' ? '✓ Approved' : '↻ Changes requested'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ApprovalsPage;
