import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getProposalAppUrl } from '@/lib/proposalShare';
import { generateGuidePlanningPdf } from '@/lib/guidePlanningPdf';
import { BOOKING_OPTIONS, PAYMENT_OPTIONS, type OpsRow } from '@/components/leads/opsConstants';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId: string;
  leadCode: string;
  rows: OpsRow[];
  dayTitles: Record<number, string>;
}

const labelOf = (opts: { value: string; label: string }[], v: string) =>
  opts.find(o => o.value === v)?.label || '—';

export default function GuidePlanningDialog({ open, onOpenChange, leadId, leadCode, rows, dayTitles }: Props) {
  const { toast } = useToast();
  const [guides, setGuides] = useState('');
  const [showValues, setShowValues] = useState(false);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: lead } = useQuery({
    queryKey: ['lead_guide_pdf', leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!leadId,
  });

  const { data: proposal } = useQuery({
    queryKey: ['lead_guide_pdf_proposal', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('public_token, days, updated_at')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: open && !!leadId,
  });

  const mapByDay = useMemo(() => {
    const out: Record<number, string> = {};
    const days = Array.isArray(proposal?.days) ? (proposal!.days as any[]) : [];
    days.forEach((d: any, idx: number) => {
      const n = Number(d?.day_number ?? idx + 1);
      if (d?.map_url) out[n] = String(d.map_url);
    });
    return out;
  }, [proposal]);

  const dayNumbers = useMemo(
    () => Array.from(new Set(rows.map(r => r.dayNumber))).sort((a, b) => a - b),
    [rows],
  );

  const toggleDay = (d: number) => {
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  };

  const handleGenerate = () => {
    const included = dayNumbers.filter(d => !excluded.has(d));
    if (included.length === 0) {
      toast({ title: 'Seleciona pelo menos um dia', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const planDays = included.map(d => ({
        day: d,
        title: dayTitles[d] || `Dia ${d}`,
        mapUrl: mapByDay[d],
        rows: rows.filter(r => r.dayNumber === d).map(r => ({
          time: r.scheduleTime,
          activity: r.activityTitle,
          supplier: r.supplier,
          pax: r.pax,
          bookingLabel: labelOf(BOOKING_OPTIONS, r.bookingStatus),
          paymentLabel: labelOf(PAYMENT_OPTIONS, r.paymentStatus),
          net: r.netValue,
          real: r.realCost,
        })),
      }));

      const general = {
        leadCode,
        clientName: lead?.client_name || '',
        destination: lead?.destination,
        travelDates: lead?.travel_dates,
        travelEndDate: lead?.travel_end_date,
        pax: lead?.pax,
        paxChildren: lead?.pax_children,
        paxInfants: lead?.pax_infants,
        comfortLevel: lead?.comfort_level,
        notes: lead?.notes,
        contactPhone: lead?.phone,
        contactEmail: lead?.email,
      };

      const proposalUrl = proposal?.public_token ? getProposalAppUrl(proposal.public_token) : null;
      const guideList = guides.split('\n').map(s => s.trim()).filter(Boolean);

      if (guideList.length === 0) {
        generateGuidePlanningPdf({ general, days: planDays, proposalUrl, showValues });
      } else {
        guideList.forEach(guideName =>
          generateGuidePlanningPdf({ general, days: planDays, proposalUrl, showValues, guideName }),
        );
      }
      toast({ title: 'Planning gerado', description: 'PDF descarregado.' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao gerar PDF', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Planning do Guia (PDF)</DialogTitle>
          <DialogDescription>
            Gera uma tabela por guia com horários, atividades, FSE, estados de reserva/pagamento,
            link Google Maps de cada dia e link do programa comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Guia(s) — um por linha (opcional)</Label>
            <Textarea
              rows={3}
              placeholder={'Ex.:\nJoão Silva\nMaria Costa'}
              value={guides}
              onChange={e => setGuides(e.target.value)}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Vazio = gera um planning único sem nome de guia.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Dias a incluir</Label>
            <div className="flex flex-wrap gap-2">
              {dayNumbers.map(d => (
                <label key={d} className="flex items-center gap-1.5 border rounded px-2 py-1 text-[11px] cursor-pointer">
                  <Checkbox checked={!excluded.has(d)} onCheckedChange={() => toggleDay(d)} />
                  Dia {d}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <p className="text-xs font-medium">Incluir valores (NET / Custo Real)</p>
              <p className="text-[10px] text-muted-foreground">Normalmente desligado quando se envia ao guia.</p>
            </div>
            <Switch checked={showValues} onCheckedChange={setShowValues} />
          </div>

          {!proposal?.public_token && (
            <p className="text-[10px] text-[hsl(var(--warning))]">
              Sem proposta publicada nesta lead — o PDF sai sem link do programa comercial.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
