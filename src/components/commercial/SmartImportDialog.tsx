import { useState, useRef } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, Upload, FileText, Loader2, ClipboardPaste,
  AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, Pencil, Trash2
} from 'lucide-react';

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'supplier' | 'partner';
  onImportComplete: (data: any) => void;
}

const SUPPLIER_CATEGORIES = ['hotel', 'guide', 'transport', 'winery', 'activity', 'restaurant', 'other'];
const PARTNER_CATEGORIES = ['travel_agency', 'tour_operator', 'hotel_concierge', 'online_platform', 'dmc', 'other'];
const PRICE_UNITS = ['per_person', 'per_group', 'per_night', 'per_day', 'flat_rate'];

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome', category: 'Categoria', contact_name: 'Contacto', contact_email: 'Email',
  contact_phone: 'Telefone', contract_type: 'Tipo Contrato', currency: 'Moeda',
  cancellation_policy: 'Pol. Cancelamento', notes: 'Notas', commission_percent: 'Comissão %',
  payment_terms: 'Cond. Pagamento', territory: 'Território', description: 'Descrição',
  duration: 'Duração', price: 'Preço Adulto NET', price_child: 'Preço Criança NET',
  price_unit: 'Unidade Preço', booking_conditions: 'Modo Reserva',
  payment_conditions: 'Cond. Pagamento', refund_policy: 'Pol. Reembolso',
  validity_start: 'Validade Início', validity_end: 'Validade Fim',
  address: 'Morada', fiscal_number: 'NIF', bank_iban: 'IBAN',
};

type Step = 'input' | 'review';

const SmartImportDialog = ({ open, onOpenChange, entityType, onImportComplete }: SmartImportDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('input');
  const [tab, setTab] = useState<string>('paste');
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);

  // Review state
  const [entityData, setEntityData] = useState<any>(null);
  const [servicesData, setServicesData] = useState<any[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [editingServiceIdx, setEditingServiceIdx] = useState<number | null>(null);

  const categories = entityType === 'partner' ? PARTNER_CATEGORIES : SUPPLIER_CATEGORIES;
  const label = entityType === 'partner' ? 'parceiro' : 'fornecedor';

  const reset = () => {
    setStep('input');
    setText('');
    setEntityData(null);
    setServicesData([]);
    setMissingFields([]);
    setEditingServiceIdx(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const processExtraction = async (inputText: string) => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-supplier-data', {
        body: { text: inputText, entity_type: entityType },
      });
      if (error || !data?.success) {
        toast({ title: 'Erro na extração', description: data?.error || error?.message, variant: 'destructive' });
        setExtracting(false);
        return;
      }
      const extracted = data.data;
      setEntityData(extracted.entity || {});
      setServicesData(extracted.services || []);
      setMissingFields(extracted.missing_fields || []);
      setStep('review');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setExtracting(false);
  };

  const handleExtractFromText = () => {
    if (text.trim().length < 10) return;
    processExtraction(text);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let extractedText = '';
      const binaryStr = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');
      const textMatches = binaryStr.match(/\(([^)]+)\)/g);
      if (textMatches) {
        extractedText = textMatches.filter(m => m.length > 2).map(m => m.slice(1, -1)).filter(t => /[a-zA-ZÀ-ÿ0-9]/.test(t)).join(' ');
      }
      if (extractedText.length < 50) {
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        extractedText = textDecoder.decode(uint8Array).replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim();
      }
      if (extractedText.length < 20) {
        toast({ title: 'PDF não legível', description: 'Tente copiar e colar o conteúdo manualmente no separador "Copy-Paste".', variant: 'destructive' });
        setExtracting(false);
        return;
      }
      await processExtraction(extractedText.slice(0, 15000));
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setExtracting(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = () => {
    onImportComplete({ entity: entityData, services: servicesData, missing_fields: missingFields });
    handleClose(false);
    toast({
      title: `${entityType === 'partner' ? 'Parceiro' : 'Fornecedor'} importado`,
      description: `${servicesData.length} serviço(s). ${missingFields.length > 0 ? `${missingFields.length} campo(s) a preencher manualmente.` : 'Todos os campos preenchidos!'}`,
    });
  };

  const updateEntity = (key: string, value: any) => {
    setEntityData((prev: any) => ({ ...prev, [key]: value }));
    if (value) setMissingFields(prev => prev.filter(f => f !== key));
  };

  const updateService = (idx: number, key: string, value: any) => {
    setServicesData(prev => prev.map((s, i) => i === idx ? { ...s, [key]: value } : s));
  };

  const removeService = (idx: number) => {
    setServicesData(prev => prev.filter((_, i) => i !== idx));
  };

  const entityFields = entityType === 'partner'
    ? [
        { key: 'name', type: 'text', required: true },
        { key: 'category', type: 'select', options: PARTNER_CATEGORIES },
        { key: 'contact_name', type: 'text' },
        { key: 'contact_email', type: 'text' },
        { key: 'contact_phone', type: 'text' },
        { key: 'address', type: 'text' },
        { key: 'fiscal_number', type: 'text' },
        { key: 'bank_iban', type: 'text' },
        { key: 'commission_percent', type: 'number' },
        { key: 'contract_type', type: 'text' },
        { key: 'currency', type: 'text' },
        { key: 'payment_terms', type: 'textarea' },
        { key: 'territory', type: 'text' },
        { key: 'validity_start', type: 'date' },
        { key: 'validity_end', type: 'date' },
        { key: 'cancellation_policy', type: 'textarea' },
        { key: 'notes', type: 'textarea' },
      ]
    : [
        { key: 'name', type: 'text', required: true },
        { key: 'category', type: 'select', options: SUPPLIER_CATEGORIES },
        { key: 'contact_name', type: 'text' },
        { key: 'contact_email', type: 'text' },
        { key: 'contact_phone', type: 'text' },
        { key: 'address', type: 'text' },
        { key: 'fiscal_number', type: 'text' },
        { key: 'bank_iban', type: 'text' },
        { key: 'contract_type', type: 'text' },
        { key: 'currency', type: 'text' },
        { key: 'validity_start', type: 'date' },
        { key: 'validity_end', type: 'date' },
        { key: 'cancellation_policy', type: 'textarea' },
        { key: 'notes', type: 'textarea' },
      ];

  const isMissing = (key: string) => missingFields.includes(key) || !entityData?.[key];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart Import — {entityType === 'partner' ? 'Parceiro' : 'Fornecedor'}
            {step === 'review' && (
              <Badge className="ml-2 bg-success/20 text-success text-[10px]">Revisão</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="paste" className="flex-1 gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5" />Copy-Paste Protocolo
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex-1 gap-1.5">
                <FileText className="h-3.5 w-3.5" />Import PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">
                Cole o conteúdo completo do protocolo comercial, email ou contrato. A IA vai extrair <strong>todos os dados do {label}</strong>,
                incluindo serviços com <strong>preço NET adulto/criança</strong>, condições de <strong>reserva, pagamento e cancelamento</strong>.
              </p>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={14}
                placeholder={`Cole aqui o texto completo do protocolo comercial...\n\nO sistema vai extrair automaticamente:\n• Dados do ${label} (nome, contacto, NIF, IBAN)\n• Serviços contratados com preço NET adulto e criança\n• Preço guia e política bebés\n• Modo de reserva (ex: apenas por email)\n• Modo de faturação/pagamento\n• Condições de cancelamento\n• Validade do protocolo`}
                className="text-sm font-mono"
              />
              <Button onClick={handleExtractFromText} disabled={extracting || text.trim().length < 10} className="w-full">
                {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A analisar protocolo...</> : <><Sparkles className="h-4 w-4 mr-2" />Extrair Todos os Dados</>}
              </Button>
            </TabsContent>

            <TabsContent value="pdf" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">
                Faça upload do PDF do protocolo comercial. A IA processa o documento e extrai automaticamente toda a informação incluindo preços NET, condições e serviços.
              </p>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Arraste um PDF ou clique para selecionar</p>
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={handlePdfUpload} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
                  {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A processar...</> : <><Upload className="h-4 w-4 mr-2" />Selecionar Ficheiro</>}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {step === 'review' && entityData && (
          <div className="space-y-4">
            {/* Missing fields warning */}
            {missingFields.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-muted border border-warning/30">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {missingFields.length} campo(s) não encontrado(s) — preencha manualmente:
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {missingFields.map(f => (
                      <Badge key={f} variant="outline" className="text-[10px] border-warning/50 text-warning">
                        {FIELD_LABELS[f] || f}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {missingFields.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success-muted border border-success/30">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <p className="text-xs font-medium text-foreground">Todos os campos preenchidos automaticamente!</p>
              </div>
            )}

            {/* Entity fields */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Ficha do {entityType === 'partner' ? 'Parceiro' : 'Fornecedor'}
              </h3>
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {entityFields.map(field => {
                      const missing = isMissing(field.key);
                      return (
                        <div key={field.key} className={`space-y-1 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                          <Label className={`text-[10px] flex items-center gap-1 ${missing ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                            {missing && <AlertTriangle className="h-2.5 w-2.5" />}
                            {FIELD_LABELS[field.key] || field.key}
                            {field.required && ' *'}
                          </Label>
                          {field.type === 'select' ? (
                            <Select value={entityData[field.key] || ''} onValueChange={v => updateEntity(field.key, v)}>
                              <SelectTrigger className={`h-8 text-xs ${missing ? 'border-warning/50' : ''}`}><SelectValue /></SelectTrigger>
                              <SelectContent>{field.options!.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : field.type === 'textarea' ? (
                            <Textarea
                              value={entityData[field.key] || ''}
                              onChange={e => updateEntity(field.key, e.target.value)}
                              rows={2}
                              className={`text-xs ${missing ? 'border-warning/50' : ''}`}
                            />
                          ) : field.type === 'date' ? (
                            <Input
                              type="date"
                              value={entityData[field.key] ?? ''}
                              onChange={e => updateEntity(field.key, e.target.value)}
                              className={`h-8 text-xs ${missing ? 'border-warning/50' : ''}`}
                            />
                          ) : (
                            <Input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={entityData[field.key] ?? ''}
                              onChange={e => updateEntity(field.key, field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                              className={`h-8 text-xs ${missing ? 'border-warning/50' : ''}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Serviços Protocolados ({servicesData.length})
              </h3>
              {servicesData.length === 0 ? (
                <Card><CardContent className="py-4 text-center text-xs text-muted-foreground">Nenhum serviço encontrado no texto.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {servicesData.map((svc, idx) => (
                    <Card key={idx} className={`${editingServiceIdx === idx ? 'border-primary' : ''}`}>
                      <CardContent className="pt-3">
                        {editingServiceIdx === idx ? (
                          /* EDIT MODE */
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Nome</Label>
                                <Input value={svc.name || ''} onChange={e => updateService(idx, 'name', e.target.value)} className="h-7 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                                <Select value={svc.category || ''} onValueChange={v => updateService(idx, 'category', v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{(entityType === 'partner' ? ['private_tour','tailor_made','group_tour','transfer','experience','restaurant','hotel','other'] : SUPPLIER_CATEGORIES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Descrição (o que inclui)</Label>
                              <Textarea value={svc.description || ''} onChange={e => updateService(idx, 'description', e.target.value)} rows={3} className="text-xs" />
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">💰 Preço Adulto NET</Label>
                                <Input type="number" value={svc.price || 0} onChange={e => updateService(idx, 'price', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">👶 Preço Criança NET</Label>
                                <Input type="number" value={svc.price_child || 0} onChange={e => updateService(idx, 'price_child', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Unidade</Label>
                                <Select value={svc.price_unit || 'per_person'} onValueChange={v => updateService(idx, 'price_unit', v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{PRICE_UNITS.map(u => <SelectItem key={u} value={u}>{u.replace('_', ' ')}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">⏱ Duração</Label>
                                <Input value={svc.duration || ''} onChange={e => updateService(idx, 'duration', e.target.value)} className="h-7 text-xs" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">📋 Modo de Reserva</Label>
                              <Input value={svc.booking_conditions || ''} onChange={e => updateService(idx, 'booking_conditions', e.target.value)} className="h-7 text-xs" placeholder="Ex: Apenas por email" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">💰 Modo de Pagamento/Faturação</Label>
                              <Textarea value={svc.payment_conditions || ''} onChange={e => updateService(idx, 'payment_conditions', e.target.value)} rows={2} className="text-xs" placeholder="Ex: Guia recolhe fatura, pagamento até dia 8 do mês seguinte" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">❌ Cancelamento</Label>
                                <Textarea value={svc.cancellation_policy || ''} onChange={e => updateService(idx, 'cancellation_policy', e.target.value)} rows={1} className="text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">↩ Reembolso</Label>
                                <Textarea value={svc.refund_policy || ''} onChange={e => updateService(idx, 'refund_policy', e.target.value)} rows={1} className="text-xs" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Validade Início</Label>
                                <Input type="date" value={svc.validity_start || ''} onChange={e => updateService(idx, 'validity_start', e.target.value)} className="h-7 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Validade Fim</Label>
                                <Input type="date" value={svc.validity_end || ''} onChange={e => updateService(idx, 'validity_end', e.target.value)} className="h-7 text-xs" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">📝 Notas (bebé, guia, IVA, extras)</Label>
                              <Textarea value={svc.notes || ''} onChange={e => updateService(idx, 'notes', e.target.value)} rows={2} className="text-xs" placeholder="Ex: Bebé 0-3 grátis, Guia 17€, IVA incluído" />
                            </div>
                            <Button size="sm" variant="outline" onClick={() => setEditingServiceIdx(null)} className="w-full text-xs h-7">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Concluir Edição
                            </Button>
                          </div>
                        ) : (
                          /* VIEW MODE */
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground">{svc.name || 'Sem nome'}</p>
                                <Badge className="text-[9px] bg-primary/15 text-primary">{svc.category}</Badge>
                                {svc.duration && <span className="text-[10px] text-muted-foreground">⏱ {svc.duration}</span>}
                              </div>
                              {svc.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{svc.description}</p>}
                              
                              {/* Pricing row */}
                              <div className="flex flex-wrap gap-3 mt-1.5 text-[10px]">
                                <span className={`font-semibold ${svc.price > 0 ? 'text-foreground' : 'text-warning'}`}>
                                  👤 Adulto: {svc.price > 0 ? `${svc.price}€` : '⚠ em falta'}
                                </span>
                                <span className={`font-semibold ${svc.price_child > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  👶 Criança: {svc.price_child > 0 ? `${svc.price_child}€` : '—'}
                                </span>
                                <span className="text-muted-foreground">/ {(svc.price_unit || '').replace('_', ' ')}</span>
                              </div>
                              
                              {/* Conditions row */}
                              <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                                {svc.booking_conditions && <span className="text-muted-foreground">📋 {svc.booking_conditions}</span>}
                                {svc.payment_conditions && <span className="text-muted-foreground">💰 {svc.payment_conditions}</span>}
                                {svc.cancellation_policy && <span className="text-muted-foreground">❌ {svc.cancellation_policy}</span>}
                                {svc.refund_policy && <span className="text-muted-foreground">↩ {svc.refund_policy}</span>}
                              </div>

                              {/* Notes with guide/baby/VAT info */}
                              {svc.notes && (
                                <p className="text-[9px] text-muted-foreground mt-1 italic">{svc.notes}</p>
                              )}

                              {/* Highlight missing service fields */}
                              {(() => {
                                const svcMissing = [];
                                if (!svc.price || svc.price === 0) svcMissing.push('Preço Adulto');
                                if (!svc.booking_conditions) svcMissing.push('Modo Reserva');
                                if (!svc.payment_conditions) svcMissing.push('Pagamento');
                                if (!svc.cancellation_policy) svcMissing.push('Cancelamento');
                                if (!svc.validity_start && !svc.validity_end) svcMissing.push('Validade');
                                return svcMissing.length > 0 ? (
                                  <div className="flex items-center gap-1 mt-1">
                                    <AlertTriangle className="h-2.5 w-2.5 text-warning" />
                                    <span className="text-[9px] text-warning">Falta: {svcMissing.join(', ')}</span>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingServiceIdx(idx)}>
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeService(idx)}>
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('input')} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-1" />Voltar
              </Button>
              <Button onClick={handleConfirmImport} disabled={!entityData?.name} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Confirmar Importação
                {missingFields.length > 0 && (
                  <Badge className="ml-1 bg-warning/20 text-warning text-[9px]">{missingFields.length} em falta</Badge>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SmartImportDialog;
