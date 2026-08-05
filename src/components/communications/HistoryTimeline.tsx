/**
 * Timeline of client communications for a lead / trip.
 */
import { useMemo, useState } from 'react';
import { Loader2, Mail, Search, Sparkles, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface EmailLogRow {
  id: string;
  subject: string;
  body: string;
  supplier_email: string | null;
  sent_at: string;
  email_category: string | null;
}

const PURPOSE_LABEL: Record<string, string> = {
  proposal: 'Proposta',
  proposal_update: 'Proposta atualizada',
  welcome: 'Boas-vindas',
  qualification: 'Qualificação',
  followup: 'Follow-up',
  booking: 'Booking / Operações',
  custom: 'Custom',
};

export function HistoryTimeline({ rows, isLoading }: { rows: EmailLogRow[]; isLoading: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r =>
      `${r.subject} ${r.body} ${r.supplier_email || ''}`.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <div className="bg-card rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-3.5 w-3.5" /> Histórico ({rows.length})
        </h2>
        <div className="relative ml-auto w-40 md:w-56">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar…" className="h-7 pl-7 text-xs" />
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Sem comunicações registadas.</p>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map(h => {
            const isOpen = open === h.id;
            return (
              <div key={h.id} className="px-3 py-2">
                <button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(isOpen ? null : h.id)}>
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--info))]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold">{h.subject}</span>
                      {h.email_category && (
                        <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px]">
                          {PURPOSE_LABEL[h.email_category] || h.email_category}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {h.supplier_email || '—'} · {new Date(h.sent_at).toLocaleString('pt-PT')}
                    </div>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div
                    className="mt-2 max-h-80 overflow-auto rounded border bg-muted/30 p-3 text-xs"
                    dangerouslySetInnerHTML={{ __html: /<[a-z][\s\S]*>/i.test(h.body) ? h.body : h.body.replace(/\n/g, '<br>') }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {rows.length > 0 && (
        <div className="border-t px-3 py-1.5 text-right">
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setQ('')}>Limpar filtro</Button>
        </div>
      )}
    </div>
  );
}

export default HistoryTimeline;
