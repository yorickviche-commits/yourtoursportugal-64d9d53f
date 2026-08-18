import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Loader2, Sparkles, Upload, ClipboardPaste, FileSpreadsheet, Trash2, ArrowLeft } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BUSINESS_CONFIG } from '@/lib/businessConfig';

export interface ImportedCostRow {
  day: number;
  description: string;
  supplier: string;
  pricingType: 'total' | 'per_person' | 'per_night';
  numAdults: number;
  priceAdults: number;
  numChildren: number;
  priceChildren: number;
  marginPercent: number;
  costLayer: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pax: number;
  paxChildren: number;
  onConfirm: (rows: ImportedCostRow[]) => void;
}

const LAYERS = ['transport', 'guide', 'experience', 'accommodation', 'meal', 'operational'];
const DEFAULT_MARGIN = BUSINESS_CONFIG.DEFAULT_MARGIN_PERCENT;

const num = (v: any, fallback = 0) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.').replace(/[^\d.-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = reject;
  r.readAsDataURL(file);
});

export default function CostingSmartImportDialog({ open, onOpenChange, pax, paxChildren, onConfirm }: Props) {
  const { toast } = useToast();
  const pdfRef = useRef<HTMLInputElement>(null);
  const xlsRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState('paste');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ImportedCostRow[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const reset = () => { setText(''); setRows(null); setNotes(null); setTab('paste'); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const mapItems = (items: any[]): ImportedCostRow[] =>
    items.filter(i => i && (i.description || i.supplier)).map(i => {
      const pricingType: ImportedCostRow['pricingType'] =
        ['total', 'per_person', 'per_night'].includes(i.pricingType) ? i.pricingType : 'total';
      const priceAdults = num(i.priceAdults);
      const numAdults = i.numAdults != null ? num(i.numAdults, pax) : pax;
      const numChildren = i.numChildren != null ? num(i.numChildren, paxChildren) : paxChildren;
      let margin = i.marginPercent != null ? num(i.marginPercent, DEFAULT_MARGIN) : DEFAULT_MARGIN;
      if ((i.marginPercent == null || margin === 0) && num(i.pvpTotal) > 0) {
        const net = pricingType === 'per_person'
          ? priceAdults * numAdults + num(i.priceChildren) * numChildren
          : pricingType === 'per_night' ? priceAdults * numAdults : priceAdults;
        if (net > 0) margin = Math.round(((num(i.pvpTotal) / net) - 1) * 1000) / 10;
      }
      if (!Number.isFinite(margin) || margin <= 0) margin = DEFAULT_MARGIN;
      return {
        day: Math.max(0, Math.round(num(i.day, 1))),
        description: String(i.description || '').trim(),
        supplier: String(i.supplier || '').trim(),
        pricingType,
        numAdults: pricingType === 'per_night' ? Math.max(1, numAdults) : numAdults,
        priceAdults,
        numChildren,
        priceChildren: num(i.priceChildren),
        marginPercent: margin,
        costLayer: LAYERS.includes(i.costLayer) ? i.costLayer : 'experience',
      };
    });

  const extract = async (payload: { text?: string; pdf_base64?: string }) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-costing-data', {
        body: { ...payload, pax, pax_children: paxChildren, margin: DEFAULT_MARGIN },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na extração');
      const mapped = mapItems(data.data.items || []);
      if (mapped.length === 0) throw new Error('Nenhuma rubrica identificada no conteúdo fornecido.');
      setRows(mapped);
      setNotes(data.data.notes || null);
    } catch (e: any) {
      toast({ title: 'Erro na importação', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async (f: File) => {
    if (f.size > 7 * 1024 * 1024) {
      toast({ title: 'PDF demasiado grande', description: 'Máximo 7MB.', variant: 'destructive' });
      return;
    }
    const b64 = await fileToBase64(f);
    await extract({ pdf_base64: b64 });
  };

  const handleSheet = async (f: File) => {
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const chunks: string[] = [];
      wb.SheetNames.forEach(name => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        if (csv.trim()) chunks.push(`### Folha: ${name}\n${csv}`);
      });
      const joined = chunks.join('\n\n').slice(0, 60000);
      if (!joined.trim()) throw new Error('Ficheiro vazio.');
      await extract({ text: joined });
    } catch (e: any) {
      toast({ title: 'Erro ao ler ficheiro', description: e.message, variant: 'destructive' });
    }
  };

  const update = (idx: number, patch: Partial<ImportedCostRow>) =>
    setRows(prev => prev!.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => setRows(prev => prev!.filter((_, i) => i !== idx));

  const missingCount = (rows || []).filter(r => !r.supplier || !r.priceAdults).length;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[hsl(var(--info))]" /> Importar Custos (AI)
          </DialogTitle>
          <DialogDescription className="text-xs">
            PDF, Excel/CSV ou texto colado. A AI cria as rubricas com descrição, fornecedor, pax,
            tipo de preço, NET, margem ({DEFAULT_MARGIN}% por defeito) e PVP. O que não conseguir extrair fica vazio.
          </DialogDescription>
        </DialogHeader>

        {!rows && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="paste" className="text-xs gap-1"><ClipboardPaste className="h-3 w-3" /> Colar texto</TabsTrigger>
              <TabsTrigger value="pdf" className="text-xs gap-1"><Upload className="h-3 w-3" /> PDF</TabsTrigger>
              <TabsTrigger value="sheet" className="text-xs gap-1"><FileSpreadsheet className="h-3 w-3" /> Excel / CSV</TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-2 pt-3">
              <Textarea
                rows={12}
                className="text-xs font-mono"
                placeholder={'Cola aqui o orçamento, tabela ou email do fornecedor...'}
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <Button size="sm" className="text-xs gap-1" disabled={busy || text.trim().length < 10} onClick={() => extract({ text })}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Extrair rubricas
              </Button>
            </TabsContent>

            <TabsContent value="pdf" className="pt-3">
              <input ref={pdfRef} type="file" accept="application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePdf(f); e.target.value = ''; }} />
              <Button size="sm" variant="outline" className="text-xs gap-1" disabled={busy} onClick={() => pdfRef.current?.click()}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Escolher PDF (máx. 7MB)
              </Button>
            </TabsContent>

            <TabsContent value="sheet" className="pt-3">
              <input ref={xlsRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSheet(f); e.target.value = ''; }} />
              <Button size="sm" variant="outline" className="text-xs gap-1" disabled={busy} onClick={() => xlsRef.current?.click()}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />} Escolher Excel / CSV
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {rows && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{rows.length} rubricas</Badge>
              {missingCount > 0 && (
                <Badge className="text-[10px] bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]">
                  {missingCount} com campos em falta
                </Badge>
              )}
              {notes && <span className="text-[10px] text-muted-foreground">{notes}</span>}
            </div>

            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 w-14">Dia</th>
                    <th className="px-2 py-1.5">Descrição</th>
                    <th className="px-2 py-1.5">Fornecedor</th>
                    <th className="px-2 py-1.5 w-28">Tipo</th>
                    <th className="px-2 py-1.5 w-14">Adt</th>
                    <th className="px-2 py-1.5 w-20">€ Adt</th>
                    <th className="px-2 py-1.5 w-14">Chl</th>
                    <th className="px-2 py-1.5 w-20">€ Chl</th>
                    <th className="px-2 py-1.5 w-20">Margem %</th>
                    <th className="px-2 py-1.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" type="number" value={r.day} onChange={e => update(i, { day: num(e.target.value) })} /></td>
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" value={r.description} onChange={e => update(i, { description: e.target.value })} /></td>
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" value={r.supplier} placeholder="—" onChange={e => update(i, { supplier: e.target.value })} /></td>
                      <td className="px-1 py-1">
                        <Select value={r.pricingType} onValueChange={v => update(i, { pricingType: v as any })}>
                          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="total" className="text-xs">Total</SelectItem>
                            <SelectItem value="per_person" className="text-xs">Por pessoa</SelectItem>
                            <SelectItem value="per_night" className="text-xs">Por noite</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" type="number" value={r.numAdults} onChange={e => update(i, { numAdults: num(e.target.value) })} /></td>
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" type="number" value={r.priceAdults} onChange={e => update(i, { priceAdults: num(e.target.value) })} /></td>
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" type="number" value={r.numChildren} onChange={e => update(i, { numChildren: num(e.target.value) })} /></td>
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" type="number" value={r.priceChildren} onChange={e => update(i, { priceChildren: num(e.target.value) })} /></td>
                      <td className="px-1 py-1"><Input className="h-7 text-[11px]" type="number" value={r.marginPercent} onChange={e => update(i, { marginPercent: num(e.target.value) })} /></td>
                      <td className="px-1 py-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(i)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Dia 0 = secção Alojamentos (preço por noite). As rubricas são adicionadas às existentes.
            </p>
          </div>
        )}

        <DialogFooter>
          {rows && (
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setRows(null)}>
              <ArrowLeft className="h-3 w-3" /> Voltar
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => close(false)}>Cancelar</Button>
          {rows && (
            <Button size="sm" className="text-xs" onClick={() => { onConfirm(rows); close(false); }}>
              Adicionar {rows.length} rubricas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
