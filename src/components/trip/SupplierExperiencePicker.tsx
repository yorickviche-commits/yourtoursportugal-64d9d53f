import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, ImageIcon, Users, Clock, Euro, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface PickedExperience {
  supplierName: string;
  name: string;
  description: string | null;
  price: number;
  priceChild: number;
  priceUnit: string;
  duration: string | null;
  imageUrl: string | null;
}

interface SupplierService {
  id: string;
  supplier_id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration: string | null;
  price: number | null;
  price_child: number | null;
  price_unit: string | null;
  currency: string | null;
  image_url: string | null;
  status: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this supplier name if it exists. */
  supplierName?: string;
  onPick: (exp: PickedExperience) => void;
}

const useSupplierCatalog = (enabled: boolean) =>
  useQuery({
    queryKey: ['supplier_experience_catalog'],
    enabled,
    queryFn: async () => {
      const [sRes, servRes] = await Promise.all([
        supabase.from('suppliers').select('id,name,category,status').order('name'),
        supabase.from('supplier_services').select('*').order('name') as any,
      ]);
      if (sRes.error) throw sRes.error;
      const suppliers = (sRes.data || []) as { id: string; name: string; category: string | null; status: string | null }[];
      const services = ((servRes.data as SupplierService[]) || []).filter(s => s.status !== 'inactive');
      return { suppliers, services };
    },
  });

export default function SupplierExperiencePicker({ open, onOpenChange, supplierName, onPick }: Props) {
  const { data, isLoading } = useSupplierCatalog(open);
  const [search, setSearch] = useState('');
  const [activeSupplier, setActiveSupplier] = useState<string | null>(null);
  const [preview, setPreview] = useState<SupplierService | null>(null);

  const suppliers = data?.suppliers || [];
  const services = data?.services || [];

  const supplierById = useMemo(() => {
    const m: Record<string, string> = {};
    suppliers.forEach(s => { m[s.id] = s.name; });
    return m;
  }, [suppliers]);

  const preselectedId = useMemo(() => {
    if (!supplierName) return null;
    const found = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
    return found?.id ?? null;
  }, [suppliers, supplierName]);

  const selectedSupplierId = activeSupplier ?? preselectedId;

  const visibleServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter(s => {
      if (selectedSupplierId && s.supplier_id !== selectedSupplierId) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (supplierById[s.supplier_id] || '').toLowerCase().includes(q)
      );
    });
  }, [services, selectedSupplierId, search, supplierById]);

  const suppliersWithServices = useMemo(() => {
    const counts: Record<string, number> = {};
    services.forEach(s => { counts[s.supplier_id] = (counts[s.supplier_id] || 0) + 1; });
    return suppliers
      .filter(s => counts[s.id])
      .map(s => ({ ...s, count: counts[s.id] }));
  }, [suppliers, services]);

  const pick = (s: SupplierService) => {
    onPick({
      supplierName: supplierById[s.supplier_id] || '',
      name: s.name,
      description: s.description,
      price: Number(s.price || 0),
      priceChild: Number(s.price_child || 0),
      priceUnit: s.price_unit || 'per_person',
      duration: s.duration,
      imageUrl: s.image_url,
    });
    onOpenChange(false);
    setPreview(null);
    setSearch('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[hsl(var(--info))]" />
              Experiências FSE
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 text-xs pl-7"
                placeholder="Pesquisar experiência ou fornecedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] max-h-[65vh]">
            {/* Suppliers */}
            <div className="border-r overflow-y-auto max-h-[65vh]">
              <button
                type="button"
                onClick={() => setActiveSupplier(null)}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors',
                  !selectedSupplierId && 'bg-muted font-semibold',
                )}
              >
                Todos os fornecedores
              </button>
              {suppliersWithServices.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSupplier(s.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between gap-1',
                    selectedSupplierId === s.id && 'bg-muted font-semibold',
                  )}
                >
                  <span className="truncate">{s.name}</span>
                  <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">{s.count}</Badge>
                </button>
              ))}
              {!isLoading && suppliersWithServices.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground italic">
                  Nenhum fornecedor com experiências registadas.
                </p>
              )}
            </div>

            {/* Services */}
            <div className="overflow-y-auto max-h-[65vh] p-2 space-y-1.5">
              {isLoading ? (
                <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar catálogo…
                </div>
              ) : visibleServices.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground italic">Sem experiências para este filtro.</p>
              ) : visibleServices.map(s => (
                <div key={s.id} className="rounded-lg border bg-card p-2 flex items-start gap-2">
                  <button
                    type="button"
                    className="h-14 w-20 rounded-md bg-muted shrink-0 overflow-hidden flex items-center justify-center"
                    onClick={() => setPreview(s)}
                    title="Ver imagem"
                  >
                    {s.image_url ? (
                      <img src={s.image_url} alt={s.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {supplierById[s.supplier_id]}{s.category ? ` · ${s.category}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Euro className="h-3 w-3" />{Number(s.price || 0).toFixed(2)}
                      </span>
                      {Number(s.price_child || 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />criança {Number(s.price_child).toFixed(2)}
                        </span>
                      )}
                      <span>{s.price_unit === 'per_person' ? 'por pessoa' : s.price_unit === 'per_night' ? 'por noite' : 'total'}</span>
                      {s.duration && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{s.duration}</span>}
                    </div>
                  </div>
                  <Button size="sm" className="text-[11px] h-7 shrink-0" onClick={() => pick(s)}>
                    Usar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview pop-up */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview?.image_url ? (
            <img src={preview.image_url} alt={preview.name} className="w-full rounded-lg object-cover max-h-[50vh]" />
          ) : (
            <div className="h-40 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
              Sem imagem associada a esta experiência.
            </div>
          )}
          {preview?.description && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{preview.description}</p>
          )}
          {preview && (
            <Button size="sm" className="text-xs" onClick={() => pick(preview)}>
              Usar no costing
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
