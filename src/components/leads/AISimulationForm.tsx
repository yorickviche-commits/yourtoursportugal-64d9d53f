import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Sparkles, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCreateLead } from '@/hooks/useLeadsQuery';
import { logActivity } from '@/hooks/useActivityLog';
import type { SimulationFormData } from '@/types/leads';

const STEPS = ['Trip Basics', 'Travel Style', 'Comfort', 'Budget', 'Magic Question'];

const TRAVEL_STYLES = [
  { id: 'food_wine', emoji: '🍷', label: 'Food & Wine' },
  { id: 'nature', emoji: '🌿', label: 'Nature & Relaxation' },
  { id: 'culture', emoji: '🏛', label: 'Culture & History' },
  { id: 'luxury', emoji: '⭐', label: 'Luxury & Exclusive' },
  { id: 'roadtrip', emoji: '🚗', label: 'Roadtrip Adventure' },
];

const DESTINATIONS = ['Portugal (Full)', 'Porto & North', 'Douro Valley', 'Lisbon & Sintra', 'Algarve', 'Azores', 'Alentejo', 'Custom'];

const COMFORT_LEVELS = [
  { id: 'authentic', label: 'Authentic & Comfortable', desc: 'Charming local stays, real Portugal' },
  { id: 'premium', label: 'Premium & Boutique', desc: 'Curated boutique hotels & experiences' },
  { id: 'luxury', label: 'Luxury', desc: 'Top-tier hotels & exclusive access' },
];

const BUDGETS = [
  { id: '€€', label: '€€', desc: 'Balanced comfort' },
  { id: '€€€', label: '€€€', desc: 'Premium experiences' },
  { id: '€€€€', label: '€€€€', desc: 'High-end / Luxury' },
];

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

const AISimulationForm = ({ open, onOpenChange }: Props) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SimulationFormData>({
    name: '', email: '', travelDates: '', pax: 2, destination: '',
    travelStyles: [], comfortLevel: '', budget: '', magicQuestion: '',
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const createLead = useCreateLead();

  const update = (field: keyof SimulationFormData, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const toggleStyle = (id: string) =>
    setForm(prev => ({
      ...prev,
      travelStyles: prev.travelStyles.includes(id) ? prev.travelStyles.filter(s => s !== id) : [...prev.travelStyles, id],
    }));

  const canNext = () => {
    if (step === 0) return form.name && form.email && form.destination;
    if (step === 1) return form.travelStyles.length > 0;
    if (step === 2) return !!form.comfortLevel;
    if (step === 3) return !!form.budget;
    return true;
  };

  const handleSubmit = async () => {
    const styleLabels = form.travelStyles.map(id => TRAVEL_STYLES.find(ts => ts.id === id)?.label || id);
    const comfortLabel = COMFORT_LEVELS.find(c => c.id === form.comfortLevel)?.label || form.comfortLevel;

    try {
      const newLead = await createLead.mutateAsync({
        client_name: form.name,
        email: form.email,
        destination: form.destination,
        travel_dates: form.travelDates || 'A definir',
        pax: form.pax,
        status: 'new',
        source: 'ai_simulation',
        budget_level: form.budget || '€€',
        sales_owner: 'Yorick',
        travel_style: styleLabels,
        comfort_level: comfortLabel,
        magic_question: form.magicQuestion || '',
      });
      await logActivity('lead_created', 'lead', newLead.id, { client_name: form.name, source: 'ai_simulation' });
      toast({ title: `Simulação ${newLead.lead_code} criada!` });
      onOpenChange(false);
      setStep(0);
      setForm({ name: '', email: '', travelDates: '', pax: 2, destination: '', travelStyles: [], comfortLevel: '', budget: '', magicQuestion: '' });
      navigate(`/leads/${newLead.id}`);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-[hsl(var(--urgent))]" /> New AI Trip Simulation
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Preencha os dados para gerar uma simulação AI.</DialogDescription>
          <div className="flex gap-1 mt-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn("h-1 w-full rounded-full transition-colors", i <= step ? "bg-[hsl(var(--info))]" : "bg-muted")} />
                <span className={cn("text-[10px] transition-colors", i === step ? "text-foreground font-medium" : "text-muted-foreground")}>{s}</span>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 min-h-[280px]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Name *</label>
                <Input placeholder="Client full name" value={form.name} onChange={e => update('name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email / WhatsApp *</label>
                <Input placeholder="email@example.com or +351..." value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Travel dates</label>
                  <Input placeholder="e.g. April 2026" value={form.travelDates} onChange={e => update('travelDates', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Travelers</label>
                  <Input type="number" min={1} value={form.pax} onChange={e => update('pax', parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Destination interest *</label>
                <div className="flex flex-wrap gap-2">
                  {DESTINATIONS.map(d => (
                    <button key={d} onClick={() => update('destination', d)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", form.destination === d ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "bg-card text-muted-foreground border-border hover:border-[hsl(var(--info)/0.5)]")}>{d}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">What type of experience? <span className="text-[10px]">(multi-select)</span></p>
              <div className="grid grid-cols-1 gap-2">
                {TRAVEL_STYLES.map(ts => (
                  <button key={ts.id} onClick={() => toggleStyle(ts.id)} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all", form.travelStyles.includes(ts.id) ? "bg-[hsl(var(--info-muted))] border-[hsl(var(--info))] ring-1 ring-[hsl(var(--info)/0.3)]" : "bg-card border-border hover:border-[hsl(var(--info)/0.4)]")}>
                    <span className="text-2xl">{ts.emoji}</span>
                    <span className="text-sm font-medium text-foreground">{ts.label}</span>
                    {form.travelStyles.includes(ts.id) && <Check className="h-4 w-4 ml-auto text-[hsl(var(--info))]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Preferred comfort level</p>
              <div className="grid grid-cols-1 gap-2">
                {COMFORT_LEVELS.map(cl => (
                  <button key={cl.id} onClick={() => update('comfortLevel', cl.id)} className={cn("flex flex-col items-start px-4 py-3.5 rounded-lg border text-left transition-all", form.comfortLevel === cl.id ? "bg-[hsl(var(--info-muted))] border-[hsl(var(--info))] ring-1 ring-[hsl(var(--info)/0.3)]" : "bg-card border-border hover:border-[hsl(var(--info)/0.4)]")}>
                    <span className="text-sm font-medium text-foreground">{cl.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{cl.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Approximate trip investment</p>
              <div className="grid grid-cols-1 gap-2">
                {BUDGETS.map(b => (
                  <button key={b.id} onClick={() => update('budget', b.id)} className={cn("flex items-center justify-between px-4 py-3.5 rounded-lg border text-left transition-all", form.budget === b.id ? "bg-[hsl(var(--info-muted))] border-[hsl(var(--info))] ring-1 ring-[hsl(var(--info)/0.3)]" : "bg-card border-border hover:border-[hsl(var(--info)/0.4)]")}>
                    <div>
                      <span className="text-lg font-semibold text-foreground">{b.label}</span>
                      <p className="text-xs text-muted-foreground">{b.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">The one question that changes everything ❤️</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground italic">"What would make this trip unforgettable for you?"</label>
                <Textarea placeholder="E.g. A private sunset dinner overlooking the Douro Valley..." className="min-h-[120px] resize-none" value={form.magicQuestion} onChange={e => update('magicQuestion', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-between bg-muted/30">
          <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="bg-[hsl(var(--info))] hover:bg-[hsl(var(--info)/0.9)] text-white">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={createLead.isPending} className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-white">
              {createLead.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate Simulation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISimulationForm;
