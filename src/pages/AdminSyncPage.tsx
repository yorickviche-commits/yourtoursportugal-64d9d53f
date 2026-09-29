import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Loader2, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const sb = supabase as any;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-PT') : '—');

async function call(fn: 'calendar-migrate' | 'calendar-reconcile', body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { msg = (await error.context.json())?.error || msg; } catch { /* ignore */ }
    }
    throw new Error(msg);
  }
  if ((data as any)?.ok === false) throw new Error((data as any).error || 'Falhou');
  return data as any;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {count != null && <Badge variant={count ? 'destructive' : 'secondary'}>{count}</Badge>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const Empty = () => <p className="text-xs text-muted-foreground">Nada a rever.</p>;

/* ============================== SAÚDE ============================== */
function HealthTab() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [linkInput, setLinkInput] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['sync_health'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [pull, worker, run, queue, events, conflicts] = await Promise.all([
        sb.from('nethunt_sync_log').select('created_at').eq('direction', 'pull').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('sync_queue').select('updated_at').eq('status', 'done').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('sync_reconcile_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('sync_queue').select('*').in('status', ['pending', 'processing', 'failed']).order('updated_at', { ascending: false }).limit(100),
        sb.from('calendar_events').select('*, leads(client_name, yt_id, lead_code)').in('protection_status', ['manual_edit', 'orphan']).order('day_date'),
        sb.from('nethunt_conflicts').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      return {
        lastPull: pull.data?.created_at, lastWorker: worker.data?.updated_at, run: run.data,
        queue: queue.data || [], events: events.data || [], conflicts: conflicts.data || [],
      };
    },
  });

  const act = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ['sync_health'] }); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const openSnapshot = async (ev: any) => {
    const { data } = await sb.from('calendar_event_snapshots').select('*').eq('lead_id', ev.lead_id).eq('day_date', ev.day_date).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setSnapshot(data || { summary: 'Sem snapshot guardado' });
  };

  if (isLoading || !data) return <Loader2 className="h-5 w-5 animate-spin" />;
  const report = data.run?.report || {};
  const failed = data.queue.filter((q: any) => q.status === 'failed');
  const pending = data.queue.filter((q: any) => q.status !== 'failed');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Último pull NetHunt</div><div className="text-sm font-medium">{fmt(data.lastPull)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Último item processado (worker)</div><div className="text-sm font-medium">{fmt(data.lastWorker)}</div></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Última verificação diária</div>
            <div className="text-sm font-medium">{fmt(data.run?.finished_at || data.run?.started_at)}</div>
            {data.run?.error && <div className="text-[10px] text-destructive">{data.run.error}</div>}
          </div>
          <Button size="sm" variant="outline" disabled={busy === 'rec'} onClick={() => act('rec', () => call('calendar-reconcile', { action: 'reconcile' }), 'Verificação concluída')}>
            {busy === 'rec' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}<span className="ml-1">Correr agora</span>
          </Button>
        </CardContent></Card>
      </div>

      <Section title="Fila com falhas" count={failed.length}>
        {!failed.length ? <Empty /> : failed.map((q: any) => (
          <div key={q.id} className="flex items-start gap-2 text-xs border-t pt-2">
            <Badge variant="outline">{q.target}</Badge>
            <div className="flex-1 min-w-0">
              {q.entity === 'lead' ? <Link className="underline" to={`/leads/${q.entity_id}`}>{q.entity_id.slice(0, 8)}</Link> : <span>{q.entity} {q.entity_id.slice(0, 8)}</span>}
              <div className="text-destructive break-words">{q.last_error}</div>
              <div className="text-muted-foreground">{q.attempts} tentativa(s) · {fmt(q.updated_at)}</div>
            </div>
            <Button size="sm" variant="outline" disabled={busy === `q${q.id}`} onClick={() => act(`q${q.id}`, () => call('calendar-reconcile', { action: 'requeue', id: q.id }), 'Voltou à fila')}>Reprocessar</Button>
          </div>
        ))}
        {pending.length > 0 && <p className="text-[10px] text-muted-foreground">{pending.length} item(ns) pendente(s)/a processar.</p>}
      </Section>

      <Section title="Eventos editados à mão / órfãos" count={data.events.length}>
        {!data.events.length ? <Empty /> : data.events.map((e: any) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 text-xs border-t pt-2">
            <Badge variant={e.protection_status === 'orphan' ? 'secondary' : 'destructive'}>{e.protection_status === 'orphan' ? 'órfão' : 'manual'}</Badge>
            <span>{e.day_date}</span>
            <Link className="underline" to={`/leads/${e.lead_id}`}>{e.leads?.yt_id || e.leads?.lead_code} {e.leads?.client_name}</Link>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => openSnapshot(e)}>Snapshot</Button>
          </div>
        ))}
      </Section>

      <Section title="Eventos do TCC sem ligação" count={(report.unmapped_tagged || []).length}>
        {!(report.unmapped_tagged || []).length ? <Empty /> : report.unmapped_tagged.map((e: any) => (
          <div key={e.event_id} className="text-xs border-t pt-2">{e.day_date} · {e.summary} {e.gcal && <a className="underline" href={e.gcal} target="_blank" rel="noreferrer">evento</a>}</div>
        ))}
      </Section>

      <Section title="Conflitos NetHunt" count={data.conflicts.length}>
        {!data.conflicts.length ? <Empty /> : data.conflicts.map((c: any) => (
          <div key={c.id} className="text-xs border-t pt-2 break-words">
            <Link className="underline" to={`/leads/${c.entity_id}`}>{c.field}</Link> · TCC: {JSON.stringify(c.tcc_value)} · NetHunt: {JSON.stringify(c.nethunt_value)} · vence <b>{c.winner}</b> · {fmt(c.created_at)}
          </div>
        ))}
      </Section>

      <Section title="Deals por ligar" count={(report.deals_unlinked || []).length}>
        {!(report.deals_unlinked || []).length ? <Empty /> : report.deals_unlinked.map((d: any) => (
          <div key={d.record_id} className="flex flex-wrap items-center gap-2 text-xs border-t pt-2">
            <a className="underline" href={d.link} target="_blank" rel="noreferrer">{d.yt_id || d.record_id}</a>
            <Input className="h-7 w-32 text-xs" placeholder="YT#### da lead" value={linkInput[d.record_id] || ''} onChange={e => setLinkInput(s => ({ ...s, [d.record_id]: e.target.value }))} />
            <Button size="sm" variant="outline" disabled={busy === `l${d.record_id}`} onClick={() => act(`l${d.record_id}`, async () => {
              const code = (linkInput[d.record_id] || '').trim();
              const { data: lead } = await sb.from('leads').select('id').or(`yt_id.eq.${code},lead_code.eq.${code}`).maybeSingle();
              if (!lead) throw new Error('Lead não encontrada');
              await call('calendar-reconcile', { action: 'link_deal', record_id: d.record_id, lead_id: lead.id });
            }, 'Deal ligado')}>Ligar a lead existente</Button>
            <Button size="sm" variant="outline" disabled={busy === `c${d.record_id}`} onClick={() => act(`c${d.record_id}`, () => call('calendar-reconcile', { action: 'create_lead_from_deal', record_id: d.record_id }), 'Lead criada')}>Criar lead</Button>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground">Lista da última verificação diária.</p>
      </Section>

      <Section title="Leads sem file NetHunt (30 dias)" count={(report.leads_without_nethunt || []).length}>
        {!(report.leads_without_nethunt || []).length ? <Empty /> : report.leads_without_nethunt.map((l: any) => (
          <div key={l.id} className="flex items-center gap-2 text-xs border-t pt-2">
            <Link className="underline flex-1" to={`/leads/${l.id}`}>{l.yt_id || l.lead_code} {l.client_name}</Link>
            <Button size="sm" variant="outline" disabled={busy === `n${l.id}`} onClick={() => act(`n${l.id}`, async () => {
              const { data, error } = await supabase.functions.invoke('nethunt-push', { body: { entity: 'lead_create_deal', id: l.id } });
              if (error || (data as any)?.ok === false) throw new Error((data as any)?.error || error?.message || 'Falhou');
            }, 'File criado no NetHunt')}>Criar file no NetHunt</Button>
          </div>
        ))}
      </Section>

      <Dialog open={!!snapshot} onOpenChange={o => !o && setSnapshot(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Snapshot do evento</DialogTitle></DialogHeader>
          {snapshot && (
            <div className="space-y-2 text-xs">
              <div className="text-muted-foreground">{fmt(snapshot.created_at)} · {snapshot.reason}</div>
              <div className="font-semibold">{snapshot.summary}</div>
              <div className="whitespace-pre-wrap break-words">{String(snapshot.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================== MIGRAÇÃO ============================== */
const DAY_FIELDS: [string, string][] = [
  ['guide_name', 'Guia'], ['vehicle', 'Carrinha'], ['vehicle_pickup', 'Recolha'], ['pickup_time', 'Hora pick-up'],
  ['pickup_location', 'Local pick-up'], ['pickup_maps_url', 'Maps pick-up'], ['dropoff_location', 'Local drop-off'],
  ['dropoff_maps_url', 'Maps drop-off'], ['guide_payment_amount', 'Valor guia (€)'],
];
const GEN_FIELDS: [string, string][] = [['service_language', 'Idioma'], ['booking_origin', 'Origem da reserva'], ['external_booking_ref', 'Nº reserva externa']];

function ReviewPanel({ item, onDone }: { item: any; onDone: () => void }) {
  const [fields, setFields] = useState<any>(item.extracted || null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try { await fn(); } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const setIn = (group: string, key: string, v: string) => setFields((f: any) => ({ ...f, [group]: { ...(f?.[group] || {}), [key]: v } }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 border-t pt-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground mb-1">Texto atual</div>
        <div className="text-xs font-semibold mb-1 break-words">{item.summary}</div>
        <div className="text-xs whitespace-pre-wrap break-words max-h-[420px] overflow-y-auto bg-muted/30 rounded p-2">
          {String(item.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase text-muted-foreground">Campos propostos</div>
          <Button size="sm" variant="outline" disabled={busy === 'x'} onClick={() => run('x', async () => { const r = await call('calendar-migrate', { action: 'extract', event_id: item.google_event_id }); setFields(r.extracted); })}>
            {busy === 'x' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Extrair dados (IA)
          </Button>
        </div>
        {!fields ? <p className="text-xs text-muted-foreground">Carregue em "Extrair dados" (usa créditos de IA, um evento de cada vez).</p> : (
          <>
            {GEN_FIELDS.map(([k, l]) => (
              <label key={k} className="block"><span className="text-[10px] text-muted-foreground">{l}</span>
                <Input className="h-7 text-xs" value={fields.general?.[k] ?? ''} onChange={e => setIn('general', k, e.target.value)} /></label>
            ))}
            <div className="grid grid-cols-2 gap-1">
              {DAY_FIELDS.map(([k, l]) => (
                <label key={k} className="block"><span className="text-[10px] text-muted-foreground">{l}</span>
                  <Input className="h-7 text-xs" value={fields.day_ops?.[k] ?? ''} onChange={e => setIn('day_ops', k, e.target.value)} /></label>
              ))}
            </div>
            {(['notes_backoffice', 'notes_guide'] as const).map(k => (
              <label key={k} className="block"><span className="text-[10px] text-muted-foreground">{k === 'notes_backoffice' ? 'Notas backoffice' : 'Notas guia'}</span>
                <Textarea className="text-xs min-h-[48px]" value={fields.day_ops?.[k] ?? ''} onChange={e => setIn('day_ops', k, e.target.value)} /></label>
            ))}
            <label className="block"><span className="text-[10px] text-muted-foreground">Serviços (JSON: title, supplier, schedule_time, schedule_end_time, booking_status, payment_status, invoice_status, confirmation_number, notes, item_key)</span>
              <Textarea className="text-[11px] font-mono min-h-[140px]" defaultValue={JSON.stringify(fields.services || [], null, 1)}
                onBlur={e => { try { setFields((f: any) => ({ ...f, services: JSON.parse(e.target.value) })); } catch { toast.error('JSON de serviços inválido'); } }} />
            </label>
          </>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase text-muted-foreground">Pré-visualização (dados atuais do TCC)</div>
          <Button size="sm" variant="ghost" disabled={busy === 'p' || !item.lead_id} onClick={() => run('p', async () => { const r = await call('calendar-migrate', { action: 'preview', event_id: item.google_event_id }); setPreview(r.event); })}>Atualizar</Button>
        </div>
        {preview ? (
          <div className="border rounded p-2 space-y-1">
            <div className="text-xs font-semibold break-words">{preview.title}</div>
            <div className="text-[11px] break-words [&_a]:underline" dangerouslySetInnerHTML={{ __html: preview.description }} />
          </div>
        ) : <p className="text-xs text-muted-foreground">{item.lead_id ? 'Sem pré-visualização ainda.' : 'Ligue primeiro a uma lead.'}</p>}
        <div className="flex gap-2 pt-2">
          <Button size="sm" disabled={!fields || !item.lead_id || busy === 'a'} onClick={() => run('a', async () => {
            if (!window.confirm('Gravar estes campos no TCC e reescrever este evento no formato YT? (é guardado um snapshot do original)')) return;
            await call('calendar-migrate', { action: 'approve', event_id: item.google_event_id, fields });
            toast.success('Evento reescrito no formato YT'); onDone();
          })}>{busy === 'a' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Aprovar</Button>
          <Button size="sm" variant="outline" onClick={() => run('s', async () => { await call('calendar-migrate', { action: 'skip', event_id: item.google_event_id }); onDone(); })}>Saltar</Button>
        </div>
      </div>
    </div>
  );
}

function MigrationTab() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'linked' | 'no_lead' | 'not_booking'>('linked');
  const [showDone, setShowDone] = useState(false);

  const info = useQuery({ queryKey: ['calendar_migrate_info'], queryFn: () => call('calendar-migrate', { action: 'info' }), staleTime: 60_000 });
  const items = useQuery({
    queryKey: ['calendar_migration_items'],
    queryFn: async () => {
      const { data, error } = await sb.from('calendar_migration_items')
        .select('google_event_id, calendar_id, day_date, summary, description, html_link, yt_ref, lead_id, classification, status, extracted')
        .order('day_date');
      if (error) throw error;
      return data || [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['calendar_migration_items'] });
  const act = async (k: string, fn: () => Promise<any>, ok: string) => {
    setBusy(k);
    try { await fn(); toast.success(ok); refresh(); } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const all = items.data || [];
  const list = all.filter((i: any) => i.classification === filter && (showDone || ['pending', 'linked'].includes(i.status)));
  const count = (c: string) => all.filter((i: any) => i.classification === c && ['pending', 'linked'].includes(i.status)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy === 'scan'} onClick={() => act('scan', async () => {
          const r = await call('calendar-migrate', { action: 'scan' });
          toast.message(`${r.total} eventos lidos · ${r.skipped_already_mapped} já ligados ao TCC`);
        }, 'Análise concluída')}>{busy === 'scan' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}Analisar calendário (de hoje em diante)</Button>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> mostrar tratados</label>
      </div>
      {info.data && !info.data.manual_calendar && (
        <div className="flex items-center gap-2 text-xs rounded border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2">
          <AlertTriangle className="h-3.5 w-3.5" /> O calendário "Reservas YT – Manual" ainda não existe — crie-o no Google para poder mover eventos que não são reservas.
        </div>
      )}
      <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="linked">Ligados a lead ({count('linked')})</TabsTrigger>
          <TabsTrigger value="no_lead">Reserva sem lead ({count('no_lead')})</TabsTrigger>
          <TabsTrigger value="not_booking">Não é reserva ({count('not_booking')})</TabsTrigger>
        </TabsList>
      </Tabs>
      {items.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !list.length ? <p className="text-xs text-muted-foreground">Nada nesta lista. Carregue em "Analisar calendário".</p> : list.map((i: any) => (
        <Card key={i.google_event_id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{i.day_date}</span>
              <span className="flex-1 min-w-[160px] break-words">{i.summary}</span>
              {i.yt_ref && <Badge variant="outline">{i.yt_ref}</Badge>}
              <Badge variant="secondary">{i.status}</Badge>
              {i.html_link && <a href={i.html_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline"><ExternalLink className="h-3 w-3" />Google</a>}
              {i.lead_id && <Link className="underline" to={`/leads/${i.lead_id}`}>lead</Link>}
            </div>
            <div className="flex flex-wrap gap-2">
              {i.classification === 'linked' && i.status === 'pending' && (
                <Button size="sm" disabled={busy === `l${i.google_event_id}`} onClick={() => act(`l${i.google_event_id}`, () => call('calendar-migrate', { action: 'link', event_id: i.google_event_id }), 'Evento ligado (protegido até aprovar)')}>Ligar</Button>
              )}
              {i.classification === 'no_lead' && !i.lead_id && (
                <Button size="sm" disabled={busy === `c${i.google_event_id}`} onClick={() => act(`c${i.google_event_id}`, () => call('calendar-migrate', { action: 'create_lead', event_id: i.google_event_id, fields: i.extracted }), 'Lead criada e evento ligado')}>Criar lead no TCC</Button>
              )}
              {i.classification === 'not_booking' && i.status === 'pending' && (info.data?.manual_calendar
                ? <Button size="sm" variant="outline" disabled={busy === `m${i.google_event_id}`} onClick={() => act(`m${i.google_event_id}`, () => call('calendar-migrate', { action: 'move', event_id: i.google_event_id }), 'Evento movido')}>Mover para Reservas YT – Manual</Button>
                : <span className="text-[10px] text-muted-foreground">Mover indisponível (calendário manual em falta)</span>)}
              {i.classification !== 'not_booking' && (
                <Button size="sm" variant="ghost" onClick={() => setOpen(open === i.google_event_id ? null : i.google_event_id)}>{open === i.google_event_id ? 'Fechar' : 'Rever / extrair'}</Button>
              )}
              {i.status === 'pending' && (
                <Button size="sm" variant="ghost" onClick={() => act(`s${i.google_event_id}`, () => call('calendar-migrate', { action: 'skip', event_id: i.google_event_id }), 'Saltado')}>Saltar</Button>
              )}
            </div>
            {open === i.google_event_id && <ReviewPanel item={i} onDone={() => { setOpen(null); refresh(); }} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminSyncPage() {
  return (
    <AppLayout>
      <div className="p-3 sm:p-6 space-y-3 max-w-6xl">
        <h1 className="text-lg font-semibold">Sincronização</h1>
        <Tabs defaultValue="health">
          <TabsList>
            <TabsTrigger value="health">Saúde</TabsTrigger>
            <TabsTrigger value="migration">Migração</TabsTrigger>
          </TabsList>
          <TabsContent value="health"><HealthTab /></TabsContent>
          <TabsContent value="migration"><MigrationTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
