import { useState, useRef, useEffect } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface SupplierSearchDropdownProps {
  value: string;
  onChange: (value: string) => void;
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

export default function SupplierSearchDropdown({ value, onChange }: SupplierSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useSuppliersList();

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch('');
  };

  const handleAddFSE = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from('suppliers')
        .insert({ name: newName.trim(), category: newCategory });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['suppliers_list'] });
      onChange(newName.trim());
      setNewName('');
      setNewCategory('other');
      setAddOpen(false);
      setOpen(false);
    } catch (e) {
      console.error('Error adding supplier:', e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="h-7 w-full flex items-center justify-between text-xs px-1 bg-transparent hover:bg-muted/30 rounded transition-colors truncate text-left"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'Fornecedor...'}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 w-[220px] bg-popover border rounded-md shadow-lg">
          <div className="p-1.5 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                ref={inputRef}
                className="h-7 text-xs pl-7 pr-2"
                placeholder="Pesquisar FSE..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto py-1">
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
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="w-full text-left px-2.5 py-1.5 text-xs text-[hsl(var(--info))] hover:bg-muted/50 transition-colors flex items-center gap-1.5 font-medium"
                >
                  <Plus className="h-3 w-3" /> Adicionar FSE
                </button>
              </DialogTrigger>
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
                  />
                  <select
                    className="w-full h-8 text-xs border rounded-md px-2 bg-background"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                  >
                    <option value="hotel">Hotel</option>
                    <option value="restaurant">Restaurante</option>
                    <option value="guide">Guia</option>
                    <option value="transport">Transporte</option>
                    <option value="activity">Atividade</option>
                    <option value="other">Outro</option>
                  </select>
                  <Button size="sm" className="w-full text-xs" onClick={handleAddFSE} disabled={adding || !newName.trim()}>
                    {adding ? 'A adicionar...' : 'Criar FSE'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  );
}
