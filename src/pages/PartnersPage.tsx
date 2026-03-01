import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import SmartImportDialog from '@/components/commercial/SmartImportDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Handshake, Plus, Search, Pencil, Sparkles } from 'lucide-react';

const CATEGORIES = ['travel_agency', 'tour_operator', 'hotel_concierge', 'online_platform', 'dmc', 'other'];

const CAT_LABELS: Record<string, string> = {
  travel_agency: 'Agência', tour_operator: 'Operador', hotel_concierge: 'Concierge',
  online_platform: 'Plataforma', dmc: 'DMC', other: 'Outro',
};

interface Partner {
  id: string; name: string; category: string; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null;
  commission_percent: number | null; status: string;
}

const emptyPartner = {
  name: '', category: 'other', contact_name: '', contact_email: '', contact_phone: '',
  commission_percent: 0, contract_type: '', currency: 'EUR', payment_terms: '',
  territory: '', cancellation_policy: '', notes: '', status: 'active',
};

const PartnersPage = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...emptyPartner });
  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const { toast } = useToast();

  const fetchPartners = async () => {
    setLoading(true);
    const { data } = await (supabase.from('partners') as any).select('*').order('name');
    setPartners((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  const openCreate = () => { setForm({ ...emptyPartner }); setDialogOpen(true); };

  const handleSave = async () => {
    const { id, created_at, updated_at, created_by, ...payload } = form;
    await (supabase.from('partners') as any).insert(payload);
    toast({ title: 'Parceiro criado' });
    setDialogOpen(false);
    fetchPartners();
  };

  const handleSmartImport = async (data: any) => {
    if (data.entity) {
      const e = data.entity;
      const payload = {
        name: e.name || 'Parceiro importado',
        category: CATEGORIES.includes(e.category) ? e.category : 'other',
        contact_name: e.contact_name || null,
        contact_email: e.contact_email || null,
        contact_phone: e.contact_phone || null,
        commission_percent: e.commission_percent || 0,
        contract_type: e.contract_type || null,
        currency: e.currency || 'EUR',
        payment_terms: e.payment_terms || null,
        territory: e.territory || null,
        notes: e.notes || null,
      };
      const { data: inserted } = await (supabase.from('partners') as any).insert(payload).select().single();
      if (inserted && data.services?.length > 0) {
        const servicesPayload = data.services.map((s: any) => ({
          partner_id: inserted.id,
          name: s.name || 'Serviço',
          description: s.description || null,
          category: s.category || 'private_tour',
          duration: s.duration || null,
          price: s.price || 0,
          price_unit: s.price_unit || 'per_person',
          currency: s.currency || 'EUR',
          commission_percent: s.commission_percent || 0,
          payment_conditions: s.payment_conditions || null,
          cancellation_policy: s.cancellation_policy || null,
          refund_policy: s.refund_policy || null,
          validity_start: s.validity_start || null,
          validity_end: s.validity_end || null,
          notes: s.notes || null,
        }));
        await (supabase.from('partner_services') as any).insert(servicesPayload);
      }
      toast({ title: 'Parceiro importado', description: `${data.services?.length || 0} serviço(s)` });
      fetchPartners();
    }
  };

  const filtered = partners.filter(p => {
    if (filterCat !== 'all' && p.category !== filterCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const CAT_COLORS: Record<string, string> = {
    travel_agency: 'bg-info/20 text-info', tour_operator: 'bg-success/20 text-success',
    hotel_concierge: 'bg-warning/20 text-warning', online_platform: 'bg-primary/20 text-primary',
    dmc: 'bg-chart-1/20 text-foreground', other: 'bg-muted/20 text-muted-foreground',
  };

  if (!isAdmin) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Handshake className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Partners & Revendedores</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSmartImportOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />Smart Import
            </Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Partner</Button>
          </div>
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
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? <p className="text-muted-foreground">A carregar...</p> : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum parceiro encontrado.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => (
              <Card key={p.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/admin/partners/${p.id}`)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <Badge className={`mt-1 text-[10px] ${CAT_COLORS[p.category] || ''}`}>{CAT_LABELS[p.category] || p.category}</Badge>
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {p.contact_email && <p className="text-xs text-muted-foreground mt-2">{p.contact_email}</p>}
                  {p.commission_percent && p.commission_percent > 0 && (
                    <p className="text-xs font-medium text-success mt-1">{p.commission_percent}% comissão</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Manual create dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Parceiro</DialogTitle></DialogHeader>
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
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Comissão %</Label>
                  <Input type="number" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: parseFloat(e.target.value) || 0 })} />
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
                <Label className="text-xs">Território</Label>
                <Input value={form.territory || ''} onChange={e => setForm({ ...form, territory: e.target.value })} placeholder="ex: Europa, UK, Worldwide" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notas</Label>
                <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleSave} disabled={!form.name}>Criar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <SmartImportDialog
          open={smartImportOpen}
          onOpenChange={setSmartImportOpen}
          entityType="partner"
          onImportComplete={handleSmartImport}
        />
      </div>
    </AppLayout>
  );
};

export default PartnersPage;
