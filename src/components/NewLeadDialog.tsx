import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Loader2, Clipboard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import TagSelect from '@/components/TagSelect';

const IDIOMAS = ['EN', 'PT', 'FR', 'ES', 'DE', 'IT', 'NL'];
const DESTINOS = ['Porto & Douro Valley', 'Lisbon & Sintra', 'Algarve', 'Azores', 'Madeira', 'Minho', 'Alentejo', 'Silver Coast'];

type Mode = 'manual' | 'ai';

interface FormData {
  clientName: string;
  email: string;
  phone: string;
  travelDates: string;
  datesType: 'concrete' | 'estimated';
  pax: number;
  language: string[];
  budget: string;
  destination: string[];
  request: string;
  preferences: string;
}

const emptyForm: FormData = {
  clientName: '',
  email: '',
  phone: '',
  travelDates: '',
  datesType: 'estimated',
  pax: 2,
  language: ['EN'],
  budget: '',
  destination: [],
  request: '',
  preferences: '',
};

function generateYTId(): string {
  return `YT${Math.floor(1000 + Math.random() * 9000)}`;
}

const NewLeadDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [mode, setMode] = useState<Mode>('manual');
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [emailText, setEmailText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAIImport = async () => {
    if (!emailText.trim() || emailText.trim().length < 10) {
      toast({ title: 'Cole o texto do email', description: 'O texto deve ter pelo menos 10 caracteres.', variant: 'destructive' });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-lead-email', {
        body: { emailText },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const e = data.extracted;
      setForm({
        clientName: e.clientName || '',
        email: e.email || '',
        phone: e.phone || '',
        travelDates: e.travelDates || '',
        datesType: e.datesType || 'estimated',
        pax: e.pax || 2,
        language: e.language ? [e.language] : ['EN'],
        budget: e.budget || '',
        destination: e.destination ? [e.destination] : [],
        request: e.request || '',
        preferences: e.preferences || '',
      });
      setMode('manual');
      toast({ title: 'Dados extraídos com sucesso!', description: 'Revise e confirme os campos preenchidos.' });
    } catch (err: any) {
      console.error('AI import error:', err);
      toast({ title: 'Erro na importação AI', description: err.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = () => {
    if (!form.clientName.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    const newId = generateYTId();
    toast({ title: `Lead ${newId} criada!`, description: `${form.clientName} registado com sucesso.` });
    onOpenChange(false);
    setForm({ ...emptyForm });
    setEmailText('');
    setMode('manual');
    // In future: navigate to the new lead or save to DB
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Nova Lead</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Preencha manualmente ou importe via AI a partir de um email.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => setMode('manual')}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
              mode === 'manual' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Plus className="h-3 w-3 inline mr-1" />
            Manual
          </button>
          <button
            onClick={() => setMode('ai')}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
              mode === 'ai' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3 w-3 inline mr-1" />
            AI Import
          </button>
        </div>

        {/* AI Import mode */}
        {mode === 'ai' && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Cole aqui a conversa de email</Label>
              <Textarea
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
                placeholder="Cole o conteúdo do email aqui... A AI vai extrair automaticamente nome, email, datas, destino, etc."
                rows={10}
                className="mt-1 text-xs font-mono"
              />
            </div>
            <Button onClick={handleAIImport} disabled={aiLoading} className="w-full gap-2 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiLoading ? 'A analisar email...' : 'Extrair Dados com AI'}
            </Button>
          </div>
        )}

        {/* Manual form */}
        {mode === 'manual' && (
          <div className="space-y-4">
            {/* Client info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Nome *</Label>
                <Input className="h-8 text-xs mt-1" value={form.clientName} onChange={e => updateField('clientName', e.target.value)} placeholder="Nome do cliente" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Email</Label>
                <Input className="h-8 text-xs mt-1" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Telefone</Label>
                <Input className="h-8 text-xs mt-1" value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+351 ..." />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Nº Pax</Label>
                <Input className="h-8 text-xs mt-1" type="number" min={1} value={form.pax} onChange={e => updateField('pax', parseInt(e.target.value) || 1)} />
              </div>
            </div>

            {/* Travel dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Datas de Viagem</Label>
                <Input className="h-8 text-xs mt-1" value={form.travelDates} onChange={e => updateField('travelDates', e.target.value)} placeholder="Ex: 15-22 Maio 2026" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Tipo de Datas</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => updateField('datesType', 'concrete')}
                    className={cn("px-3 py-1.5 text-xs rounded border transition-colors", form.datesType === 'concrete' ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground")}
                  >
                    Concretas
                  </button>
                  <button
                    onClick={() => updateField('datesType', 'estimated')}
                    className={cn("px-3 py-1.5 text-xs rounded border transition-colors", form.datesType === 'estimated' ? "bg-[hsl(var(--warning))] text-white border-[hsl(var(--warning))]" : "border-border text-muted-foreground")}
                  >
                    Estimadas
                  </button>
                </div>
              </div>
            </div>

            {/* Destination & Language */}
            <div className="grid grid-cols-2 gap-3">
              <TagSelect label="Destino" value={form.destination} options={DESTINOS} onChange={v => updateField('destination', v)} multiple />
              <TagSelect label="Idioma" value={form.language} options={IDIOMAS} onChange={v => updateField('language', v)} />
            </div>

            {/* Budget */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">Budget (se aplicável)</Label>
              <Input className="h-8 text-xs mt-1" value={form.budget} onChange={e => updateField('budget', e.target.value)} placeholder="Ex: 5000€, €€€, flexible..." />
            </div>

            {/* Request & Preferences */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">Pedido / O que procura</Label>
              <Textarea className="mt-1 text-xs" rows={2} value={form.request} onChange={e => updateField('request', e.target.value)} placeholder="Descrição do pedido..." />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">Preferências Específicas</Label>
              <Textarea className="mt-1 text-xs" rows={2} value={form.preferences} onChange={e => updateField('preferences', e.target.value)} placeholder="Preferências, alergias, necessidades especiais..." />
            </div>

            {/* Create button */}
            <Button onClick={handleCreate} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Criar Lead
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Floating button component to render in AppLayout
export const NewLeadFAB = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="fixed bottom-6 right-6 z-40 h-12 px-5 bg-[hsl(var(--info))] hover:bg-[hsl(var(--info)/0.9)] text-white rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
    title="Nova Lead"
  >
    <Plus className="h-5 w-5" />
    <span className="text-sm font-medium hidden sm:inline">Nova Lead</span>
  </button>
);

export default NewLeadDialog;
