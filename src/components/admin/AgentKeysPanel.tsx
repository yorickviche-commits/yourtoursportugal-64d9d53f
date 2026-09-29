import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Bot, Copy, KeyRound, Loader2, Plus, RotateCw, Ban } from 'lucide-react';

const READ_TOOLS = [
  'list_leads', 'get_lead', 'list_lead_stages', 'get_travel_plan', 'export_travel_plan_pdf', 'list_upcoming_trips',
  'list_tasks', 'list_pending_approvals', 'get_approval_status', 'get_costing', 'get_operations', 'validate_lead',
];
const WRITE_TOOLS = [
  'update_lead_stage', 'assign_lead_agents', 'update_lead_general_data', 'add_lead_note', 'create_task', 'update_task',
  'upsert_costing_lines', 'remove_costing_line', 'autofill_costing_from_plan', 'update_operation_item', 'update_day_ops',
  'update_trip_briefing', 'generate_travel_plan', 'update_travel_plan_day', 'update_travel_plan_header',
  'fill_travel_plan_images', 'request_payment_link', 'draft_fse_requests', 'draft_client_email', 'import_lead_ai',
  'create_nethunt_deal',
];

interface KeyRow {
  id: string; name: string; agent_label: string; model: string | null; key_prefix: string; scopes: string[];
  daily_call_limit: number; calls_today: number; calls_day: string; last_used_at: string | null;
  expires_at: string; revoked_at: string | null; created_at: string;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function AgentKeysPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [plain, setPlain] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', agent_label: '', model: '', daily_call_limit: 500, valid_days: 90, scopes: [...READ_TOOLS] as string[] });

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['agent_api_keys'],
    queryFn: async () => {
      const { data, error } = await supabase.from('agent_api_keys' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as KeyRow[];
    },
  });

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('agent-keys', { body });
    if (error) throw error;
    if ((data as any)?.error) throw new Error(typeof (data as any).error === 'string' ? (data as any).error : 'Dados inválidos');
    qc.invalidateQueries({ queryKey: ['agent_api_keys'] });
    return data as any;
  };

  const create = async () => {
    setBusy('create');
    try {
      const r = await call({ action: 'create', ...form, model: form.model || null });
      setOpen(false);
      setPlain(r.plain_key);
    } catch (e: any) { toast({ title: 'Erro ao criar chave', description: e.message, variant: 'destructive' }); }
    setBusy(null);
  };

  const revoke = async (k: KeyRow) => {
    if (!confirm(`Revogar a chave "${k.name}"? O agente perde acesso imediatamente.`)) return;
    setBusy(k.id);
    try { await call({ action: 'revoke', id: k.id }); toast({ title: 'Chave revogada' }); }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    setBusy(null);
  };

  const rotate = async (k: KeyRow) => {
    if (!confirm(`Rodar a chave "${k.name}"? A antiga é revogada e é criada uma nova com as mesmas definições.`)) return;
    setBusy(k.id);
    try { const r = await call({ action: 'rotate', id: k.id }); setPlain(r.plain_key); }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    setBusy(null);
  };

  const toggle = (t: string) => setForm(f => ({ ...f, scopes: f.scopes.includes(t) ? f.scopes.filter(s => s !== t) : [...f.scopes, t] }));
  const today = new Date().toISOString().slice(0, 10);

  const status = (k: KeyRow) => {
    if (k.revoked_at) return <Badge variant="destructive">Revogada</Badge>;
    if (new Date(k.expires_at) < new Date()) return <Badge variant="secondary">Expirada</Badge>;
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativa</Badge>;
  };

  const ScopeGroup = ({ title, tools }: { title: string; tools: string[] }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold">{title}</p>
        <button type="button" className="text-[11px] text-muted-foreground underline"
          onClick={() => setForm(f => ({ ...f, scopes: tools.every(t => f.scopes.includes(t)) ? f.scopes.filter(s => !tools.includes(s)) : Array.from(new Set([...f.scopes, ...tools])) }))}>
          todos / nenhum
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {tools.map(t => (
          <label key={t} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
            <Checkbox checked={form.scopes.includes(t)} onCheckedChange={() => toggle(t)} />
            <span className="font-mono">{t}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" />Agentes AI — chaves de acesso</CardTitle>
        <Button size="sm" className="gap-1" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />Criar chave</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Endpoint para agentes: <span className="font-mono">https://yourtoursportugal.lovable.app/functions/v1/mcp-agent</span> · Bearer <span className="font-mono">ytp_agent_…</span>.
          Os agentes trabalham em modo proposta (nunca alteram a versão LIVE) e não aprovam itens da fila.
        </p>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && !keys.length && <p className="text-sm text-muted-foreground">Ainda não há chaves.</p>}
        {keys.map(k => (
          <div key={k.id} className="rounded-lg border p-3 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{k.name}</span>
              {status(k)}
              <span className="text-muted-foreground">{k.agent_label}{k.model ? ` · ${k.model}` : ''}</span>
              <span className="font-mono text-muted-foreground">{k.key_prefix}…</span>
              <div className="ml-auto flex gap-1">
                {!k.revoked_at && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={busy === k.id} onClick={() => rotate(k)}><RotateCw className="h-3 w-3" />Rodar</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive" disabled={busy === k.id} onClick={() => revoke(k)}><Ban className="h-3 w-3" />Revogar</Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>Chamadas hoje: <b className="text-foreground">{k.calls_day === today ? k.calls_today : 0}</b> / {k.daily_call_limit}</span>
              <span>Último uso: {fmt(k.last_used_at)}</span>
              <span>Validade: {fmt(k.expires_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {k.scopes.map(s => <span key={s} className={`font-mono px-1.5 rounded ${READ_TOOLS.includes(s) ? 'bg-muted' : 'bg-amber-100 text-amber-800'}`}>{s}</span>)}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova chave de agente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label className="text-xs">Nome</Label><Input value={form.name} placeholder="Grok Worker" onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">Agente</Label><Input value={form.agent_label} placeholder="Grok (Worker)" onChange={e => setForm({ ...form, agent_label: e.target.value })} /></div>
            <div><Label className="text-xs">Modelo</Label><Input value={form.model} placeholder="grok-4" onChange={e => setForm({ ...form, model: e.target.value })} /></div>
            <div><Label className="text-xs">Limite diário</Label><Input type="number" value={form.daily_call_limit} onChange={e => setForm({ ...form, daily_call_limit: Number(e.target.value) || 500 })} /></div>
            <div><Label className="text-xs">Validade (dias)</Label><Input type="number" value={form.valid_days} onChange={e => setForm({ ...form, valid_days: Number(e.target.value) || 90 })} /></div>
          </div>
          <div className="space-y-3 pt-2">
            <ScopeGroup title="Leitura" tools={READ_TOOLS} />
            <ScopeGroup title="Escrita (modo proposta / fila de aprovação)" tools={WRITE_TOOLS} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.name.trim() || !form.agent_label.trim() || !form.scopes.length || busy === 'create'} onClick={create} className="gap-1">
              {busy === 'create' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!plain} onOpenChange={o => !o && setPlain(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copie a chave agora</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Esta chave só é mostrada uma vez. Guarde-a no Make / agendador do agente.</p>
          <div className="font-mono text-xs break-all rounded border bg-muted p-2">{plain}</div>
          <DialogFooter>
            <Button className="gap-1" onClick={() => { navigator.clipboard.writeText(plain || ''); toast({ title: 'Chave copiada' }); }}><Copy className="h-3.5 w-3.5" />Copiar</Button>
            <Button variant="outline" onClick={() => setPlain(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
