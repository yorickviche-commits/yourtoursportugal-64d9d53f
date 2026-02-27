import { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, Pencil, Save } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { mockApprovals } from '@/data/mockData';
import { approvalTypeConfig } from '@/lib/config';
import { ApprovalItem } from '@/types';
import { cn } from '@/lib/utils';

// Mock itinerary data for approvals
const mockItineraryContent: Record<string, { day: number; title: string; description: string }[]> = {
  'A-001': [
    { day: 1, title: 'Arrival in Porto', description: 'Airport pickup, check-in at hotel, evening food tour in Ribeira district with local guide.' },
    { day: 2, title: 'Porto City Deep Dive', description: 'Morning: Livraria Lello & Clérigos Tower. Lunch at Mercado do Bolhão. Afternoon: Port wine caves in Vila Nova de Gaia. Dinner at local tavern.' },
    { day: 3, title: 'Guimarães Day Trip', description: 'Full-day excursion to the birthplace of Portugal. Visit castle, historic center. Traditional lunch. Return via Braga for brief stop.' },
    { day: 4, title: 'Vinho Verde Trail', description: 'Private wine tour through Minho region. Visit 3 quintas, tastings, picnic lunch among vineyards.' },
    { day: 5, title: 'Braga & Bom Jesus', description: 'Cultural visit to Braga. Bom Jesus sanctuary, Cathedral visit. Gastronomy lunch. Afternoon free.' },
    { day: 6, title: 'Departure', description: 'Hotel checkout. Last-minute shopping. Airport transfer.' },
  ],
  'A-002': [
    { day: 1, title: 'Arrival São Miguel', description: 'Airport pickup, Ponta Delgada orientation walk, welcome dinner with Azorean cuisine.' },
    { day: 2, title: 'Sete Cidades', description: 'Full-day hike around Sete Cidades crater lakes. Picnic lunch with panoramic views.' },
    { day: 3, title: 'Whale Watching & Islet', description: 'Morning whale watching tour. Afternoon visit to Islet of Vila Franca do Campo.' },
    { day: 4, title: 'Furnas Valley', description: 'Thermal pools, Cozido das Furnas lunch cooked underground, Terra Nostra botanical garden.' },
    { day: 5, title: 'Tea Plantation & Coast', description: 'Visit Gorreana tea plantation, Nordeste coastal drive, waterfall hikes.' },
    { day: 6, title: 'Fogo Lake & Hot Springs', description: 'Hike to Lagoa do Fogo, afternoon at Caldeira Velha hot springs in forest.' },
    { day: 7, title: 'Departure', description: 'Final morning at leisure. Airport transfer.' },
  ],
};

const mockCostingContent: Record<string, { item: string; current: number; proposed: number; note: string }[]> = {
  'A-003': [
    { item: 'Wine Tour — Douro Valley Full Day', current: 380, proposed: 500, note: 'Vendor rate increase €120' },
    { item: 'Lunch at Quinta (included)', current: 0, proposed: 0, note: 'Included in tour' },
    { item: 'Trip Total', current: 12400, proposed: 12520, note: 'Net impact: +€120' },
  ],
};

const ApprovalsPage = () => {
  const [resolved, setResolved] = useState<Record<string, 'approved' | 'changes_requested'>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setResolved((prev) => ({ ...prev, [id]: 'approved' }));
    setExpandedId(null);
  };

  const handleRequestChanges = (id: string) => {
    setResolved((prev) => ({ ...prev, [id]: 'changes_requested' }));
    setExpandedId(null);
  };

  const pending = mockApprovals.filter((a) => !resolved[a.id]);
  const done = mockApprovals.filter((a) => resolved[a.id]);

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
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
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

/* ── Editable Itinerary Section ─────────────────────── */

const EditableItinerary = ({ approvalId }: { approvalId: string }) => {
  const original = mockItineraryContent[approvalId];
  const [days, setDays] = useState(original ? original.map(d => ({ ...d })) : []);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  if (!original) return null;

  const updateDay = (index: number, field: 'title' | 'description', value: string) => {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setEditingDay(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itinerary Preview</p>
        <button
          onClick={handleSave}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors",
            saved ? "bg-success/10 text-success" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <Save className="h-3 w-3" />
          {saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>
      {days.map((day, idx) => (
        <div
          key={day.day}
          className="flex gap-3 p-3 rounded-md border hover:bg-muted/30 transition-colors group"
        >
          <div className="h-7 w-7 rounded-full bg-info text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {day.day}
          </div>
          <div className="flex-1 min-w-0">
            {editingDay === idx ? (
              <div className="space-y-2">
                <input
                  className="w-full bg-background border rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                  value={day.title}
                  onChange={(e) => updateDay(idx, 'title', e.target.value)}
                />
                <textarea
                  className="w-full bg-background border rounded px-2 py-1 text-xs text-muted-foreground min-h-[60px] focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  value={day.description}
                  onChange={(e) => updateDay(idx, 'description', e.target.value)}
                />
                <button
                  onClick={() => setEditingDay(null)}
                  className="text-xs text-info hover:underline"
                >
                  Done editing
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{day.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{day.description}</p>
                </div>
                <button
                  onClick={() => setEditingDay(idx)}
                  className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Editable Costing Section ─────────────────────── */

const EditableCosting = ({ approvalId }: { approvalId: string }) => {
  const original = mockCostingContent[approvalId];
  const [rows, setRows] = useState(original ? original.map(r => ({ ...r })) : []);
  const [saved, setSaved] = useState(false);

  if (!original) return null;

  const updateRow = (index: number, field: 'proposed', value: number) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing Review</p>
        <button
          onClick={handleSave}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors",
            saved ? "bg-success/10 text-success" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <Save className="h-3 w-3" />
          {saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>
      <div className="border rounded-md overflow-hidden">
        <div className="grid grid-cols-12 gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/40">
          <div className="col-span-4">Item</div>
          <div className="col-span-2 text-right">Current €</div>
          <div className="col-span-2 text-right">Proposed €</div>
          <div className="col-span-2 text-right">Diff €</div>
          <div className="col-span-2">Note</div>
        </div>
        {rows.map((row, idx) => {
          const diff = row.proposed - row.current;
          return (
            <div key={idx} className="grid grid-cols-12 gap-1 px-3 py-2.5 text-xs items-center border-t hover:bg-muted/20 transition-colors">
              <div className="col-span-4 font-medium">{row.item}</div>
              <div className="col-span-2 text-right text-muted-foreground">€{row.current}</div>
              <div className="col-span-2 text-right">
                <input
                  type="number"
                  className="w-full bg-background border rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring"
                  value={row.proposed}
                  onChange={(e) => updateRow(idx, 'proposed', Number(e.target.value))}
                />
              </div>
              <div className={cn("col-span-2 text-right font-medium", diff > 0 ? "text-urgent" : diff < 0 ? "text-success" : "text-muted-foreground")}>
                {diff > 0 ? '+' : ''}{diff === 0 ? '—' : `€${diff}`}
              </div>
              <div className="col-span-2 text-muted-foreground truncate">{row.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Approval Card ──────────────────────────────────── */

const ApprovalCard = ({
  item,
  expanded,
  onToggle,
  onApprove,
  onRequestChanges,
}: {
  item: ApprovalItem;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
}) => {
  const priorityColors = {
    low: 'text-muted-foreground',
    medium: 'text-warning',
    high: 'text-urgent',
  };

  const hasItinerary = !!mockItineraryContent[item.id];
  const hasCosting = !!mockCostingContent[item.id];
  const hasContent = hasItinerary || hasCosting;

  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4">
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
          {hasContent && (
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-muted rounded transition-colors shrink-0"
              title={expanded ? 'Collapse' : 'Expand to review'}
            >
              {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable content */}
      {expanded && hasContent && (
        <div className="px-4 pb-4 border-t pt-4">
          {hasItinerary && <EditableItinerary approvalId={item.id} />}
          {hasCosting && <EditableCosting approvalId={item.id} />}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t mx-4">
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
        {hasContent && !expanded && (
          <button
            onClick={onToggle}
            className="ml-auto text-xs text-info hover:underline"
          >
            Review & Edit →
          </button>
        )}
      </div>
    </div>
  );
};

export default ApprovalsPage;
