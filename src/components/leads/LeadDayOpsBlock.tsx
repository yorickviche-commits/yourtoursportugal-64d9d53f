import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

type DayOps = {
  guide_name: string; vehicle: string; vehicle_pickup: string;
  pickup_time: string; pickup_location: string; pickup_maps_url: string;
  dropoff_location: string; dropoff_maps_url: string;
  notes_backoffice: string; notes_guide: string; guide_payment_amount: string;
};
const EMPTY: DayOps = {
  guide_name: '', vehicle: '', vehicle_pickup: '', pickup_time: '', pickup_location: '', pickup_maps_url: '',
  dropoff_location: '', dropoff_maps_url: '', notes_backoffice: '', notes_guide: '', guide_payment_amount: '',
};

/** Bloco recolhível "Dados do dia" — grava automaticamente (lead_day_ops). */
export default function LeadDayOpsBlock({ leadId, dayNumber }: { leadId: string; dayNumber: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DayOps>(EMPTY);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const touched = useRef(false);

  const { data } = useQuery({
    queryKey: ['lead_day_ops', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_day_ops').select('*').eq('lead_id', leadId);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (touched.current) return;
    const r: any = data?.find((d: any) => d.day_number === dayNumber);
    if (!r) return;
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, r[k] == null ? '' : String(r[k])])),
      pickup_time: r.pickup_time ? String(r.pickup_time).slice(0, 5) : '',
    } as DayOps);
  }, [data, dayNumber]);

  useEffect(() => {
    if (!touched.current) return;
    const t = setTimeout(async () => {
      setState('saving');
      const payload: any = { lead_id: leadId, day_number: dayNumber, updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(form)) payload[k] = v.trim() === '' ? null : v.trim();
      payload.pickup_time = /^\d{1,2}:\d{2}$/.test(form.pickup_time) ? form.pickup_time : null;
      payload.guide_payment_amount = form.guide_payment_amount ? Number(form.guide_payment_amount.replace(',', '.')) || null : null;
      const { error } = await supabase.from('lead_day_ops').upsert(payload, { onConflict: 'lead_id,day_number' });
      setState(error ? 'idle' : 'saved');
      if (!error) qc.invalidateQueries({ queryKey: ['lead_day_ops', leadId] });
    }, 800);
    return () => clearTimeout(t);
  }, [form, leadId, dayNumber, qc]);

  const set = (k: keyof DayOps) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    touched.current = true;
    setForm(f => ({ ...f, [k]: e.target.value }));
  };
  const field = (k: keyof DayOps, label: string, ph = '', type = 'text') => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Input type={type} className="h-8 text-xs" value={form[k]} onChange={set(k)} placeholder={ph} />
    </label>
  );

  const summary = [form.guide_name && `Guia: ${form.guide_name}`, form.vehicle && `Carrinha: ${form.vehicle}`, form.pickup_time && `Pick-up ${form.pickup_time}`]
    .filter(Boolean).join(' · ');

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="my-2 rounded border bg-muted/10">
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 text-left min-h-[40px]">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="text-xs font-semibold">Dados do dia</span>
        <span className="text-[10px] text-muted-foreground truncate flex-1">{summary || 'guia, carrinha, pick-up, notas'}</span>
        {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {state === 'saved' && <Check className="h-3 w-3 text-[hsl(var(--success))]" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {field('guide_name', 'Guia')}
          {field('vehicle', 'Carrinha')}
          {field('vehicle_pickup', 'Recolha da carrinha')}
          {field('pickup_time', 'Hora pick-up', '09:00')}
          {field('pickup_location', 'Local pick-up')}
          {field('pickup_maps_url', 'Link Maps pick-up', 'https://maps…')}
          {field('dropoff_location', 'Local drop-off')}
          {field('dropoff_maps_url', 'Link Maps drop-off', 'https://maps…')}
          {field('guide_payment_amount', 'Valor a receber pelo guia (€)', '0,00')}
          <label className="flex flex-col gap-0.5 sm:col-span-3">
            <span className="text-[10px] text-muted-foreground">Notas para backoffice (uma por linha)</span>
            <Textarea className="text-xs min-h-[56px]" value={form.notes_backoffice} onChange={set('notes_backoffice')} />
          </label>
          <label className="flex flex-col gap-0.5 sm:col-span-3">
            <span className="text-[10px] text-muted-foreground">Notas para o guia (uma por linha)</span>
            <Textarea className="text-xs min-h-[56px]" value={form.notes_guide} onChange={set('notes_guide')} />
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
