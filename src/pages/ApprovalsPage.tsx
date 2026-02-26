import { useState } from 'react';
import { Check, X } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { mockApprovals } from '@/data/mockData';
import { approvalTypeConfig } from '@/lib/config';
import { ApprovalItem } from '@/types';

const ApprovalsPage = () => {
  const [approvals, setApprovals] = useState(mockApprovals);
  const [resolved, setResolved] = useState<Record<string, 'approved' | 'changes_requested'>>({});

  const handleApprove = (id: string) => {
    setResolved((prev) => ({ ...prev, [id]: 'approved' }));
  };

  const handleRequestChanges = (id: string) => {
    setResolved((prev) => ({ ...prev, [id]: 'changes_requested' }));
  };

  const pending = approvals.filter((a) => !resolved[a.id]);
  const done = approvals.filter((a) => resolved[a.id]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Approval Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending.length} items waiting for review
          </p>
        </div>

        {/* Pending */}
        <div className="space-y-3">
          {pending.map((item) => (
            <ApprovalCard
              key={item.id}
              item={item}
              onApprove={() => handleApprove(item.id)}
              onRequestChanges={() => handleRequestChanges(item.id)}
            />
          ))}
          {pending.length === 0 && (
            <div className="bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground text-sm">All caught up! No pending approvals.</p>
            </div>
          )}
        </div>

        {/* Resolved */}
        {done.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Resolved today</h2>
            <div className="space-y-2">
              {done.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-md border bg-muted/30 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge {...approvalTypeConfig[item.type]} />
                    <span className="text-sm">{item.title}</span>
                  </div>
                  <span className={`text-xs font-medium ${resolved[item.id] === 'approved' ? 'text-success' : 'text-urgent'}`}>
                    {resolved[item.id] === 'approved' ? '✓ Approved' : '↻ Changes requested'}
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

const ApprovalCard = ({
  item,
  onApprove,
  onRequestChanges,
}: {
  item: ApprovalItem;
  onApprove: () => void;
  onRequestChanges: () => void;
}) => {
  const priorityColors = {
    low: 'text-muted-foreground',
    medium: 'text-warning',
    high: 'text-urgent',
  };

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <StatusBadge {...approvalTypeConfig[item.type]} />
          <div>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.clientName} · by {item.submittedBy} · <span className={priorityColors[item.priority]}>{item.priority} priority</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">{item.summary}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
        <button
          onClick={onApprove}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-success text-success-foreground hover:bg-success/90 transition-colors"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          onClick={onRequestChanges}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Request Changes
        </button>
      </div>
    </div>
  );
};

export default ApprovalsPage;
