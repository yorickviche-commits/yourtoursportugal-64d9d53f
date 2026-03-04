import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { approvalTypeConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useApprovalsQuery, useUpdateApproval } from '@/hooks/useApprovalsQuery';
import { logActivity } from '@/hooks/useActivityLog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const ApprovalsPage = () => {
  const { data: approvals = [], isLoading } = useApprovalsQuery();
  const updateApproval = useUpdateApproval();
  const { toast } = useToast();

  const handleApprove = async (id: string) => {
    await updateApproval.mutateAsync({ id, updates: { status: 'approved', resolved_by: 'current_user', resolved_at: new Date().toISOString() } });
    await logActivity('approval_approved', 'approval', id);
    toast({ title: '✅ Aprovado!' });
  };

  const handleRequestChanges = async (id: string) => {
    await updateApproval.mutateAsync({ id, updates: { status: 'changes_requested', resolved_by: 'current_user', resolved_at: new Date().toISOString() } });
    await logActivity('approval_changes_requested', 'approval', id);
    toast({ title: '↻ Alterações solicitadas' });
  };

  const pending = approvals.filter(a => a.status === 'pending');
  const done = approvals.filter(a => a.status !== 'pending');

  if (isLoading) {
    return <AppLayout><div className="space-y-4 p-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">Centro de Aprovações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pending.length} items a aguardar revisão</p>
        </div>

        <div className="space-y-3">
          {pending.map(item => {
            const priorityColors: Record<string, string> = { low: 'text-muted-foreground', medium: 'text-[hsl(var(--warning))]', high: 'text-[hsl(var(--urgent))]' };
            return (
              <div key={item.id} className="bg-card rounded-lg border">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <StatusBadge {...(approvalTypeConfig[item.type as keyof typeof approvalTypeConfig] || approvalTypeConfig['itinerary'])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.client_name} · por {item.submitted_by} · <span className={priorityColors[item.priority || 'medium'] || ''}>prioridade {item.priority}</span>
                      </p>
                      {item.trip_id && (
                        <Link to={`/trips/${item.trip_id}`} className="text-[10px] text-[hsl(var(--info))] hover:underline mt-1 inline-block">Ver viagem →</Link>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">{item.summary}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t mx-4">
                  <button onClick={() => handleApprove(item.id)} className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium bg-[hsl(var(--success))] text-white hover:opacity-90 transition-colors min-h-[44px] sm:min-h-0">
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </button>
                  <button onClick={() => handleRequestChanges(item.id)} className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors min-h-[44px] sm:min-h-0">
                    <X className="h-3.5 w-3.5" /> Pedir Alterações
                  </button>
                </div>
              </div>
            );
          })}
          {pending.length === 0 && (
            <div className="bg-card rounded-lg border p-8 text-center"><p className="text-muted-foreground text-sm">Tudo em dia! Sem aprovações pendentes. ✓</p></div>
          )}
        </div>

        {done.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Resolvidas</h2>
            <div className="space-y-2">
              {done.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 opacity-60">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge {...(approvalTypeConfig[item.type as keyof typeof approvalTypeConfig] || approvalTypeConfig['itinerary'])} />
                    <span className="text-sm truncate">{item.title}</span>
                  </div>
                  <span className={cn("text-xs font-medium shrink-0 ml-2", item.status === 'approved' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--urgent))]')}>
                    {item.status === 'approved' ? '✓ Aprovado' : '↻ Alterações pedidas'}
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
