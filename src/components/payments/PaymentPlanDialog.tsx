import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

export interface PlanPayment {
  /** YYYY-MM-DD */
  date: string;
  price: number;
}

export interface PaymentPlanValue {
  deposit: number;
  payments: PlanPayment[];
  allowPartial: boolean;
  autoBilling: boolean;
  autoAdjust: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  currency: string;
  /** trip start date YYYY-MM-DD — payments must be before departure */
  departure?: string | null;
  value: PaymentPlanValue | null;
  onSave: (v: PaymentPlanValue) => void;
}

const ord = (i: number, count: number) => {
  if (i === count - 1) return 'Final Payment';
  const n = i + 1;
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} Payment`;
};

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

const PaymentPlanDialog = ({ open, onOpenChange, total, currency, departure, value, onSave }: Props) => {
  const [count, setCount] = useState(2);
  const [deposit, setDeposit] = useState('0');
  const [rows, setRows] = useState<{ date: string; price: string }[]>([]);
  const [allowPartial, setAllowPartial] = useState(false);
  const [autoBilling, setAutoBilling] = useState(false);
  const [autoAdjust, setAutoAdjust] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildRows = (n: number, depositValue: number) => {
    const base = departure ? parseISO(departure) : addDays(new Date(), 90);
    const remaining = Math.max(0, total - depositValue);
    const each = n > 0 ? Math.round((remaining / n) * 100) / 100 : 0;
    return Array.from({ length: n }, (_, i) => {
      // spread payments backwards from 30 days before departure
      const offset = -(30 + (n - 1 - i) * 30);
      const price = i === n - 1
        ? Math.round((remaining - each * (n - 1)) * 100) / 100
        : each;
      return { date: iso(addDays(base, offset)), price: price > 0 ? price.toFixed(2) : '' };
    });
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (value && value.payments.length) {
      setCount(value.payments.length);
      setDeposit(value.deposit ? value.deposit.toFixed(2) : '0');
      setRows(value.payments.map(p => ({ date: p.date, price: p.price.toFixed(2) })));
      setAllowPartial(value.allowPartial);
      setAutoBilling(value.autoBilling);
      setAutoAdjust(value.autoAdjust);
    } else {
      setCount(2);
      setDeposit('0');
      setRows(buildRows(2, 0));
      setAllowPartial(false);
      setAutoBilling(false);
      setAutoAdjust(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const num = (v: string) => parseFloat((v || '').replace(',', '.')) || 0;
  const depositValue = num(deposit);
  const sum = useMemo(
    () => rows.reduce((a, r) => a + num(r.price), depositValue),
    [rows, depositValue],
  );
  const balanced = Math.abs(sum - total) <= 0.01;

  const pickCount = (n: number) => {
    setCount(n);
    setRows(buildRows(n, depositValue));
  };

  const changeDeposit = (v: string) => {
    setDeposit(v);
    setRows(buildRows(count, num(v)));
  };

  const save = () => {
    if (depositValue < 0 || depositValue > total) return setError('Deposit must be between 0 and the total.');
    if (!rows.length) return setError('Add at least one payment.');
    for (const r of rows) {
      if (num(r.price) < 1) return setError('Each payment must be at least 1.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return setError('Every payment needs a valid date.');
      if (departure && r.date >= departure) return setError('Payment dates must be before the trip start date.');
    }
    if (!balanced) return setError(`Deposit + payments (${sum.toFixed(2)}) must match the total (${total.toFixed(2)}).`);
    onSave({
      deposit: depositValue,
      payments: rows.map(r => ({ date: r.date, price: num(r.price) })),
      allowPartial,
      autoBilling,
      autoAdjust,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Add Payment Plan</DialogTitle>
        </DialogHeader>

        <a
          href="https://help.wetravel.com/hc/en-us/articles/360048150713"
          target="_blank" rel="noopener noreferrer"
          className="text-sm text-sky-600 hover:underline"
        >
          Learn how payment plans work
        </a>

        <div className="space-y-2">
          <h3 className="text-base font-semibold">Number of payments</h3>
          <div className="flex items-start gap-4">
            <span className="text-sm text-muted-foreground pt-2 w-28 shrink-0">Deposit plus</span>
            <div className="grid grid-cols-6 gap-0 border rounded-md overflow-hidden flex-1">
              {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickCount(n)}
                  className={cn(
                    'h-9 text-sm border-r border-b last:border-r-0 transition-colors',
                    count === n ? 'bg-sky-400 text-white font-semibold' : 'bg-background hover:bg-muted',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold">Payment dates</h3>

          <div className="flex items-center gap-4 py-3 border-b">
            <span className="text-sm font-medium w-28 shrink-0">Deposit</span>
            <span className="flex-1 text-sm text-muted-foreground">Due at booking</span>
            <div className="relative w-44">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£'}
              </span>
              <Input
                value={deposit}
                inputMode="decimal"
                onChange={e => changeDeposit(e.target.value)}
                className="pl-7 h-10"
              />
            </div>
          </div>

          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-4 py-3 border-b">
              <span className="text-sm font-medium w-28 shrink-0">{ord(idx, rows.length)}</span>
              <div className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-10">
                      {r.date ? format(parseISO(r.date), 'MMM d, yyyy') : 'Select a date'}
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={r.date ? parseISO(r.date) : undefined}
                      defaultMonth={r.date ? parseISO(r.date) : undefined}
                      onSelect={d => d && setRows(p => p.map((x, i) => i === idx ? { ...x, date: iso(d) } : x))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="relative w-44">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£'}
                </span>
                <Input
                  value={r.price}
                  inputMode="decimal"
                  onChange={e => setRows(p => p.map((x, i) => i === idx ? { ...x, price: e.target.value } : x))}
                  className="pl-7 h-10"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allowPartial} onCheckedChange={v => setAllowPartial(!!v)} />
              Allow partial payment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={autoBilling} onCheckedChange={v => setAutoBilling(!!v)} />
              Enable auto-billing
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={autoAdjust} onCheckedChange={v => setAutoAdjust(!!v)} className="mt-0.5" />
              <span>
                Auto-adjust payment plan for late bookings
                <span className="block text-xs text-muted-foreground max-w-md">
                  If a traveler books after a payment date has passed, the missed amounts are spread
                  across the remaining payments.
                </span>
              </span>
            </label>
          </div>
          <div className={cn('text-sm shrink-0', balanced ? 'text-foreground' : 'text-destructive')}>
            <span className="font-semibold">Total: </span>
            <span className="font-bold">{sum.toFixed(2)} {currency}</span>
            {!balanced && <p className="text-xs">must equal {total.toFixed(2)}</p>}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={save}>Save Plan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentPlanDialog;
