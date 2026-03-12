import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ApprovalItem } from '@/hooks/useAIOffice';

interface Props {
  open: boolean;
  onClose: () => void;
  approvals: ApprovalItem[];
  onDecide: (id: string, decision: 'approved' | 'rejected') => Promise<any>;
}

export default function CeoApprovalPanel({ open, onClose, approvals, onDecide }: Props) {
  const [processing, setProcessing] = useState<string | null>(null);

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setProcessing(id);
    try {
      // Call orchestrator which handles approval + continues pipeline
      const { data, error } = await supabase.functions.invoke('agent-orchestrator', {
        body: { action: 'approve_decision', approvalId: id, decision },
      });
      if (error) throw error;

      // Also update via the hook for optimistic UI
      await onDecide(id, decision);
      toast({ title: decision === 'approved' ? '✅ Aprovado — pipeline continuado' : '❌ Rejeitado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] max-w-full p-0">
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            👔 CEO Approval Queue
            {approvals.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{approvals.length}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-3">
            {approvals.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-3xl mb-3 block">✅</span>
                <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}>
                  All clear, CEO
                </p>
              </div>
            ) : (
              approvals.map(item => (
                <div key={item.id} className="border border-border rounded-lg p-3 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <Badge variant="outline" className="text-[9px] mt-1">{item.approval_type.replace(/_/g, ' ')}</Badge>
                    </div>
                    {item.amount_eur && (
                      <span className="text-sm font-bold text-foreground whitespace-nowrap">
                        € {item.amount_eur.toLocaleString('pt-PT')}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: pt })}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleDecision(item.id, 'approved')} disabled={processing === item.id}>
                      {processing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '✅ Approve'}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleDecision(item.id, 'rejected')} disabled={processing === item.id}>
                      ❌ Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
