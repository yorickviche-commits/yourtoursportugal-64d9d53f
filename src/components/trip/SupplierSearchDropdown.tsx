import { useState, useRef } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
  const [newCategory, setNewCategory] = useState('other');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
      const { error } = await supabase
        .from('suppliers')
        .insert({ name: newName.trim(), category: newCategory });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['suppliers_list'] });
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
    </>
  );
}
