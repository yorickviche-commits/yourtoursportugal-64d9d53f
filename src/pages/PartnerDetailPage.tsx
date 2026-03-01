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
  Link as LinkIcon, Sparkles, Loader2, ExternalLink, Handshake
} from 'lucide-react';

const CATEGORIES = ['travel_agency', 'tour_operator', 'hotel_concierge', 'online_platform', 'dmc', 'other'];
const SERVICE_CATEGORIES = ['private_tour', 'tailor_made', 'group_tour', 'transfer', 'experience', 'other'];
const PRICE_UNITS = ['per_person', 'per_group', 'per_night', 'per_day', 'flat_rate'];
const CAT_LABELS: Record<string, string> = {
  travel_agency: 'Agência', tour_operator: 'Operador', hotel_concierge: 'Concierge',
  online_platform: 'Plataforma', dmc: 'DMC', other: 'Outro',
};
const SVC_LABELS: Record<string, string> = {
  private_tour: 'Tour Privado', tailor_made: 'Tailor Made', group_tour: 'Tour Grupo',
  transfer: 'Transfer', experience: 'Experiência', other: 'Outro',
};

const emptyService = {
  name: '', description: '', category: 'private_tour', duration: '', price: 0,
  price_child: 0, price_unit: 'per_person', currency: 'EUR', commission_percent: 0,
  payment_conditions: '', cancellation_policy: '', refund_policy: '',
  booking_conditions: '', notes: '', status: 'active', validity_start: '', validity_end: '',
};

const PartnerDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [partner, setPartner] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [services, setServices] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState<any>({ ...emptyService });

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: '', url: '', description: '' });

  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    const [pRes, servRes, fRes, lRes] = await Promise.all([
      (supabase.from('partners') as any).select('*').eq('id', id).single(),
      (supabase.from('partner_services') as any).select('*').eq('partner_id', id).order('name'),
      (supabase.from('partner_files') as any).select('*').eq('partner_id', id).order('created_at', { ascending: false }),
      (supabase.from('partner_links') as any).select('*').eq('partner_id', id).order('created_at', { ascending: false }),
    ]);
    if (pRes.data) { setPartner(pRes.data); setForm(pRes.data); }
    setServices(servRes.data || []);
    setFiles(fRes.data || []);
    setLinks(lRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleSavePartner = async () => {
    setSaving(true);
    const { id: _id, created_at, updated_at, created_by, ...payload } = form;
    await (supabase.from('partners') as any).update(payload).eq('id', id!);
    toast({ title: 'Parceiro atualizado' });
    setSaving(false);
    fetchAll();
  };

  const openCreateService = () => { setEditingService(null); setServiceForm({ ...emptyService }); setServiceDialogOpen(true); };
  const openEditService = (s: any) => { setEditingService(s); setServiceForm({ ...s }); setServiceDialogOpen(true); };
  const handleSaveService = async () => {
    const { id: sid, partner_id, created_at, updated_at, created_by, ...payload } = serviceForm;
    if (editingService) {
      await (supabase.from('partner_services') as any).update(payload).eq('id', editingService.id);
      toast({ title: 'Serviço atualizado' });
    } else {
      await (supabase.from('partner_services') as any).insert({ ...payload, partner_id: id });
      toast({ title: 'Serviço criado' });
    }
    setServiceDialogOpen(false);
    fetchAll();
  };
  const handleDeleteService = async (sid: string) => {
    await (supabase.from('partner_services') as any).delete().eq('id', sid);
    toast({ title: 'Serviço removido' });
    fetchAll();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    const path = `partners/${id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadErr } = await supabase.storage.from('supplier-files').upload(path, file);
    if (uploadErr) { toast({ title: 'Erro', description: uploadErr.message, variant: 'destructive' }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('supplier-files').getPublicUrl(path);
    await (supabase.from('partner_files') as any).insert({
      partner_id: id, file_name: file.name, file_url: urlData.publicUrl,
      storage_path: path, file_type: file.type.includes('pdf') ? 'pdf' : 'document', size_bytes: file.size,
    });
    toast({ title: 'Ficheiro enviado' });
    setUploading(false);
    fetchAll();
  };
  const handleDeleteFile = async (f: any) => {
    if (f.storage_path) await supabase.storage.from('supplier-files').remove([f.storage_path]);
    await (supabase.from('partner_files') as any).delete().eq('id', f.id);
    toast({ title: 'Ficheiro removido' });
    fetchAll();
  };

  const handleSaveLink = async () => {
    await (supabase.from('partner_links') as any).insert({ ...linkForm, partner_id: id });
    toast({ title: 'Link adicionado' });
    setLinkDialogOpen(false);
    setLinkForm({ name: '', url: '', description: '' });
    fetchAll();
  };
  const handleDeleteLink = async (lid: string) => {
    await (supabase.from('partner_links') as any).delete().eq('id', lid);
    toast({ title: 'Link removido' });
    fetchAll();
  };

  const handleSmartImport = async (data: any) => {
    if (data.entity) {
      const e = data.entity;
      setForm((prev: any) => ({
        ...prev,
        ...(e.name && { name: e.name }),
        ...(e.category && { category: e.category }),
        ...(e.contact_name && { contact_name: e.contact_name }),
        ...(e.contact_email && { contact_email: e.contact_email }),
        ...(e.contact_phone && { contact_phone: e.contact_phone }),
        ...(e.commission_percent && { commission_percent: e.commission_percent }),
        ...(e.contract_type && { contract_type: e.contract_type }),
        ...(e.currency && { currency: e.currency }),
        ...(e.payment_terms && { payment_terms: e.payment_terms }),
        ...(e.territory && { territory: e.territory }),
        ...(e.notes && { notes: e.notes }),
      }));
    }
    if (data.services?.length > 0) {
      const servicesPayload = data.services.map((s: any) => ({
        partner_id: id, name: s.name || 'Serviço', description: s.description || null,
        category: s.category || 'private_tour', duration: s.duration || null,
        price: s.price || 0, price_unit: s.price_unit || 'per_person', currency: s.currency || 'EUR',
        commission_percent: s.commission_percent || 0, payment_conditions: s.payment_conditions || null,
        cancellation_policy: s.cancellation_policy || null, refund_policy: s.refund_policy || null,
        validity_start: s.validity_start || null, validity_end: s.validity_end || null, notes: s.notes || null,
      }));
      await (supabase.from('partner_services') as any).insert(servicesPayload);
    }
    fetchAll();
  };

  if (!isAdmin) return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div></AppLayout>;
  if (loading) return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">A carregar...</div></AppLayout>;
  if (!partner) return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Parceiro não encontrado.</div></AppLayout>;

  const CAT_COLORS: Record<string, string> = {
    travel_agency: 'bg-info/20 text-info', tour_operator: 'bg-success/20 text-success',
    hotel_concierge: 'bg-warning/20 text-warning', online_platform: 'bg-primary/20 text-primary',
    dmc: 'bg-chart-1/20 text-foreground', other: 'bg-muted/20 text-muted-foreground',
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/partners')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Handshake className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">{partner.name}</h1>
          <Badge className={`text-[10px] ${CAT_COLORS[partner.category] || ''}`}>{CAT_LABELS[partner.category] || partner.category}</Badge>
          <div className="ml-auto">
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

          {/* PROFILE */}
          <TabsContent value="profile">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs">Nome *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Categoria</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Contacto</Label><Input value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Telefone</Label><Input value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Comissão %</Label><Input type="number" value={form.commission_percent || 0} onChange={e => setForm({ ...form, commission_percent: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Território</Label><Input value={form.territory || ''} onChange={e => setForm({ ...form, territory: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Moeda</Label><Input value={form.currency || ''} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Condições de Pagamento</Label><Textarea value={form.payment_terms || ''} onChange={e => setForm({ ...form, payment_terms: e.target.value })} rows={2} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
                <Button onClick={handleSavePartner} disabled={saving || !form.name}><Save className="h-4 w-4 mr-2" />{saving ? 'A guardar...' : 'Guardar'}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SERVICES */}
          <TabsContent value="services">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{services.length} serviço(s) protocolado(s)</p>
                <Button size="sm" onClick={openCreateService}><Plus className="h-3.5 w-3.5 mr-1" />Novo Serviço</Button>
              </div>
              {services.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum serviço. Adicione manualmente ou use Smart Import.</CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {services.map((s: any) => (
                    <Card key={s.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground">{s.name}</p>
                              <Badge className="text-[10px] bg-primary/20 text-primary">{SVC_LABELS[s.category] || s.category}</Badge>
                              {s.duration && <span className="text-xs text-muted-foreground">⏱ {s.duration}</span>}
                            </div>
                            {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditService(s)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteService(s.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-4 text-xs">
                          <div className="bg-muted/30 rounded-md px-3 py-1.5">
                            <span className="text-muted-foreground">Adulto NET:</span>{' '}
                            <span className="font-semibold text-foreground">{s.price > 0 ? `${s.price}€` : '—'}</span>
                            {s.price_unit && <span className="text-muted-foreground"> / {s.price_unit?.replace('_', ' ')}</span>}
                          </div>
                          <div className="bg-muted/30 rounded-md px-3 py-1.5">
                            <span className="text-muted-foreground">Criança NET:</span>{' '}
                            <span className="font-semibold text-foreground">{s.price_child > 0 ? `${s.price_child}€` : '—'}</span>
                          </div>
                          {s.commission_percent > 0 && (
                            <div className="bg-success/10 rounded-md px-3 py-1.5">
                              <span className="font-medium text-success">{s.commission_percent}% comissão</span>
                            </div>
                          )}
                        </div>

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

          {/* FILES & LINKS */}
          <TabsContent value="files">
            <div className="space-y-4">
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
                  {files.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum ficheiro.</p> : (
                    <div className="space-y-2">
                      {files.map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/10 border border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                              <p className="text-[10px] text-muted-foreground">{f.size_bytes ? `${(f.size_bytes / 1024).toFixed(0)} KB` : ''}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {f.file_url && <Button variant="ghost" size="icon" className="h-7 w-7" asChild><a href={f.file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFile(f)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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
                  {links.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum link.</p> : (
                    <div className="space-y-2">
                      {links.map((l: any) => (
                        <div key={l.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/10 border border-border/50">
                          <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate">{l.name}</a>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDeleteLink(l.id)}><Trash2 className="h-3 w-3" /></Button>
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
            <DialogHeader><DialogTitle>{editingService ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5"><Label className="text-xs">Nome *</Label><Input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Textarea value={serviceForm.description || ''} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Categoria</Label>
                  <Select value={serviceForm.category} onValueChange={v => setServiceForm({ ...serviceForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{SVC_LABELS[c] || c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Duração</Label><Input value={serviceForm.duration || ''} onChange={e => setServiceForm({ ...serviceForm, duration: e.target.value })} placeholder="ex: 4h, full-day" /></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Preço NET Adulto</Label><Input type="number" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Preço NET Criança</Label><Input type="number" value={serviceForm.price_child || 0} onChange={e => setServiceForm({ ...serviceForm, price_child: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Unidade</Label>
                  <Select value={serviceForm.price_unit} onValueChange={v => setServiceForm({ ...serviceForm, price_unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRICE_UNITS.map(u => <SelectItem key={u} value={u}>{u.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Comissão %</Label><Input type="number" value={serviceForm.commission_percent} onChange={e => setServiceForm({ ...serviceForm, commission_percent: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Condições de Reserva</Label><Textarea value={serviceForm.booking_conditions || ''} onChange={e => setServiceForm({ ...serviceForm, booking_conditions: e.target.value })} rows={2} placeholder="ex: mínimo 2 pax, reserva 48h antes" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Condições de Pagamento</Label><Textarea value={serviceForm.payment_conditions || ''} onChange={e => setServiceForm({ ...serviceForm, payment_conditions: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Cancelamento</Label><Textarea value={serviceForm.cancellation_policy || ''} onChange={e => setServiceForm({ ...serviceForm, cancellation_policy: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Reembolso</Label><Textarea value={serviceForm.refund_policy || ''} onChange={e => setServiceForm({ ...serviceForm, refund_policy: e.target.value })} rows={2} /></div>
              <Button onClick={handleSaveService} disabled={!serviceForm.name}>{editingService ? 'Atualizar' : 'Criar'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* LINK DIALOG */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Adicionar Link</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5"><Label className="text-xs">Nome *</Label><Input value={linkForm.name} onChange={e => setLinkForm({ ...linkForm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">URL *</Label><Input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Input value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })} /></div>
              <Button onClick={handleSaveLink} disabled={!linkForm.name || !linkForm.url}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <SmartImportDialog open={smartImportOpen} onOpenChange={setSmartImportOpen} entityType="partner" onImportComplete={handleSmartImport} />
      </div>
    </AppLayout>
  );
};

export default PartnerDetailPage;
