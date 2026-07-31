import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, ExternalLink, AlertCircle, CheckCircle2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePaymentLinks, useCreatePaymentLink, usePublishPaymentLink, type PaymentLink } from '@/hooks/usePaymentLinksQuery';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId: string;
  proposalId?: string | null;
  defaultTitle?: string;
  tripRef?: string | null;
  defaultAmount?: number; // in currency units (EUR)
  defaultStartDate?: string | null;
  defaultEndDate?: string | null;
}

const feeOptions = [
  { value: 'participant', label: 'Participante' },
  { value: 'organizer', label: 'Organizador' },
];

const PaymentLinkDialog = ({
  open, onOpenChange, leadId, proposalId = null,
  defaultTitle = '', tripRef = null, defaultAmount = 0,
  defaultStartDate = null, defaultEndDate = null,
}: Props) => {
  const { data: links = [] } = usePaymentLinks(leadId);
  const createLink = useCreatePaymentLink();
  const publishLink = usePublishPaymentLink();

  const [title, setTitle] = useState('');
  const [ref, setRef] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [paymentFees, setPaymentFees] = useState<'organizer' | 'participant'>('participant');
  const [wtFees, setWtFees] = useState<'organizer' | 'participant'>('participant');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentLink | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle((defaultTitle || '').slice(0, 70));
    setRef(tripRef || '');
    setStartDate(defaultStartDate || '');
    setEndDate(defaultEndDate || '');
    setAmount(defaultAmount > 0 ? defaultAmount.toFixed(2) : '');
    setError(null);
    setResult(null);
  }, [open, defaultTitle, tripRef, defaultAmount, defaultStartDate, defaultEndDate]);

  const pendingDraft = links.find(l => l.status === 'draft' && l.wetravel_uuid);
  const publishedLinks = links.filter(l => l.status === 'published' && l.url);
  const busy = createLink.isPending || publishLink.isPending;

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const submit = async () => {
    setError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle) return setError('Indica um título para o link.');
    if (cleanTitle.length > 70) return setError('O título não pode exceder 70 caracteres.');
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value <= 0) return setError('Indica um montante maior que zero.');

    try {
      const link = await createLink.mutateAsync({
        lead_id: leadId,
        proposal_id: proposalId,
        title: cleanTitle,
        trip_ref: ref.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        amount_cents: Math.round(value * 100),
        currency,
        expires_at: useExpiry && expiresAt ? new Date(expiresAt).toISOString() : null,
        payment_fees_paid_by: paymentFees,
        wetravel_fee_paid_by: wtFees,
      });
      setResult(link);
      toast.success('Link de pagamento criado e publicado.');
    } catch (e: any) {
      setError(e.message || 'Erro ao criar o link de pagamento.');
    }
  };

  const resume = async (id: string) => {
    setError(null);
    try {
      const link = await publishLink.mutateAsync(id);
      setResult(link);
      toast.success('Link publicado.');
    } catch (e: any) {
      setError(e.message || 'Erro ao publicar o link.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" /> Link de pagamento WeTravel
          </DialogTitle>
          <DialogDescription className="text-xs">
            O nome e email do pagador são recolhidos no checkout WeTravel.
          </DialogDescription>
        </DialogHeader>

        {/* Result */}
        {result?.url && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Link publicado
            </p>
            <p className="text-xs break-all font-mono">{result.url}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => copy(result.url!)}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" className="text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                </Button>
              </a>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Cola este link no campo "Link de pagamento WeTravel" da proposta para ativar o botão Book Now.
            </p>
          </div>
        )}

        {/* Pending publication */}
        {!result && pendingDraft && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Publicação pendente</p>
            <p className="text-[11px] text-muted-foreground">
              {pendingDraft.title} · {(pendingDraft.amount_cents / 100).toFixed(2)} {pendingDraft.currency}
              {pendingDraft.last_error ? ` — ${pendingDraft.last_error}` : ''}
            </p>
            <Button size="sm" className="text-xs" onClick={() => resume(pendingDraft.id)} disabled={busy}>
              {publishLink.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Retomar publicação
            </Button>
          </div>
        )}

        {!result && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Título</Label>
                <span className={cn('text-[10px]', title.length > 70 ? 'text-destructive' : 'text-muted-foreground')}>
                  {title.length}/70
                </span>
              </div>
              <Input value={title} maxLength={70} onChange={e => setTitle(e.target.value)} className="h-9 text-sm" />
            </div>

            <div>
              <Label className="text-xs">Trip ID (referência YT)</Label>
              <Input value={ref} onChange={e => setRef(e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data início</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Data fim</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Montante</Label>
                <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Moeda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['EUR', 'USD', 'GBP'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-2">
              <Label className="text-xs">Data de expiração</Label>
              <Switch checked={useExpiry} onCheckedChange={setUseExpiry} />
            </div>
            {useExpiry && (
              <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="h-9 text-sm" />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Taxas de pagamento pagas por</Label>
                <Select value={paymentFees} onValueChange={v => setPaymentFees(v as any)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {feeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Taxa WeTravel paga por</Label>
                <Select value={wtFees} onValueChange={v => setWtFees(v as any)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {feeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
              <Button size="sm" onClick={submit} disabled={busy}>
                {createLink.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                Gerar link WeTravel
              </Button>
            </div>
          </div>
        )}

        {/* Existing published links */}
        {publishedLinks.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground">Links já criados</p>
            {publishedLinks.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{l.title}</span>
                <span className="font-medium">{(l.amount_cents / 100).toFixed(2)} {l.currency}</span>
                <button onClick={() => copy(l.url!)} className="text-primary hover:underline flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentLinkDialog;
