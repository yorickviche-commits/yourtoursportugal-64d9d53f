import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, ExternalLink, CheckCircle2, Link2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePaymentLinks, useCreatePaymentLink, usePublishPaymentLink, type PaymentLink, type ParticipantFees } from '@/hooks/usePaymentLinksQuery';
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

const feeOptions: { value: ParticipantFees; label: string }[] = [
  { value: 'all', label: 'Participante paga todas as taxas' },
  { value: 'service', label: 'Participante paga taxa de serviço' },
  { value: 'credit_card', label: 'Participante paga só taxa de cartão' },
  { value: 'none', label: 'Organizador paga todas as taxas' },
];

interface InstallmentRow { price: string; days: string }

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
  const [fees, setFees] = useState<ParticipantFees>('all');
  const [deadlineDays, setDeadlineDays] = useState('0');

  // Deposit / payment plan
  const [usePlan, setUsePlan] = useState(false);
  const [deposit, setDeposit] = useState('');
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [autoPay, setAutoPay] = useState(false);
  const [partialPay, setPartialPay] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentLink | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle((defaultTitle || '').slice(0, 70));
    setRef(tripRef || '');
    setStartDate(defaultStartDate || '');
    setEndDate(defaultEndDate || '');
    setAmount(defaultAmount > 0 ? defaultAmount.toFixed(2) : '');
    setFees('all');
    setDeadlineDays('0');
    setUsePlan(false);
    setDeposit('');
    setInstallments([]);
    setAutoPay(false);
    setPartialPay(false);
    setError(null);
    setResult(null);
  }, [open, defaultTitle, tripRef, defaultAmount, defaultStartDate, defaultEndDate]);

  const today = new Date().toISOString().slice(0, 10);
  const num = (v: string) => parseFloat((v || '').replace(',', '.'));
  const total = num(amount);
  const depositValue = num(deposit) || 0;
  const planSum = useMemo(
    () => installments.reduce((a, i) => a + (num(i.price) || 0), depositValue),
    [installments, depositValue],
  );
  const planBalanced = !usePlan || Math.abs(planSum - (total || 0)) <= 0.01;

  const pendingDraft = links.find(l => l.status === 'draft' && l.wetravel_uuid);
  const busy = createLink.isPending || publishLink.isPending;

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const addInstallment = () => {
    const remaining = Math.max(0, (total || 0) - planSum);
    setInstallments(prev => [...prev, { price: remaining ? remaining.toFixed(2) : '', days: '30' }]);
  };

  const submit = async () => {
    setError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle) return setError('Indica um título para o link.');
    if (cleanTitle.length > 70) return setError('O título não pode exceder 70 caracteres.');
    if (!startDate || !endDate) return setError('As datas de início e fim são obrigatórias na WeTravel.');
    if (endDate < startDate) return setError('A data de fim não pode ser anterior à de início.');
    if (isNaN(total) || total <= 0) return setError('Indica um montante maior que zero.');
    if (usePlan) {
      if (depositValue < 0 || depositValue > total) return setError('O depósito tem de estar entre 0 e o total.');
      if (installments.length === 0) return setError('Adiciona pelo menos uma prestação ou desliga o plano de pagamento.');
      if (installments.length > 18) return setError('Máximo de 18 prestações.');
      for (const i of installments) {
        if (!(num(i.price) >= 1)) return setError('Cada prestação tem de ser >= 1.');
        if (!(parseInt(i.days) >= 0)) return setError('Indica os dias antes da partida de cada prestação.');
      }
      if (!planBalanced) return setError(`Depósito + prestações (${planSum.toFixed(2)}) tem de igualar o total (${total.toFixed(2)}).`);
    }

    try {
      const link = await createLink.mutateAsync({
        lead_id: leadId,
        proposal_id: proposalId,
        title: cleanTitle,
        trip_ref: ref.trim() || null,
        start_date: startDate,
        end_date: endDate,
        amount_cents: Math.round(total * 100),
        currency,
        participant_fees: fees,
        days_before_departure: parseInt(deadlineDays) || 0,
        deposit_cents: usePlan ? Math.round(depositValue * 100) : null,
        installments: usePlan
          ? installments.map(i => ({ price: num(i.price), days_before_departure: parseInt(i.days) || 0 }))
          : [],
        allow_auto_payment: usePlan ? autoPay : false,
        allow_partial_payment: usePlan ? partialPay : false,
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
                <Label className="text-xs">Data início *</Label>
                <Input type="date" min={today} value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Data fim *</Label>
                <Input type="date" min={startDate || today} value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />

              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Montante total</Label>
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

            {/* Deposit / payment plan */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Depósito / plano de pagamento</Label>
                  <p className="text-[10px] text-muted-foreground">Depósito na reserva + prestações até à partida.</p>
                </div>
                <Switch checked={usePlan} onCheckedChange={setUsePlan} />
              </div>

              {usePlan && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Depósito (na reserva)</Label>
                      <Input type="text" inputMode="decimal" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0.00" className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Prazo de reserva (dias antes)</Label>
                      <Input type="number" min={0} value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {installments.map((inst, idx) => (
                      <div key={idx} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-[10px]">{idx === installments.length - 1 ? 'Pagamento final' : `${idx + 1}º pagamento`}</Label>
                          <Input type="text" inputMode="decimal" value={inst.price}
                            onChange={e => setInstallments(p => p.map((r, i) => i === idx ? { ...r, price: e.target.value } : r))}
                            className="h-9 text-sm" />
                        </div>
                        <div className="w-28">
                          <Label className="text-[10px]">Dias antes</Label>
                          <Input type="number" min={0} value={inst.days}
                            onChange={e => setInstallments(p => p.map((r, i) => i === idx ? { ...r, days: e.target.value } : r))}
                            className="h-9 text-sm" />
                        </div>
                        <Button variant="ghost" size="sm" className="h-9 px-2 text-destructive"
                          onClick={() => setInstallments(p => p.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={addInstallment} disabled={installments.length >= 18}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar prestação
                    </Button>
                  </div>

                  <div className={cn('text-[11px] font-medium', planBalanced ? 'text-muted-foreground' : 'text-destructive')}>
                    Depósito + prestações: {planSum.toFixed(2)} {currency} / total {(total || 0).toFixed(2)} {currency}
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Débito automático nas datas devidas</Label>
                    <Switch checked={autoPay} onCheckedChange={setAutoPay} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Permitir pagamentos parciais</Label>
                    <Switch checked={partialPay} onCheckedChange={setPartialPay} />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Quem paga as taxas?</Label>
              <Select value={fees} onValueChange={v => setFees(v as ParticipantFees)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {feeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
              <Button size="sm" onClick={submit} disabled={busy}>
                {createLink.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1" />}
                Criar e publicar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentLinkDialog;
