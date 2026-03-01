import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Search, Pencil } from 'lucide-react';

const CATEGORIES = ['hotel', 'guide', 'transport', 'winery', 'activity', 'restaurant', 'other'];

interface Supplier {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contract_type: string | null;
  currency: string;
  cancellation_policy: string | null;
  notes: string | null;
  status: string;
}

const emptySupplier = {
  name: '', category: 'other', contact_name: '', contact_email: '', contact_phone: '',
  contract_type: '', currency: 'EUR', cancellation_policy: '', notes: '', status: 'active',
};

const AdminSuppliersPage = () => {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...emptySupplier });
  const { toast } = useToast();

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openCreate = () => { setEditingSupplier(null); setForm({ ...emptySupplier }); setDialogOpen(true); };
  const openEdit = (s: Supplier) => { setEditingSupplier(s); setForm({ ...s }); setDialogOpen(true); };

  const handleSave = async () => {
    const { id, ...payload } = form;
    if (editingSupplier) {
      await supabase.from('suppliers').update(payload as any).eq('id', editingSupplier.id);
      toast({ title: 'Fornecedor atualizado' });
    } else {
      await supabase.from('suppliers').insert(payload as any);
      toast({ title: 'Fornecedor criado' });
    }
    setDialogOpen(false);
    fetchSuppliers();
  };

  const filtered = suppliers.filter(s => {
    if (filterCat !== 'all' && s.category !== filterCat) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const CAT_COLORS: Record<string, string> = {
    hotel: 'bg-info/20 text-info', guide: 'bg-success/20 text-success',
    transport: 'bg-warning/20 text-warning', winery: 'bg-primary/20 text-primary',
    activity: 'bg-chart-1/20 text-foreground', restaurant: 'bg-urgent/20 text-urgent',
    other: 'bg-muted text-muted-foreground',
  };

  if (!isAdmin) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Base de Fornecedores</h1>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Fornecedor</Button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? <p className="text-muted-foreground">A carregar...</p> : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum fornecedor encontrado.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(s => (
              <Card key={s.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => openEdit(s)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{s.name}</p>
                      <Badge className={`mt-1 text-[10px] ${CAT_COLORS[s.category] || ''}`}>{s.category}</Badge>
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {s.contact_email && <p className="text-xs text-muted-foreground mt-2">{s.contact_email}</p>}
                  {s.contact_phone && <p className="text-xs text-muted-foreground">{s.contact_phone}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Moeda</Label>
                  <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Contacto</Label>
                  <Input value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Política de Cancelamento</Label>
                <Textarea value={form.cancellation_policy || ''} onChange={e => setForm({ ...form, cancellation_policy: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notas</Label>
                <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleSave} disabled={!form.name}>{editingSupplier ? 'Atualizar' : 'Criar'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminSuppliersPage;
