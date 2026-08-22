import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, Upload, FileText, Loader2, ClipboardPaste,
  AlertTriangle, CheckCircle2, Pencil, Trash2, Plus,
  Globe, MapPin, ExternalLink, Link2,
} from 'lucide-react';

// ─── Constants ───
const FSE_CATEGORIES = [
  { value: 'mon', label: '0 - Monumentos Nacionais' },
  { value: 'aloj', label: '1 - Alojamento' },
  { value: 'anim', label: '2 - Animação Turística' },
  { value: 'guias', label: '3 - Guias Externos' },
  { value: 'quintas', label: '4 - Quintas & Caves' },
  { value: 'rest', label: '5 - Restauração' },
  { value: 'mar', label: '6 - Transp. Marítimos' },
  { value: 'terr', label: '7 - Transp. Terrestres' },
];

const FSE_DESTINATIONS = [
  'Açores', 'Alentejo', 'Algarve', 'Centro', 'Douro', 'Lisboa', 'Madeira', 'Norte', 'Porto',
];

const SUB_CATEGORIES: Record<string, string[]> = {
  aloj: ['5★', '4★', '3★', 'Villas', 'Apartments', 'Rural', 'Boutique'],
};

interface ExtraLink { name: string; url: string }

interface FSEFormData {
  supplier_name: string;
  category: string;
  sub_category: string;
  destinations: string[];
  multi_destination: boolean;
  website: string;
  tripadvisor_url: string;
  gmaps_url: string;
  gmb_url: string;
  extra_links: ExtraLink[];
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  net_conditions: string;
  notes: string;
  services: any[];
  missing_fields: string[];
}

const emptyForm = (): FSEFormData => ({
  supplier_name: '', category: '', sub_category: '', destinations: [],
  multi_destination: false, website: '', tripadvisor_url: '', gmaps_url: '', gmb_url: '',
  extra_links: [], contact_name: '', contact_email: '', contact_phone: '',
  net_conditions: '', notes: '', services: [], missing_fields: [],
});

interface FSECreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillDestination?: string;
  prefillCategory?: string;
  onSave?: (data: FSEFormData) => void;
}

export default function FSECreateModal({ open, onOpenChange, prefillDestination, prefillCategory, onSave }: FSECreateModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<string>('smart');
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [extracting, setExtracting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [form, setForm] = useState<FSEFormData>(() => {
    const f = emptyForm();
    if (prefillDestination) f.destinations = [prefillDestination];
    if (prefillCategory) f.category = prefillCategory;
    return f;
  });
  const [editingSvcIdx, setEditingSvcIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep('input');
    setPasteText('');
    setPdfFile(null);
    setExtracting(false);
    setEditingSvcIdx(null);
    const f = emptyForm();
    if (prefillDestination) f.destinations = [prefillDestination];
    if (prefillCategory) f.category = prefillCategory;
    setForm(f);
  }, [prefillDestination, prefillCategory]);

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const updateForm = (key: keyof FSEFormData, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ─── AI Extraction ───
  const runExtraction = async (inputText?: string, pdfBase64?: string) => {
    setExtracting(true);
    try {
      const payload: any = { entity_type: 'fse' };
      if (pdfBase64) payload.pdf_base64 = pdfBase64;
      else if (inputText) payload.text = inputText;

      const { data, error } = await supabase.functions.invoke('extract-supplier-data', { body: payload });

      if (error) {
        // Check if it's a FunctionsFetchError with body
        const errMsg = error.message || 'Erro na extração';
        toast({ title: 'Erro', description: errMsg, variant: 'destructive' });
        setExtracting(false);
        return;
      }

      if (!data?.success) {
        toast({ title: 'Erro na extração', description: data?.error || 'Erro desconhecido', variant: 'destructive' });
        setExtracting(false);
        return;
      }

      const fse = data.fse_data || data.data;
      applyExtractedData(fse);
      setStep('review');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setExtracting(false);
  };

  const applyExtractedData = (fse: any) => {
    const catMatch = FSE_CATEGORIES.find(c =>
      c.label.toLowerCase().includes((fse.category || '').toLowerCase()) ||
      (fse.category || '').toLowerCase().includes(c.value)
    );

    setForm(prev => ({
      ...prev,
      supplier_name: fse.supplier_name || fse.name || fse.entity?.name || prev.supplier_name,
      category: catMatch?.value || prev.category,
      sub_category: fse.sub_category || prev.sub_category,
      destinations: fse.destinations?.length ? fse.destinations : prev.destinations,
      multi_destination: fse.multi_destination || (fse.destinations?.length > 1) || false,
      website: fse.website || prev.website,
      tripadvisor_url: fse.tripadvisor_url || prev.tripadvisor_url,
      gmaps_url: fse.gmaps_url || prev.gmaps_url,
      gmb_url: fse.gmb_url || prev.gmb_url,
      extra_links: fse.extra_links || prev.extra_links,
      contact_name: fse.contact_name || fse.entity?.contact_name || prev.contact_name,
      contact_email: fse.contact_email || fse.entity?.contact_email || prev.contact_email,
      contact_phone: fse.contact_phone || fse.entity?.contact_phone || prev.contact_phone,
      net_conditions: fse.net_conditions || prev.net_conditions,
      notes: fse.notes || fse.entity?.notes || prev.notes,
      services: fse.services || prev.services,
      missing_fields: fse.missing_fields || [],
    }));
  };

  const handleTextExtract = () => {
    if (pasteText.trim().length < 10) return;
    runExtraction(pasteText);
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    setPdfFile(file);
    setExtracting(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Convert to base64 in chunks to avoid stack overflow on large files
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      await runExtraction(undefined, base64);
    } catch (err: any) {
      toast({ title: 'Erro ao ler ficheiro', description: err.message, variant: 'destructive' });
      setExtracting(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf') || file.name.endsWith('.txt'))) {
      handleFileSelect(file);
    } else {
      toast({ title: 'Formato inválido', description: 'Apenas ficheiros PDF ou TXT', variant: 'destructive' });
    }
  };

  const toggleDestination = (dest: string) => {
    setForm(prev => {
      const dests = prev.destinations.includes(dest)
        ? prev.destinations.filter(d => d !== dest)
        : [...prev.destinations, dest];
      return { ...prev, destinations: dests, multi_destination: dests.length > 1 };
    });
  };

  const addExtraLink = () => {
    setForm(prev => ({ ...prev, extra_links: [...prev.extra_links, { name: '', url: '' }] }));
  };

  const updateExtraLink = (idx: number, key: 'name' | 'url', value: string) => {
    setForm(prev => ({
      ...prev,
      extra_links: prev.extra_links.map((l, i) => i === idx ? { ...l, [key]: value } : l),
    }));
  };

  const removeExtraLink = (idx: number) => {
    setForm(prev => ({ ...prev, extra_links: prev.extra_links.filter((_, i) => i !== idx) }));
  };

  const updateService = (idx: number, key: string, value: any) => {
    setForm(prev => ({
      ...prev,
      services: prev.services.map((s, i) => i === idx ? { ...s, [key]: value } : s),
    }));
  };

  const removeService = (idx: number) => {
    setForm(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) }));
  };

  const handleSave = () => {
    if (!form.supplier_name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Preencha o nome do fornecedor', variant: 'destructive' });
      return;
    }
    onSave?.(form);
    handleClose(false);
    toast({
      title: 'Parceiro FSE guardado',
      description: `${form.supplier_name} — ${form.services.length} serviço(s)`,
    });
  };

  const showSubCats = form.category && SUB_CATEGORIES[form.category];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Novo Parceiro FSE
          </DialogTitle>
        </DialogHeader>

        <Tabs value={step === 'review' ? 'smart' : tab} onValueChange={v => { setTab(v); setStep('input'); }}>
          <TabsList className="w-full">
            <TabsTrigger value="smart" className="flex-1 gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />Smart Import
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-1.5 text-xs" disabled={step === 'review'}>
              <Pencil className="h-3.5 w-3.5" />Entrada Manual
            </TabsTrigger>
          </TabsList>

          {/* ─── Smart Import Tab ─── */}
          <TabsContent value="smart" className="space-y-3 mt-3">
            {step === 'input' && (
              <>
                {/* Drop zone */}
                <div
                  ref={dropRef}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-2">Arraste um PDF do protocolo ou clique para selecionar</p>
                  <input ref={fileInputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileInputChange} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
                    {extracting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />A processar...</>
                      : <><Upload className="h-3.5 w-3.5 mr-1.5" />Selecionar Ficheiro</>}
                  </Button>
                  {pdfFile && <p className="text-xs text-primary mt-2">📎 {pdfFile.name}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Text paste */}
                <Textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={8}
                  placeholder="Cole aqui o texto completo do protocolo comercial..."
                  className="text-xs font-mono"
                />
                <Button onClick={handleTextExtract} disabled={extracting || pasteText.trim().length < 10} className="w-full">
                  {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A analisar...</>
                    : <><Sparkles className="h-4 w-4 mr-2" />Analisar com IA</>}
                </Button>
              </>
            )}

            {step === 'review' && <ReviewForm form={form} setForm={setForm} updateForm={updateForm}
              editingSvcIdx={editingSvcIdx} setEditingSvcIdx={setEditingSvcIdx}
              toggleDestination={toggleDestination} addExtraLink={addExtraLink}
              updateExtraLink={updateExtraLink} removeExtraLink={removeExtraLink}
              updateService={updateService} removeService={removeService}
              showSubCats={showSubCats} onBack={() => setStep('input')} onSave={handleSave} />}
          </TabsContent>

          {/* ─── Manual Entry Tab ─── */}
          <TabsContent value="manual" className="space-y-3 mt-3">
            <ReviewForm form={form} setForm={setForm} updateForm={updateForm}
              editingSvcIdx={editingSvcIdx} setEditingSvcIdx={setEditingSvcIdx}
              toggleDestination={toggleDestination} addExtraLink={addExtraLink}
              updateExtraLink={updateExtraLink} removeExtraLink={removeExtraLink}
              updateService={updateService} removeService={removeService}
              showSubCats={showSubCats} onSave={handleSave} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared Review/Form component ───
function ReviewForm({
  form, setForm, updateForm, editingSvcIdx, setEditingSvcIdx,
  toggleDestination, addExtraLink, updateExtraLink, removeExtraLink,
  updateService, removeService, showSubCats, onBack, onSave,
}: {
  form: FSEFormData; setForm: any; updateForm: (k: keyof FSEFormData, v: any) => void;
  editingSvcIdx: number | null; setEditingSvcIdx: (i: number | null) => void;
  toggleDestination: (d: string) => void;
  addExtraLink: () => void; updateExtraLink: (i: number, k: 'name' | 'url', v: string) => void;
  removeExtraLink: (i: number) => void;
  updateService: (i: number, k: string, v: any) => void;
  removeService: (i: number) => void;
  showSubCats: string[] | false | undefined;
  onBack?: () => void; onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Missing fields warning */}
      {form.missing_fields.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium">{form.missing_fields.length} campo(s) não encontrado(s)</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {form.missing_fields.map(f => (
                <Badge key={f} variant="outline" className="text-[9px] border-amber-400 text-amber-700">{f}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Basic Info ─── */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Nome do Fornecedor *</Label>
              <Input value={form.supplier_name} onChange={e => updateForm('supplier_name', e.target.value)} className="h-8 text-xs" placeholder="Nome da empresa" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Categoria FSE</Label>
              <Select value={form.category} onValueChange={v => updateForm('category', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{FSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {showSubCats && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Sub-Categoria</Label>
                <Select value={form.sub_category} onValueChange={v => updateForm('sub_category', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{SUB_CATEGORIES[form.category]!.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Destinations */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Destinos (ponto de saída)
              {form.multi_destination && <Badge className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 border-amber-300">Multi-Destino</Badge>}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {FSE_DESTINATIONS.map(d => (
                <button key={d}
                  onClick={() => toggleDestination(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    form.destinations.includes(d)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Contacto</Label>
              <Input value={form.contact_name} onChange={e => updateForm('contact_name', e.target.value)} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Email</Label>
              <Input value={form.contact_email} onChange={e => updateForm('contact_email', e.target.value)} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Telefone</Label>
              <Input value={form.contact_phone} onChange={e => updateForm('contact_phone', e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Online Presence ─── */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h4 className="text-xs font-semibold flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> Presença Online</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Website Oficial</Label>
              <Input value={form.website} onChange={e => updateForm('website', e.target.value)} className="h-7 text-xs" placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">TripAdvisor</Label>
              <Input value={form.tripadvisor_url} onChange={e => updateForm('tripadvisor_url', e.target.value)} className="h-7 text-xs" placeholder="https://tripadvisor.com/..." />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Google Maps</Label>
              <Input value={form.gmaps_url} onChange={e => updateForm('gmaps_url', e.target.value)} className="h-7 text-xs" placeholder="https://maps.google.com/..." />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Google My Business</Label>
              <Input value={form.gmb_url} onChange={e => updateForm('gmb_url', e.target.value)} className="h-7 text-xs" placeholder="https://..." />
            </div>
          </div>

          {/* Extra links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3" /> Links Adicionais</Label>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={addExtraLink}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
            </div>
            {form.extra_links.map((link, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input value={link.name} onChange={e => updateExtraLink(i, 'name', e.target.value)} className="h-6 text-[10px] w-28" placeholder="Nome" />
                <Input value={link.url} onChange={e => updateExtraLink(i, 'url', e.target.value)} className="h-6 text-[10px] flex-1" placeholder="URL" />
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeExtraLink(i)}>
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Conditions ─── */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <h4 className="text-xs font-semibold">Condições NET / Protocolo</h4>
          <Textarea value={form.net_conditions} onChange={e => updateForm('net_conditions', e.target.value)} rows={3} className="text-xs" placeholder="Resumo das condições NET, comissões, termos de pagamento..." />
          <Textarea value={form.notes} onChange={e => updateForm('notes', e.target.value)} rows={2} className="text-xs" placeholder="Notas adicionais..." />
        </CardContent>
      </Card>

      {/* ─── Services ─── */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold">Serviços ({form.services.length})</h4>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setForm((p: FSEFormData) => ({
                ...p, services: [...p.services, { name: '', description: '', price: 0, price_child: 0, price_unit: 'per_person', currency: 'EUR', notes: '' }],
              }))}>
              <Plus className="h-3 w-3 mr-1" />Adicionar Serviço
            </Button>
          </div>

          {form.services.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3 italic">Nenhum serviço adicionado</p>
          )}

          {form.services.map((svc: any, idx: number) => (
            <div key={idx} className="border rounded-md p-2.5 space-y-2">
              {editingSvcIdx === idx ? (
                <div className="space-y-2">
                  <Input value={svc.name || ''} onChange={e => updateService(idx, 'name', e.target.value)} className="h-7 text-xs" placeholder="Nome do serviço" />
                  <Textarea value={svc.description || ''} onChange={e => updateService(idx, 'description', e.target.value)} rows={2} className="text-xs" placeholder="Descrição / o que inclui" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-muted-foreground">Preço Adulto NET</Label>
                      <Input type="number" value={svc.price || 0} onChange={e => updateService(idx, 'price', parseFloat(e.target.value) || 0)} className="h-6 text-xs" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-muted-foreground">Preço Criança NET</Label>
                      <Input type="number" value={svc.price_child || 0} onChange={e => updateService(idx, 'price_child', parseFloat(e.target.value) || 0)} className="h-6 text-xs" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-muted-foreground">Duração</Label>
                      <Input value={svc.duration || ''} onChange={e => updateService(idx, 'duration', e.target.value)} className="h-6 text-xs" />
                    </div>
                  </div>
                  <Textarea value={svc.notes || ''} onChange={e => updateService(idx, 'notes', e.target.value)} rows={1} className="text-xs" placeholder="Notas (bebé, guia, IVA...)" />
                  <Button size="sm" variant="outline" onClick={() => setEditingSvcIdx(null)} className="w-full text-[10px] h-6">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Concluir
                  </Button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{svc.name || 'Sem nome'}</p>
                    {svc.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{svc.description}</p>}
                    <div className="flex gap-3 mt-0.5 text-[10px]">
                      <span className="font-medium">👤 {svc.price > 0 ? `${svc.price}€` : '—'}</span>
                      <span>👶 {svc.price_child > 0 ? `${svc.price_child}€` : '—'}</span>
                      {svc.duration && <span className="text-muted-foreground">⏱ {svc.duration}</span>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingSvcIdx(idx)}><Pencil className="h-2.5 w-2.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeService(idx)}><Trash2 className="h-2.5 w-2.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── Actions ─── */}
      <div className="flex gap-2 pt-1">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1 text-xs">Voltar</Button>
        )}
        <Button onClick={onSave} disabled={!form.supplier_name.trim()} className="flex-1 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Guardar Parceiro
        </Button>
      </div>
    </div>
  );
}
