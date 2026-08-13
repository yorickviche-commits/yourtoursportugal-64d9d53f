import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Copy, ExternalLink, CheckCircle2, Link2, CalendarIcon, ArrowRight, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInCalendarDays, subDays } from 'date-fns';
import {
  usePaymentLinks, useCreatePaymentLink, usePublishPaymentLink, useUpdatePaymentLink,
  type PaymentLink, type ParticipantFees,
} from '@/hooks/usePaymentLinksQuery';
import PaymentPlanDialog, { type PaymentPlanValue } from './PaymentPlanDialog';
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
  /** When set, the dialog edits this (unpublished) link instead of creating one. */
  editLink?: PaymentLink | null;
}

type Payer = 'organizer' | 'participant';

/** Reverse of `toParticipantFees`, to rehydrate the form when editing. */
const fromParticipantFees = (v?: ParticipantFees | null): { paymentFees: Payer; wetravelFee: Payer } => {
  if (v === 'all') return { paymentFees: 'participant', wetravelFee: 'participant' };
  if (v === 'credit_card') return { paymentFees: 'participant', wetravelFee: 'organizer' };
  if (v === 'service') return { paymentFees: 'organizer', wetravelFee: 'participant' };
  return { paymentFees: 'organizer', wetravelFee: 'organizer' };
};

/** WeTravel's two fee questions map onto the single API field. */
const toParticipantFees = (paymentFees: Payer, wetravelFee: Payer): ParticipantFees => {
  if (paymentFees === 'participant' && wetravelFee === 'participant') return 'all';
  if (paymentFees === 'participant' && wetravelFee === 'organizer') return 'credit_card';
  if (paymentFees === 'organizer' && wetravelFee === 'participant') return 'service';
  return 'none';
};

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const pretty = (s?: string | null) => (s ? format(parseISO(s), 'MMM d, yyyy') : '');

const Hint = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-md border bg-muted/40 p-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold">{title}</p>
      <Lightbulb className="h-4 w-4 text-sky-500 shrink-0" />
    </div>
    <p className="text-xs text-muted-foreground mt-1.5">{children}</p>
  </div>
);

const YesNo = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <div className="inline-flex rounded-md border overflow-hidden">
    {[true, false].map(v => (
      <button
        key={String(v)}
        type="button"
        onClick={() => onChange(v)}
        className={cn(
          'h-9 w-14 text-sm transition-colors',
          value === v
            ? v ? 'bg-sky-400 text-white font-semibold' : 'bg-muted font-semibold'
            : 'bg-background hover:bg-muted/60',
        )}
      >
        {v ? 'Yes' : 'No'}
      </button>
    ))}
  </div>
);

const PaymentLinkDialog = ({
  open, onOpenChange, leadId, proposalId = null,
  defaultTitle = '', tripRef = null, defaultAmount = 0,
  defaultStartDate = null, defaultEndDate = null, editLink = null,
}: Props) => {
  const { data: links = [] } = usePaymentLinks(leadId);
  const createLink = useCreatePaymentLink();
  const publishLink = usePublishPaymentLink();
  const updateLink = useUpdatePaymentLink();

  const [title, setTitle] = useState('');
  const [ref, setRef] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');

  const [paymentFees, setPaymentFees] = useState<Payer>('participant');
  const [wetravelFee, setWetravelFee] = useState<Payer>('participant');

  const [usePlan, setUsePlan] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [plan, setPlan] = useState<PaymentPlanValue | null>(null);

  const [useExpiry, setUseExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentLink | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);

    if (editLink) {
      const fees = fromParticipantFees(editLink.participant_fees as ParticipantFees);
      const start = editLink.start_date || '';
      const inst = Array.isArray(editLink.installments) ? (editLink.installments as any[]) : [];
      setTitle((editLink.title || '').slice(0, 70));
      setRef(editLink.trip_ref || '');
      setStartDate(start);
      setEndDate(editLink.end_date || '');
      setAmount((editLink.amount_cents / 100).toFixed(2));
      setCurrency(editLink.currency || 'EUR');
      setPaymentFees(fees.paymentFees);
      setWetravelFee(fees.wetravelFee);
      const hasPlan = (editLink.deposit_cents ?? 0) > 0 || inst.length > 0;
      setUsePlan(hasPlan);
      setPlan(hasPlan && start
        ? {
            deposit: (editLink.deposit_cents ?? 0) / 100,
            // Stored as "days before departure"; converted back into dates.
            payments: inst.map((i: any, idx: number) => ({
              id: `p${idx}`,
              price: Number(i?.price) || 0,
              date: iso(subDays(parseISO(start), Number(i?.days_before_departure) || 0)),
            })),
            autoBilling: !!editLink.allow_auto_payment,
            allowPartial: !!editLink.allow_partial_payment,
            autoAdjust: true,
          }
        : null);
      setUseExpiry(!!editLink.expires_at);
      setExpiresAt(editLink.expires_at ? editLink.expires_at.slice(0, 10) : '');
      return;
    }

    setTitle((defaultTitle || '').slice(0, 70));
    setRef(tripRef || '');
    setStartDate(defaultStartDate || '');
    setEndDate(defaultEndDate || '');
    setAmount(defaultAmount > 0 ? defaultAmount.toFixed(2) : '');
    setCurrency('EUR');
    setPaymentFees('participant');
    setWetravelFee('participant');
    setUsePlan(false);
    setPlan(null);
    setUseExpiry(false);
    setExpiresAt('');
  }, [open, editLink, defaultTitle, tripRef, defaultAmount, defaultStartDate, defaultEndDate]);

  const today = iso(new Date());
  const num = (v: string) => parseFloat((v || '').replace(',', '.'));
  const total = num(amount);

  const pendingDraft = links.find(l => l.status === 'draft' && l.wetravel_uuid);
  const busy = createLink.isPending || publishLink.isPending || updateLink.isPending;

  const range = useMemo(() => ({
    from: startDate ? parseISO(startDate) : undefined,
    to: endDate ? parseISO(endDate) : undefined,
  }), [startDate, endDate]);

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const submit = async () => {
    setError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle) return setError('Indica um título para o link.');
    if (cleanTitle.length > 70) return setError('O título não pode exceder 70 caracteres.');
    if (!startDate || !endDate) return setError('As datas da viagem são obrigatórias na WeTravel.');
    if (endDate < startDate) return setError('A data de fim não pode ser anterior à de início.');
    if (!editLink && startDate < today) return setError(`A data de início (${startDate}) está no passado. Confirma o ano.`);
    if (isNaN(total) || total <= 0) return setError('Indica um montante maior que zero.');
    if (usePlan && (!plan || plan.payments.length === 0)) {
      return setError('Configura o plano de pagamento ou define "Add Deposit / Payment Plan" como No.');
    }
    if (useExpiry && !expiresAt) return setError('Indica a data de expiração ou define "Add Expiration Date" como No.');

    // Payment plan dates → days before departure (contrato da API mantém-se)
    const start = parseISO(startDate);
    const installments = usePlan && plan
      ? plan.payments.map(p => ({
          price: p.price,
          days_before_departure: Math.max(0, differenceInCalendarDays(start, parseISO(p.date))),
        }))
      : [];

    const payload = {
        lead_id: leadId,
        proposal_id: proposalId,
        title: cleanTitle,
        trip_ref: ref.trim() || null,
        start_date: startDate,
        end_date: endDate,
        amount_cents: Math.round(total * 100),
        currency,
        expires_at: useExpiry && expiresAt ? expiresAt : null,
        participant_fees: toParticipantFees(paymentFees, wetravelFee),
        days_before_departure: installments.length ? installments[0].days_before_departure : 0,
        deposit_cents: usePlan && plan ? Math.round(plan.deposit * 100) : null,
        installments,
        allow_auto_payment: usePlan && plan ? plan.autoBilling : false,
        allow_partial_payment: usePlan && plan ? plan.allowPartial : false,
    };

    try {
      if (editLink) {
        await updateLink.mutateAsync({ ...payload, payment_link_id: editLink.id });
        toast.success('Link atualizado.');
        onOpenChange(false);
        return;
      }
      const link = await createLink.mutateAsync(payload);
      setResult(link);
      toast.success('Link de pagamento criado e publicado.');
    } catch (e: any) {
      setError(e.message || (editLink ? 'Erro ao atualizar o link.' : 'Erro ao criar o link de pagamento.'));
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

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" /> {editLink ? 'Editar link de pagamento' : 'Link de pagamento WeTravel'}
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
              Ativa o link na lista de links da lead para mostrar o botão Book Now no PDF e no itinerário digital.
            </p>
          </div>
        )}

        {/* Pending publication */}
        {!result && !editLink && pendingDraft && (
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
          <div className="grid gap-6 md:grid-cols-[1fr_260px]">
            {/* ── Form (WeTravel layout) ── */}
            <div className="space-y-4">
              <Row label="Title">
                <div className="relative">
                  <Input
                    value={title}
                    maxLength={70}
                    onChange={e => setTitle(e.target.value)}
                    className="h-10 pr-12"
                  />
                  <span className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 text-xs',
                    title.length > 70 ? 'text-destructive' : 'text-muted-foreground',
                  )}>
                    {70 - title.length}
                  </span>
                </div>
              </Row>

              <Row label="Trip ID">
                <div className="relative">
                  <Input value={ref} maxLength={64} onChange={e => setRef(e.target.value)} className="h-10 pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {64 - ref.length}
                  </span>
                </div>
              </Row>

              <Row label="Trip Dates">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-10">
                      <span className="flex items-center gap-2">
                        <span className={cn(!startDate && 'text-muted-foreground')}>
                          {pretty(startDate) || 'Start date'}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={cn(!endDate && 'text-muted-foreground')}>
                          {pretty(endDate) || 'End date'}
                        </span>
                      </span>
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={range as any}
                      defaultMonth={range.from}
                      onSelect={(r: any) => {
                        setStartDate(r?.from ? iso(r.from) : '');
                        setEndDate(r?.to ? iso(r.to) : r?.from ? iso(r.from) : '');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </Row>

              <div className="border-t pt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1.5">Amount</p>
                  <div className="flex gap-2">
                    <Input
                      value={amount}
                      inputMode="decimal"
                      onChange={e => setAmount(e.target.value)}
                      className="h-10 w-40"
                    />
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-10 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['EUR', 'USD', 'GBP'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1.5">Add Deposit / Payment Plan</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <YesNo
                      value={usePlan}
                      onChange={v => {
                        setUsePlan(v);
                        if (v) setPlanOpen(true);
                      }}
                    />
                    {usePlan && (
                      <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setPlanOpen(true)}>
                        {plan
                          ? `Deposit ${plan.deposit.toFixed(2)} + ${plan.payments.length} payments · edit`
                          : 'Configure plan'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium mb-1.5">Add Expiration Date</p>
                    <YesNo value={useExpiry} onChange={setUseExpiry} />
                  </div>
                  {useExpiry && (
                    <div>
                      <p className="text-sm font-medium mb-1.5">Active until</p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-normal h-10">
                            <span className={cn(!expiresAt && 'text-muted-foreground')}>
                              {pretty(expiresAt) || 'Select a date'}
                            </span>
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={expiresAt ? parseISO(expiresAt) : undefined}
                            onSelect={d => d && setExpiresAt(iso(d))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-semibold">Who pays the fees?</p>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Payment fees (when applicable) are paid by:
                  </p>
                  <RadioGroup
                    value={paymentFees}
                    onValueChange={v => setPaymentFees(v as Payer)}
                    className="flex items-center gap-6"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="organizer" /> Organizer
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="participant" /> Participant
                    </label>
                  </RadioGroup>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">WeTravel fee is paid by:</p>
                  <RadioGroup
                    value={wetravelFee}
                    onValueChange={v => setWetravelFee(v as Payer)}
                    className="flex items-center gap-6"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="organizer" /> Organizer
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="participant" /> Participant
                    </label>
                  </RadioGroup>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center gap-4 pt-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-10"
                  onClick={submit}
                  disabled={busy}
                >
                  {busy
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Link2 className="h-4 w-4 mr-2" />}
                  {editLink ? 'Guardar alterações' : 'Publish'}
                </Button>
                {!editLink && (
                  <span className="text-xs text-muted-foreground">
                    {createLink.isPending ? 'Saving as draft…' : 'Saved as draft'}
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
                  Cancelar
                </Button>
              </div>
            </div>

            {/* ── Hints (like WeTravel) ── */}
            <div className="space-y-3">
              <Hint title="Add Payment Plan">
                Add a deposit and/or payment plan for this trip. If you want a payment plan without a
                deposit, set the deposit to zero.
              </Hint>
              <Hint title="Expiration Date">
                Set an expiration date for this payment link.
              </Hint>
              <Hint title="Fees">
                Participant pays all fees by default — switch to Organizer to absorb them in the price.
              </Hint>
            </div>
          </div>
        )}

        <PaymentPlanDialog
          open={planOpen}
          onOpenChange={o => {
            setPlanOpen(o);
            if (!o && !plan) setUsePlan(false);
          }}
          total={isNaN(total) ? 0 : total}
          currency={currency}
          departure={startDate || null}
          value={plan}
          onSave={setPlan}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PaymentLinkDialog;
