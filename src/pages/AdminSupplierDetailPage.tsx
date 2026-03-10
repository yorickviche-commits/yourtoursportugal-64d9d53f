import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import SmartImportDialog from '@/components/commercial/SmartImportDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Save, Plus, Pencil, Trash2, Upload, FileText,
  Link as LinkIcon, Sparkles, Loader2, ExternalLink, Package
} from 'lucide-react';
import SupplierScoring from '@/components/commercial/SupplierScoring';

const CATEGORIES = ['hotel', 'guide', 'transport', 'winery', 'activity', 'restaurant', 'other'];
const PRICE_UNITS = ['per_person', 'per_group', 'per_night', 'per_day', 'flat_rate'];

interface Supplier {
  id: string; name: string; category: string; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; contract_type: string | null;
  currency: string | null; cancellation_policy: string | null; notes: string | null;
  status: string; validity_start: string | null; validity_end: string | null;
  commission_structure: any; net_rates: any; market_pricing: any;
}

interface SupplierService {
  id: string; supplier_id: string; name: string; description: string | null;
  category: string; duration: string | null; price: number; price_child: number;
  price_unit: string; currency: string; payment_conditions: string | null;
  cancellation_policy: string | null; refund_policy: string | null;
  booking_conditions: string | null; notes: string | null; status: string;
  validity_start: string | null; validity_end: string | null;
}

interface SupplierFile {
  id: string; supplier_id: string; file_name: string; file_url: string | null;
  file_type: string; storage_path: string | null; size_bytes: number | null;
  created_at: string;
}

interface SupplierLink {
  id: string; supplier_id: string; name: string; url: string;
  description: string | null; created_at: string;
}

const emptyService = {
  name: '', description: '', category: 'activity', duration: '', price: 0,
  price_child: 0, price_unit: 'per_person', currency: 'EUR', payment_conditions: '',
  cancellation_policy: '', refund_policy: '', booking_conditions: '', notes: '',
  status: 'active', validity_start: '', validity_end: '',
};

const AdminSupplierDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<any>({});
  const [services, setServices] = useState<SupplierService[]>([]);
  const [files, setFiles] = useState<SupplierFile[]>([]);
  const [links, setLinks] = useState<SupplierLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Service dialog
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<SupplierService | null>(null);
  const [serviceForm, setServiceForm] = useState<any>({ ...emptyService });

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: '', url: '', description: '' });

  // Smart import
  const [smartImportOpen, setSmartImportOpen] = useState(false);

  // File upload
  const [uploading, setUploading] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    const [sRes, servRes, fRes, lRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', id).single(),
      supabase.from('supplier_services').select('*').eq('supplier_id', id).order('name') as any,
      supabase.from('supplier_files').select('*').eq('supplier_id', id).order('created_at', { ascending: false }) as any,
      supabase.from('supplier_links').select('*').eq('supplier_id', id).order('created_at', { ascending: false }) as any,
    ]);
    if (sRes.data) { setSupplier(sRes.data as any); setForm(sRes.data); }
    setServices((servRes.data as any[]) || []);
    setFiles((fRes.data as any[]) || []);
    setLinks((lRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  // Save supplier profile
  const handleSaveSupplier = async () => {
    setSaving(true);
    const { id: _id, created_at, updated_at, created_by, ...payload } = form;
    await supabase.from('suppliers').update(payload as any).eq('id', id!);
    toast({ title: 'Fornecedor atualizado' });
    setSaving(false);
    fetchAll();
  };

  // Service CRUD
  const openCreateService = () => {
    setEditingService(null);
    setServiceForm({ ...emptyService });
    setServiceDialogOpen(true);
  };
  const openEditService = (s: SupplierService) => {
    setEditingService(s);
    setServiceForm({ ...s });
    setServiceDialogOpen(true);
  };
  const handleSaveService = async () => {
    const { id: sid, supplier_id, created_at, updated_at, created_by, ...payload } = serviceForm;
    if (editingService) {
      await (supabase.from('supplier_services') as any).update(payload).eq('id', editingService.id);
      toast({ title: 'Serviço atualizado' });
    } else {
      await (supabase.from('supplier_services') as any).insert({ ...payload, supplier_id: id });
      toast({ title: 'Serviço criado' });
    }
    setServiceDialogOpen(false);
    fetchAll();
  };
  const handleDeleteService = async (sid: string) => {
    await (supabase.from('supplier_services') as any).delete().eq('id', sid);
    toast({ title: 'Serviço removido' });
    fetchAll();
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('supplier-files').upload(path, file);
    if (uploadErr) {
      toast({ title: 'Erro no upload', description: uploadErr.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('supplier-files').getPublicUrl(path);
    await (supabase.from('supplier_files') as any).insert({
      supplier_id: id, file_name: file.name, file_url: urlData.publicUrl,
      storage_path: path, file_type: file.type.includes('pdf') ? 'pdf' : 'document',
      size_bytes: file.size,
    });
    toast({ title: 'Ficheiro enviado' });
    setUploading(false);
    fetchAll();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleDeleteFile = async (f: SupplierFile) => {
    if (f.storage_path) await supabase.storage.from('supplier-files').remove([f.storage_path]);
    await (supabase.from('supplier_files') as any).delete().eq('id', f.id);
    toast({ title: 'Ficheiro removido' });
    fetchAll();
  };

  // Link CRUD
  const handleSaveLink = async () => {
    await (supabase.from('supplier_links') as any).insert({ ...linkForm, supplier_id: id });
    toast({ title: 'Link adicionado' });
    setLinkDialogOpen(false);
    setLinkForm({ name: '', url: '', description: '' });
    fetchAll();
  };
  const handleDeleteLink = async (lid: string) => {
    await (supabase.from('supplier_links') as any).delete().eq('id', lid);
    toast({ title: 'Link removido' });
    fetchAll();
  };

  // Auto-search supplier links (website, Google Maps, TripAdvisor)
  const searchSupplierLinks = async (supplierName: string, category: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('search-supplier-links', {
        body: { name: supplierName, category, country: 'Portugal' },
      });
      if (error || !data?.success) return;
      const foundLinks = data.links || [];
      if (foundLinks.length > 0) {
        const linksPayload = foundLinks.map((l: any) => ({
          supplier_id: id,
          name: l.name,
          url: l.url,
          description: l.description || null,
        }));
        await (supabase.from('supplier_links') as any).insert(linksPayload);
        toast({ title: 'Links encontrados', description: `${foundLinks.length} link(s) adicionado(s) automaticamente.` });
        fetchAll();
      }
    } catch (err) {
      console.error('Error searching supplier links:', err);
    }
  };

  // Smart import handler
  const handleSmartImport = async (data: any) => {
    if (data.entity) {
      const s = data.entity;
      setForm((prev: any) => ({
        ...prev,
        ...(s.name && { name: s.name }),
        ...(s.category && { category: s.category }),
        ...(s.contact_name && { contact_name: s.contact_name }),
        ...(s.contact_email && { contact_email: s.contact_email }),
        ...(s.contact_phone && { contact_phone: s.contact_phone }),
        ...(s.contract_type && { contract_type: s.contract_type }),
        ...(s.currency && { currency: s.currency }),
        ...(s.cancellation_policy && { cancellation_policy: s.cancellation_policy }),
        ...(s.notes && { notes: s.notes }),
      }));
    }
    if (data.services?.length > 0) {
      const servicesPayload = data.services.map((s: any) => ({
        supplier_id: id, name: s.name || 'Serviço', description: s.description || null,
        category: s.category || 'activity', duration: s.duration || null,
        price: s.price || 0, price_unit: s.price_unit || 'per_person', currency: s.currency || 'EUR',
        payment_conditions: s.payment_conditions || null, cancellation_policy: s.cancellation_policy || null,
        refund_policy: s.refund_policy || null, validity_start: s.validity_start || null,
        validity_end: s.validity_end || null, notes: s.notes || null,
      }));
      await (supabase.from('supplier_services') as any).insert(servicesPayload);
    }

    // Auto-save PDF file if provided
    if (data.pdfFile && id) {
      try {
        const file = data.pdfFile as File;
        const ext = file.name.split('.').pop();
        const path = `${id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('supplier-files').upload(path, file);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('supplier-files').getPublicUrl(path);
          await (supabase.from('supplier_files') as any).insert({
            supplier_id: id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            storage_path: path,
            file_type: 'pdf',
            size_bytes: file.size,
          });
        }
      } catch (err) {
        console.error('Error auto-saving PDF:', err);
      }
    }

    toast({ title: 'Dados importados', description: `${data.services?.length || 0} serviço(s)` });
    fetchAll();

    // Auto-search links if supplier has no links yet
    const supplierName = data.entity?.name || form.name;
    const supplierCategory = data.entity?.category || form.category;
    if (supplierName && links.length === 0) {
      searchSupplierLinks(supplierName, supplierCategory);
    }
  };

  if (!isAdmin) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div></AppLayout>;
  }
  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">A carregar...</div></AppLayout>;
  }
  if (!supplier) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Fornecedor não encontrado.</div></AppLayout>;
  }

  const CAT_COLORS: Record<string, string> = {
    hotel: 'bg-info/20 text-info', guide: 'bg-success/20 text-success',
    transport: 'bg-warning/20 text-warning', winery: 'bg-primary/20 text-primary',
    activity: 'bg-chart-1/20 text-foreground', restaurant: 'bg-urgent/20 text-urgent',
    other: 'bg-muted/20 text-muted-foreground',
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/suppliers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">{supplier.name}</h1>
          <Badge className={`text-[10px] ${CAT_COLORS[supplier.category] || ''}`}>{supplier.category}</Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSmartImportOpen(true)}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />Smart Import
            </Button>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Ficha</TabsTrigger>
            <TabsTrigger value="services">Serviços ({services.length})</TabsTrigger>
            <TabsTrigger value="files">Ficheiros & Links ({files.length + links.length})</TabsTrigger>
          </TabsList>

          {/* PROFILE TAB */}
          <TabsContent value="profile">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contacto</Label>
                    <Input value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Moeda</Label>
                    <Input value={form.currency || ''} onChange={e => setForm({ ...form, currency: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de Contrato</Label>
                    <Input value={form.contract_type || ''} onChange={e => setForm({ ...form, contract_type: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Política de Cancelamento</Label>
                  <Textarea value={form.cancellation_policy || ''} onChange={e => setForm({ ...form, cancellation_policy: e.target.value })} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notas</Label>
                  <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
                <Button onClick={handleSaveSupplier} disabled={saving || !form.name}>
                  <Save className="h-4 w-4 mr-2" />{saving ? 'A guardar...' : 'Guardar'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SERVICES TAB */}
          <TabsContent value="services">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{services.length} serviço(s) protocolado(s)</p>
                <Button size="sm" onClick={openCreateService}><Plus className="h-3.5 w-3.5 mr-1" />Novo Serviço</Button>
              </div>
              {services.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum serviço protocolado. Adicione manualmente ou use AI Import.</CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {services.map(s => (
                    <Card key={s.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="pt-4 pb-3">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground">{s.name}</p>
                              <Badge className={`text-[10px] ${CAT_COLORS[s.category] || ''}`}>{s.category}</Badge>
                              {s.duration && <span className="text-xs text-muted-foreground">⏱ {s.duration}</span>}
                            </div>
                            {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditService(s)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteService(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Pricing */}
                        <div className="mt-3 flex flex-wrap gap-4 text-xs">
                          <div className="bg-muted/30 rounded-md px-3 py-1.5">
                            <span className="text-muted-foreground">Adulto NET:</span>{' '}
                            <span className="font-semibold text-foreground">{s.price > 0 ? `${s.price}€` : '—'}</span>
                            {s.price_unit && <span className="text-muted-foreground"> / {s.price_unit.replace('_', ' ')}</span>}
                          </div>
                          <div className="bg-muted/30 rounded-md px-3 py-1.5">
                            <span className="text-muted-foreground">Criança NET:</span>{' '}
                            <span className="font-semibold text-foreground">{s.price_child > 0 ? `${s.price_child}€` : '—'}</span>
                          </div>
                        </div>

                        {/* Conditions */}
                        {(s.booking_conditions || s.payment_conditions || s.cancellation_policy || s.refund_policy) && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {s.booking_conditions && (
                              <div className="bg-info/5 border border-info/20 rounded-md px-3 py-1.5">
                                <span className="font-medium text-info">📋 Reserva:</span>{' '}
                                <span className="text-foreground">{s.booking_conditions}</span>
                              </div>
                            )}
                            {s.payment_conditions && (
                              <div className="bg-success/5 border border-success/20 rounded-md px-3 py-1.5">
                                <span className="font-medium text-success">💰 Pagamento:</span>{' '}
                                <span className="text-foreground">{s.payment_conditions}</span>
                              </div>
                            )}
                            {s.cancellation_policy && (
                              <div className="bg-warning/5 border border-warning/20 rounded-md px-3 py-1.5">
                                <span className="font-medium text-warning">❌ Cancelamento:</span>{' '}
                                <span className="text-foreground">{s.cancellation_policy}</span>
                              </div>
                            )}
                            {s.refund_policy && (
                              <div className="bg-muted/30 rounded-md px-3 py-1.5">
                                <span className="font-medium text-muted-foreground">↩ Reembolso:</span>{' '}
                                <span className="text-foreground">{s.refund_policy}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Validity & Notes */}
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                          {(s.validity_start || s.validity_end) && (
                            <span>Validade: {s.validity_start || '...'} → {s.validity_end || '...'}</span>
                          )}
                          {s.notes && <span className="italic">📝 {s.notes}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* FILES & LINKS TAB */}
          <TabsContent value="files">
            <div className="space-y-4">
              {/* Files section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Ficheiros & PDFs</CardTitle>
                    <div>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.webp" />
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <Upload className="h-3.5 w-3.5 mr-1" />{uploading ? 'A enviar...' : 'Upload'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {files.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum ficheiro. Faça upload de protocolos, contratos ou outros documentos.</p>
                  ) : (
                    <div className="space-y-2">
                      {files.map(f => (
                        <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/10 border border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {f.size_bytes ? `${(f.size_bytes / 1024).toFixed(0)} KB` : ''} · {new Date(f.created_at).toLocaleDateString('pt-PT')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {f.file_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={f.file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFile(f)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Links section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Links Relevantes</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => { setLinkForm({ name: '', url: '', description: '' }); setLinkDialogOpen(true); }}>
                      <LinkIcon className="h-3.5 w-3.5 mr-1" />Adicionar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {links.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum link guardado.</p>
                  ) : (
                    <div className="space-y-2">
                      {links.map(l => (
                        <div key={l.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/10 border border-border/50">
                          <div className="min-w-0">
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                              {l.name}
                            </a>
                            {l.description && <p className="text-[10px] text-muted-foreground">{l.description}</p>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDeleteLink(l.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* SERVICE DIALOG */}
        <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? 'Editar Serviço' : 'Novo Serviço Protocolado'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={serviceForm.description || ''} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={serviceForm.category} onValueChange={v => setServiceForm({ ...serviceForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Duração</Label>
                  <Input value={serviceForm.duration || ''} onChange={e => setServiceForm({ ...serviceForm, duration: e.target.value })} placeholder="ex: 2h, 1 dia" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço NET Adulto</Label>
                  <Input type="number" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço NET Criança</Label>
                  <Input type="number" value={serviceForm.price_child || 0} onChange={e => setServiceForm({ ...serviceForm, price_child: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={serviceForm.price_unit} onValueChange={v => setServiceForm({ ...serviceForm, price_unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRICE_UNITS.map(u => <SelectItem key={u} value={u}>{u.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Moeda</Label>
                  <Input value={serviceForm.currency} onChange={e => setServiceForm({ ...serviceForm, currency: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condições de Reserva</Label>
                <Textarea value={serviceForm.booking_conditions || ''} onChange={e => setServiceForm({ ...serviceForm, booking_conditions: e.target.value })} rows={2} placeholder="ex: mínimo 2 pax, reserva 48h antes" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condições de Pagamento</Label>
                <Textarea value={serviceForm.payment_conditions || ''} onChange={e => setServiceForm({ ...serviceForm, payment_conditions: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Política de Cancelamento</Label>
                <Textarea value={serviceForm.cancellation_policy || ''} onChange={e => setServiceForm({ ...serviceForm, cancellation_policy: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Política de Reembolso</Label>
                <Textarea value={serviceForm.refund_policy || ''} onChange={e => setServiceForm({ ...serviceForm, refund_policy: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Validade Início</Label>
                  <Input type="date" value={serviceForm.validity_start || ''} onChange={e => setServiceForm({ ...serviceForm, validity_start: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Validade Fim</Label>
                  <Input type="date" value={serviceForm.validity_end || ''} onChange={e => setServiceForm({ ...serviceForm, validity_end: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notas</Label>
                <Textarea value={serviceForm.notes || ''} onChange={e => setServiceForm({ ...serviceForm, notes: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleSaveService} disabled={!serviceForm.name}>
                {editingService ? 'Atualizar' : 'Criar Serviço'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* LINK DIALOG */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Adicionar Link</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={linkForm.name} onChange={e => setLinkForm({ ...linkForm, name: e.target.value })} placeholder="ex: Website oficial" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL *</Label>
                <Input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })} />
              </div>
              <Button onClick={handleSaveLink} disabled={!linkForm.name || !linkForm.url}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <SmartImportDialog
          open={smartImportOpen}
          onOpenChange={setSmartImportOpen}
          entityType="supplier"
          onImportComplete={handleSmartImport}
        />
      </div>
    </AppLayout>
  );
};

export default AdminSupplierDetailPage;
