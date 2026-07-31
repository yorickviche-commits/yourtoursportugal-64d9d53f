import { useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search } from 'lucide-react';
import { useMagpieCatalog, useMagpieImport, type MagpieCatalogProduct } from '@/hooks/useMagpie';
import MagpieProductDialog from '@/components/catalog/MagpieProductDialog';
import { cn } from '@/lib/utils';

const durationText = (d: unknown) => {
  if (!d) return '—';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.join(' ');
  const o = d as { text?: string };
  return o.text ?? '—';
};

const thumb = (p: Record<string, unknown>): string | null => {
  const gallery = p.gallery as unknown;
  if (Array.isArray(gallery) && gallery.length) {
    const g = gallery[0];
    if (typeof g === 'string') return g;
    return (g as { url?: string })?.url ?? null;
  }
  return (p.image_url as string) ?? null;
};

const CatalogPage = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [location, setLocation] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<MagpieCatalogProduct | null>(null);

  const params = useMemo(
    () => ({
      page,
      limit,
      location: location === 'all' ? undefined : location,
      account_id: accountId === 'all' ? undefined : accountId,
      search: search.trim() || undefined,
    }),
    [page, limit, location, accountId, search],
  );

  const { data, isLoading, isFetching, error, refetch } = useMagpieCatalog(params);
  const importMutation = useMagpieImport();

  const products = data?.products ?? [];
  const pagination = data?.pagination;
  const locations = (data?.locations ?? []).filter(Boolean) as string[];
  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      const acc = p.account as { id?: string; name?: string } | null;
      if (acc?.id) map.set(acc.id, acc.name ?? acc.id);
    });
    return [...map.entries()];
  }, [products]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const importable = products.filter((p) => !p.already_imported).map((p) => p.magpie_id);
  const allSelected = importable.length > 0 && importable.every((id) => selected.has(id));

  const runImport = async (ids: string[]) => {
    if (!ids.length) return;
    const res = await importMutation.mutateAsync(ids);
    setSelected(new Set());
    return res;
  };

  const lastReport = importMutation.data;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Catálogo Magpie</h1>
            <p className="text-xs text-muted-foreground">
              Leitura apenas. Toda a criação e edição de produtos é feita em Magpie.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4 mr-1', isFetching && 'animate-spin')} /> Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Procurar nesta página..."
              className="pl-8 h-9"
            />
          </div>
          <Select value={location} onValueChange={(v) => { setLocation(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Localização" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as localizações</SelectItem>
              {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accountId} onValueChange={(v) => { setAccountId(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / pág.</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk bar */}
        <div className="flex items-center gap-3 flex-wrap bg-muted/50 rounded-lg px-3 py-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(c) =>
              setSelected(c ? new Set(importable) : new Set())
            }
            disabled={!importable.length}
          />
          <span className="text-xs text-muted-foreground">
            {selected.size} selecionado(s) · {importable.length} não importado(s) nesta página
          </span>
          <Button
            size="sm"
            className="ml-auto"
            disabled={!selected.size || importMutation.isPending}
            onClick={() => runImport([...selected])}
          >
            {importMutation.isPending
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Download className="h-4 w-4 mr-1" />}
            Importar selecionados
          </Button>
        </div>

        {lastReport && lastReport.failed > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
            <p className="font-semibold text-destructive">
              {lastReport.failed} produto(s) não importado(s)
            </p>
            {lastReport.results.filter((r) => !r.ok).slice(0, 8).map((r) => (
              <p key={r.magpie_id} className="text-muted-foreground font-mono">
                {r.magpie_id.slice(0, 8)} — {r.error}
              </p>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">A carregar catálogo...</div>
        ) : products.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum produto encontrado</div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const img = thumb(p as Record<string, unknown>);
              const checked = selected.has(p.magpie_id);
              return (
                <div
                  key={p.magpie_id}
                  className="bg-card rounded-xl border border-border p-3 flex items-start gap-3"
                >
                  <Checkbox
                    className="mt-1"
                    checked={checked}
                    disabled={p.already_imported}
                    onCheckedChange={() => toggle(p.magpie_id)}
                  />
                  {img ? (
                    <img src={img} alt={p.name ?? ''} loading="lazy"
                      className="h-14 w-20 object-cover rounded-md shrink-0 bg-muted" />
                  ) : (
                    <div className="h-14 w-20 rounded-md bg-muted shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setViewing(p)}
                      className="text-sm font-semibold truncate text-left hover:text-primary hover:underline w-full"
                      title="Ver detalhes (somente leitura)"
                    >
                      {p.name}
                    </button>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      {p.category && <span>{p.category}</span>}
                      {p.location && <span>• {p.location}</span>}
                      <span>• {durationText(p.duration)}</span>
                      {p.currency && <span>• {p.currency}</span>}
                      {typeof p.retail_rate_adult === 'number' && (
                        <span>• Adulto {p.retail_rate_adult}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {p.already_imported ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Importado</Badge>
                    ) : (
                      <Button size="sm" variant="outline"
                        disabled={importMutation.isPending}
                        onClick={() => runImport([p.magpie_id])}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Importar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="sm" variant="outline" disabled={!pagination.prev_page}
              onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {pagination.current_page} de {pagination.total_pages}
            </span>
            <Button size="sm" variant="outline" disabled={!pagination.next_page}
              onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <MagpieProductDialog
        product={viewing}
        open={!!viewing}
        onClose={() => setViewing(null)}
        importing={importMutation.isPending}
        onImport={(id) => runImport([id])}
      />
    </AppLayout>
  );
};

export default CatalogPage;
