import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart3, Loader2, Lock, Play, Plus, Search, X } from 'lucide-react';
import { useSavedReports } from '@/hooks/useSavedReports';
import { useFinancialAccess, useReportFields } from '@/hooks/useReportFields';
import { runReport, decodeDefinition } from '@/lib/reports/runReport';
import { emptyDefinition, type ReportDefinition, type RunReportResult, type SavedReport } from '@/types/reports';
import ReportBuilder from '@/components/reports/ReportBuilder';
import ReportHeader from '@/components/reports/ReportHeader';
import ReportResults from '@/components/reports/ReportResults';

export default function ReportsPage() {
  const { data: saved, isLoading: savedLoading } = useSavedReports('files');
  const { data: fields } = useReportFields('files');
  const { canSeeFinancial } = useFinancialAccess();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SavedReport | null>(null);
  const [definition, setDefinition] = useState<ReportDefinition>(emptyDefinition());
  const [result, setResult] = useState<RunReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [builderOpen, setBuilderOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const restoredRef = useRef(false);

  // Restaurar definição a partir do link (#d=...)
  useEffect(() => {
    if (restoredRef.current) return;
    const hash = window.location.hash;
    const m = hash.match(/[#&]d=([^&]+)/);
    if (m) {
      const def = decodeDefinition(m[1]);
      if (def) {
        setDefinition(def);
        setSelected(null);
      }
    }
    restoredRef.current = true;
  }, []);

  // Selecionar o primeiro relatório de fábrica quando nada está escolhido
  useEffect(() => {
    if (selected || !saved?.length || !restoredRef.current) return;
    if (window.location.hash.includes('d=')) return;
    const first = saved.find(r => r.is_suggested) || saved[0];
    if (first) load(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const load = (r: SavedReport) => {
    setSelected(r);
    setDefinition({ ...emptyDefinition(), ...r.definition });
    setResult(null);
    setError(null);
    setRanAt(null);
  };

  const newReport = () => {
    setSelected(null);
    setDefinition(emptyDefinition());
    setResult(null);
    setError(null);
    setRanAt(null);
  };

  const generate = async (defOverride?: ReportDefinition) => {
    const def = defOverride || definition;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    try {
      const data = await runReport(def);
      if (controller.signal.aborted) return;
      setResult(data);
      setRanAt(new Date());
    } catch (e: any) {
      if (controller.signal.aborted) return;
      setError(e?.message || 'Erro ao gerar o relatório');
      setResult(null);
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const grouped = useMemo(() => {
    const list = (saved || []).filter(r =>
      !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())
    );
    const bucket = (r: SavedReport) => (r.is_suggested ? 0 : r.visibility === 'team' ? 1 : 2);
    const byCategory = new Map<string, SavedReport[]>();
    list
      .slice()
      .sort((a, b) => bucket(a) - bucket(b) || (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name, 'pt'))
      .forEach(r => {
        const arr = byCategory.get(r.category) || [];
        arr.push(r);
        byCategory.set(r.category, arr);
      });
    return Array.from(byCategory.entries());
  }, [saved, search]);

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Lista de relatórios guardados */}
        <aside className="lg:w-64 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">Relatórios</h1>
          </div>
          <Button size="sm" className="h-7 w-full text-xs mb-2" onClick={newReport}>
            <Plus className="h-3 w-3 mr-1" /> Novo relatório
          </Button>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder="Pesquisar"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {savedLoading && <div className="text-[11px] text-muted-foreground">A carregar…</div>}
          <div className="space-y-3">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">{category}</div>
                <div className="space-y-0.5">
                  {items.map(r => (
                    <button
                      key={r.id}
                      onClick={() => load(r)}
                      className={cn(
                        'w-full flex items-center gap-1 text-left px-2 py-1.5 rounded text-xs transition-colors',
                        selected?.id === r.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
                      )}
                    >
                      {r.is_suggested && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{r.name}</span>
                      {!r.is_suggested && r.visibility === 'private' && (
                        <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0">meu</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Conteúdo */}
        <section className="flex-1 min-w-0 space-y-3">
          <ReportHeader
            selected={selected}
            definition={definition}
            ranAt={ranAt}
            running={running}
            builderOpen={builderOpen}
            onToggleBuilder={() => setBuilderOpen(o => !o)}
            onGenerate={() => generate()}
            onCancel={cancel}
            onSelect={load}
            onNew={newReport}
          />

          {builderOpen && fields && (
            <ReportBuilder
              fields={fields}
              definition={definition}
              onChange={setDefinition}
              canSeeFinancial={canSeeFinancial}
            />
          )}

          <ReportResults
            result={result}
            error={error}
            running={running}
            definition={definition}
            reportName={selected?.name || 'relatorio'}
            onDrillDown={def => generate(def)}
          />
        </section>
      </div>
    </AppLayout>
  );
}
