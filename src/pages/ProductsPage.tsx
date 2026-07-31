import { useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2, RefreshCw, Search } from 'lucide-react';
import { useImportedProducts, useMagpieRefresh, firstImage, local } from '@/hooks/useMagpie';
import { cn } from '@/lib/utils';

const workflowLabels: Record<string, string> = {
  draft: 'Rascunho',
  review: 'Revisão',
  published: 'Publicado',
  archived: 'Arquivado',
};

const isStale = (iso: string | null) => {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000;
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useImportedProducts();
  const refresh = useMagpieRefresh();

  const [search, setSearch] = useState('');
  const [workflow, setWorkflow] = useState('all');
  const [visible, setVisible] = useState('all');
  const [category, setCategory] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].sort(),
    [products],
  );

  const filtered = products.filter((p) => {
    const l = local(p);
    if (workflow !== 'all' && (l?.workflow_status ?? 'draft') !== workflow) return false;
    if (visible !== 'all' && String(l?.is_visible ?? false) !== visible) return false;
    if (category !== 'all' && p.category !== category) return false;
    if (availability !== 'all' && p.availability_status !== availability) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (![p.name, p.category, p.location, l?.custom_title].some((v) => v?.toLowerCase().includes(q)))
        return false;
    }
    return true;
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Biblioteca de Produtos</h1>
            <p className="text-xs text-muted-foreground">{products.length} produtos importados de Magpie</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={refresh.isPending}
              onClick={() => refresh.mutate([...selected])}>
              {refresh.isPending
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-1" />}
              {selected.size ? `Refresh (${selected.size})` : 'Refresh todos'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar..." className="pl-8 h-9" />
          </div>
          <Select value={workflow} onValueChange={setWorkflow}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {Object.entries(workflowLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={visible} onValueChange={setVisible}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Visibilidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Visível: todos</SelectItem>
              <SelectItem value="true">Visível</SelectItem>
              <SelectItem value="false">Oculto</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={availability} onValueChange={setAvailability}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Disponibilidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Disponibilidade: todos</SelectItem>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="unavailable">Indisponível</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum produto. Importa a partir do catálogo Magpie.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const l = local(p);
              const img = firstImage(p.images);
              const stale = isStale(p.last_synced_at);
              return (
                <div key={p.magpie_id}
                  className="bg-card rounded-xl border border-border p-3 flex items-start gap-3">
                  <Checkbox className="mt-1" checked={selected.has(p.magpie_id)}
                    onCheckedChange={() => toggle(p.magpie_id)} />
                  <div onClick={() => navigate(`/products/${p.magpie_id}`)}
                    className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                    {img ? (
                      <img src={img} alt={p.name} loading="lazy"
                        className="h-14 w-20 object-cover rounded-md shrink-0 bg-muted" />
                    ) : <div className="h-14 w-20 rounded-md bg-muted shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {workflowLabels[l?.workflow_status ?? 'draft']}
                        </Badge>
                        {l?.is_visible && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Visível</Badge>
                        )}
                        {p.availability_status === 'unavailable' && (
                          <Badge variant="destructive" className="text-[10px]">Indisponível</Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold truncate mt-1">{l?.custom_title || p.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground mt-0.5">
                        {p.category && <span>{p.category}</span>}
                        {p.location && <span>• {p.location}</span>}
                        {p.duration_text && <span>• {p.duration_text}</span>}
                        <span className={cn('flex items-center gap-1', stale && 'text-amber-600 font-medium')}>
                          {stale && <AlertTriangle className="h-3 w-3" />}
                          {p.last_synced_at
                            ? `Sync ${new Date(p.last_synced_at).toLocaleDateString('pt-PT')}`
                            : 'Nunca sincronizado'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0"
                    disabled={refresh.isPending}
                    onClick={() => refresh.mutate([p.magpie_id])}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProductsPage;
