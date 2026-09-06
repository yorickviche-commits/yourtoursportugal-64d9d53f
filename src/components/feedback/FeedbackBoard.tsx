import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { MessageSquare, Paperclip, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { moduleLabel } from '@/lib/feedbackContext';
import { BOARD_COLUMNS, STATUS_LABELS, type FeedbackStatus, type FeedbackType, type FeedbackPriority } from '@/lib/feedbackConstants';
import { TypeBadge, PriorityChip } from './FeedbackBadges';
import type { FeedbackOverviewRow } from '@/hooks/useFeedbackQuery';

interface Props {
  rows: FeedbackOverviewRow[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
}

const FeedbackBoard = ({ rows, onOpen, onStatusChange }: Props) => {
  const onDragEnd = (res: DropResult) => {
    if (!res.destination) return;
    const status = res.destination.droppableId as FeedbackStatus;
    const row = rows.find(r => r.id === res.draggableId);
    if (!row || row.status === status) return;
    onStatusChange(res.draggableId, status);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map(col => {
          const items = rows.filter(r => r.status === col);
          return (
            <Droppable droppableId={col} key={col}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'w-[260px] shrink-0 rounded-lg border border-border bg-muted/40 p-2',
                    snapshot.isDraggingOver && 'border-[#0a2540] bg-muted',
                  )}
                >
                  <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {STATUS_LABELS[col]}
                    <span className="rounded bg-background px-1.5">{items.length}</span>
                  </p>
                  <div className="space-y-2">
                    {items.map((r, i) => (
                      <Draggable draggableId={r.id!} index={i} key={r.id}>
                        {(dp, ds) => (
                          <div
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            onClick={() => onOpen(r.id!)}
                            className={cn(
                              'cursor-pointer rounded-md border border-border bg-card p-2 text-left shadow-sm',
                              ds.isDragging && 'shadow-lg',
                              r.severity === 'blocker' && 'border-l-4 border-l-red-600',
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="font-mono text-[10px] text-muted-foreground">{r.ref}</span>
                              <TypeBadge type={r.type as FeedbackType} />
                              <PriorityChip priority={r.priority as FeedbackPriority | null} />
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs font-medium">{r.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="truncate">{moduleLabel(r.module!)}</span>
                              <span>{format(new Date(r.created_at!), 'dd/MM')}</span>
                              <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" />{Number(r.votes ?? 0)}</span>
                              <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{Number(r.comments_count ?? 0)}</span>
                              <span className="flex items-center gap-0.5"><Paperclip className="h-2.5 w-2.5" />{Number(r.attachments_count ?? 0)}</span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default FeedbackBoard;
