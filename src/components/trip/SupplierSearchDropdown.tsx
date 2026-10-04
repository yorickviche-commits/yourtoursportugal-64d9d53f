import { useState, useRef } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createOrFindFSE } from '@/lib/createFSE';
import { FSE_CATEGORIES } from '@/data/fseDatabase';
import { useRegions, COUNTRY_LABELS } from '@/hooks/useRegions';

interface SupplierSearchDropdownProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const useSuppliersList = () => {
  return useQuery({
    queryKey: ['suppliers_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, category')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
};

export default function SupplierSearchDropdown({ value, onChange, className }: SupplierSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('anim');
  const [adding, setAdding] = useState(false);
  const [newRegion, setNewRegion] = useState('');
  const { data: regions = [] } = useRegions();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suppliers = [] } = useSuppliersList();

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch('');
  };

  const handleAddFSE = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const result = await createOrFindFSE({ supplier_name: newName, category: newCategory, destinations: newRegion ? [newRegion] : [] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['suppliers_list'] }),
        queryClient.invalidateQueries({ queryKey: ['supplier_experience_catalog'] }),
      ]);
      onChange(result.supplier.name);
      toast(result.existed
        ? { title: 'FSE já existente', description: `${result.supplier.name} foi selecionado.` }
        : { title: 'FSE criado', description: `${result.supplier.name} foi criado e selecionado.` });
      setNewName('');
      setNewCategory('anim');
      setAddOpen(false);
      setOpen(false);
    } catch (e: any) {
      console.error('Error adding supplier:', e);
      toast({ title: 'Erro ao criar FSE', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn("w-full flex items-start justify-between text-xs px-1 bg-transparent hover:bg-muted/30 rounded transition-colors text-left gap-1", className)}
          >
            <span className={cn("flex-1 leading-snug", value ? 'text-foreground' : 'text-muted-foreground')}>
              {value || 'Fornecedor...'}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[260px] p-0 z-[60]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => inputRef.current?.focus(), 30);
          }}
        >
          <div className="p-1.5 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                ref={inputRef}
                className="h-7 text-xs pl-7 pr-2"
                placeholder="Pesquisar FSE..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[240px] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">Sem resultados</p>
            )}
            {filtered.map(s => (
              <button
                key={s.id}
                type="button"
                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                onClick={() => handleSelect(s.name)}
              >
                <span className="truncate">{s.name}</span>
                <span className="text-[9px] text-muted-foreground shrink-0 ml-1">{s.category}</span>
              </button>
            ))}
          </div>

          <div className="border-t p-1">
            <button
              type="button"
              className="w-full text-left px-2.5 py-1.5 text-xs text-[hsl(var(--info))] hover:bg-muted/50 transition-colors flex items-center gap-1.5 font-medium rounded"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setTimeout(() => setAddOpen(true), 50);
              }}
            >
              <Plus className="h-3 w-3" /> Adicionar FSE
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Novo Fornecedor (FSE)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              className="h-8 text-xs"
              placeholder="Nome do fornecedor..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim() && !adding) handleAddFSE();
              }}
            />
            <select
              className="w-full h-8 text-xs border rounded-md px-2 bg-background"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
            >
              {FSE_CATEGORIES.map(category => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
            <select className="w-full h-8 text-xs border rounded-md px-2 bg-background" value={newRegion} onChange={e => setNewRegion(e.target.value)}>
              <option value="">Região de operação (opcional)</option>
              {(['PT', 'ES'] as const).map(c => (
                <optgroup key={c} label={COUNTRY_LABELS[c]}>
                  {regions.filter(r => r.country === c).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </optgroup>
              ))}
            </select>
            <Button size="sm" className="w-full text-xs" onClick={handleAddFSE} disabled={adding || !newName.trim()}>
              {adding ? 'A adicionar...' : 'Criar FSE'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
