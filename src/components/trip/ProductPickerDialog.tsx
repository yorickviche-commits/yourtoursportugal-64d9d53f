import { useMemo, useState } from 'react';
import { Loader2, Search, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useImportedProducts, firstImage, local, type ImportedProduct } from '@/hooks/useMagpie';
import { productTitle, productSummary } from '@/lib/productToDay';

interface ProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: ImportedProduct) => void;
  title?: string;
}

/** Only commercially-ready products (visible + approved) can enter a proposal. */
const READY_STATUSES = new Set(['approved', 'ready', 'published', 'validated', 'aprovado']);

const ProductPickerDialog = ({ open, onOpenChange, onSelect, title = 'Importar produto do catálogo' }: ProductPickerDialogProps) => {
  const { data: products, isLoading } = useImportedProducts();
  const [search, setSearch] = useState('');

  const ready = useMemo(() => {
    const rows = products ?? [];
    return rows.filter(p => {
      const l = local(p);
      if (!l?.is_visible) return false;
      return READY_STATUSES.has(String(l.workflow_status || '').toLowerCase());
    });
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ready;
    return ready.filter(p =>
      [productTitle(p), p.name, p.location, p.category, p.account_name]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)),
    );
  }, [ready, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            className="h-9 pl-8 text-xs"
            placeholder="Pesquisar por nome, localização ou categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto divide-y rounded-md border">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar catálogo...
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground space-y-1">
              <Package className="h-5 w-5 mx-auto opacity-50" />
              <p>Sem produtos prontos para uso comercial.</p>
              <p>Marca os produtos como visíveis e aprovados em Comercial → Catálogo de Produtos.</p>
            </div>
          )}

          {!isLoading && filtered.map(p => {
            const img = firstImage(p.images);
            return (
              <button
                key={p.magpie_id}
                onClick={() => { onSelect(p); onOpenChange(false); }}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="w-16 h-12 rounded bg-muted overflow-hidden shrink-0">
                  {img
                    ? <img src={img} alt={productTitle(p)} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{productTitle(p)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{productSummary(p) || '—'}</p>
                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    {p.location && <span>{p.location}</span>}
                    {p.duration_text && <span>· {p.duration_text}</span>}
                    {p.category && <span>· {p.category}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductPickerDialog;
