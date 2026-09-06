import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { moduleLabel } from '@/lib/feedbackContext';
import { TypeBadge, StatusBadge, PriorityChip, SeverityDot } from './FeedbackBadges';
import type { FeedbackOverviewRow } from '@/hooks/useFeedbackQuery';
import type { FeedbackPriority, FeedbackSeverity, FeedbackStatus, FeedbackType } from '@/lib/feedbackConstants';

type SortKey = 'ref' | 'created_at' | 'votes' | 'priority' | 'status' | 'module';

interface Props {
  rows: FeedbackOverviewRow[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onOpen: (id: string) => void;
}

const FeedbackTable = ({ rows, selected, onSelectedChange, onOpen }: Props) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'created_at', dir: 'desc' });

  const sorted = [...rows].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const av = (a as any)[sort.key] ?? '';
    const bv = (b as any)[sort.key] ?? '';
    if (sort.key === 'votes') return (Number(av) - Number(bv)) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const allSelected = rows.length > 0 && selected.length === rows.length;

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-2 py-1.5 text-left font-medium">
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sort.key === k && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-1.5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={v => onSelectedChange(v ? rows.map(r => r.id!) : [])}
                aria-label="Selecionar todos"
              />
            </th>
            <Th k="ref">Ref</Th>
            <th className="px-2 py-1.5 text-left font-medium">Tipo</th>
            <th className="px-2 py-1.5 text-left font-medium">Título</th>
            <Th k="module">Módulo</Th>
            <Th k="status">Estado</Th>
            <Th k="priority">Prior.</Th>
            <th className="px-2 py-1.5 text-left font-medium">Reporter</th>
            <th className="px-2 py-1.5 text-left font-medium">Resp.</th>
            <Th k="votes">Votos</Th>
            <Th k="created_at">Criado</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map(r => (
            <tr
              key={r.id}
              className={cn('cursor-pointer hover:bg-muted/40', r.severity === 'blocker' && 'border-l-2 border-l-red-600')}
              onClick={() => onOpen(r.id!)}
            >
              <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={selected.includes(r.id!)}
                  onCheckedChange={v => onSelectedChange(v ? [...selected, r.id!] : selected.filter(x => x !== r.id))}
                  aria-label={`Selecionar ${r.ref}`}
                />
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{r.ref}</td>
              <td className="px-2 py-1.5"><TypeBadge type={r.type as FeedbackType} /></td>
              <td className="max-w-[280px] truncate px-2 py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <SeverityDot severity={r.severity as FeedbackSeverity | null} />
                  {r.title}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{moduleLabel(r.module!)}</td>
              <td className="px-2 py-1.5"><StatusBadge status={r.status as FeedbackStatus} /></td>
              <td className="px-2 py-1.5"><PriorityChip priority={r.priority as FeedbackPriority | null} /></td>
              <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{r.reporter_name ?? '—'}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{r.assignee_name ?? '—'}</td>
              <td className="px-2 py-1.5">{Number(r.votes ?? 0)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{format(new Date(r.created_at!), 'dd/MM/yyyy')}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">Sem reportes com estes filtros.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FeedbackTable;
