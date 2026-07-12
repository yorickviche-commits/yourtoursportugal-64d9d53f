import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUserKPIs, KPIFilters } from '@/hooks/useUserKPIs';
import KPIFiltersBar from '@/components/kpi/KPIFilters';
import KPICards from '@/components/kpi/KPICards';
import { exportPDF, exportExcel } from '@/lib/kpiExport';
import { User as UserIcon, Camera, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'info' | 'logs' | 'leads' | 'kpis';

const fmtEur = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function ProfilePage() {
  const params = useParams();
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const targetId = params.userId === 'me' || !params.userId ? currentUser?.id : params.userId;
  const [tab, setTab] = useState<Tab>('info');
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [kpiFilters, setKpiFilters] = useState<KPIFilters>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: kpis } = useUserKPIs(targetId, kpiFilters);
  const canEdit = currentUser?.id === targetId || isAdmin;

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', targetId),
      ]);
      setProfile(p);
      setRoles((r || []).map((x: any) => x.role));
    })();
  }, [targetId]);

  useEffect(() => {
    if (!targetId || tab !== 'logs') return;
    (async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*').eq('user_id', targetId)
        .order('created_at', { ascending: false }).limit(200);
      setLogs(data || []);
    })();
  }, [tab, targetId]);

  useEffect(() => {
    if (!targetId || tab !== 'leads') return;
    (async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, lead_code, client_name, destination, status, pvp_override, created_at, assigned_agents, created_by')
        .or(`assigned_agents.cs.{${targetId}},created_by.eq.${targetId}`)
        .order('created_at', { ascending: false });
      setLeads(data || []);
    })();
  }, [tab, targetId]);

  const saveProfile = async (patch: any) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', targetId!);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setProfile((p: any) => ({ ...p, ...patch }));
    toast({ title: 'Guardado' });
  };

  const uploadAvatar = async (file: File) => {
    if (!targetId) return;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${targetId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) return toast({ title: 'Erro upload', description: error.message, variant: 'destructive' });
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    await saveProfile({ avatar_url: pub.publicUrl });
  };

  const filteredLogs = useMemo(() =>
    logs.filter(l => !logFilter || JSON.stringify(l).toLowerCase().includes(logFilter.toLowerCase())),
    [logs, logFilter]);
  const filteredLeads = useMemo(() =>
    leads.filter(l => !leadSearch ||
      [l.client_name, l.lead_code, l.destination].some(v => (v || '').toLowerCase().includes(leadSearch.toLowerCase()))),
    [leads, leadSearch]);

  const exportKPIs = (kind: 'pdf' | 'excel') => {
    if (!kpis) return;
    const headers = ['Métrica', 'Valor'];
    const rows: (string | number)[][] = [
      ['Propostas Enviadas', kpis.proposalsSent],
      ['Ganhas', kpis.proposalsWon],
      ['Perdidas', kpis.proposalsLost],
      ['Em Espera', kpis.proposalsPending],
      ['Volume Total', fmtEur(kpis.totalVolume)],
      ['Volume Confirmado', fmtEur(kpis.confirmedVolume)],
      ['Margem Média', `${kpis.avgMargin.toFixed(1)}%`],
      ['Taxa Conversão', `${kpis.conversionRate.toFixed(1)}%`],
    ];
    const fname = `kpis_${profile?.full_name || 'user'}_${new Date().toISOString().slice(0, 10)}`;
    if (kind === 'pdf') exportPDF(`KPIs — ${profile?.full_name || ''}`, headers, rows, fname);
    else exportExcel('KPIs', headers, rows, fname);
  };

  if (!targetId) return <AppLayout><div className="p-6 text-muted-foreground">Sem utilizador.</div></AppLayout>;

  const initials = (profile?.full_name || profile?.email || '??').split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-4 border-b border-border pb-4">
          <div className="relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">{initials}</div>
            )}
            {canEdit && (
              <>
                <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1"><Camera className="h-3 w-3" /></button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{profile?.full_name || 'Utilizador'}</h1>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <div className="flex gap-1 mt-1">
              {roles.map(r => <span key={r} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{r}</span>)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0 border-b border-border">
          {([
            { k: 'info', l: 'Informações' },
            { k: 'logs', l: 'Histórico & Logs' },
            { k: 'leads', l: 'Minhas Leads' },
            { k: 'kpis', l: 'Dashboard KPIs' },
          ] as { k: Tab; l: string }[]).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={cn('px-4 py-2 text-xs font-medium border-b-2 -mb-px',
                tab === t.k ? 'border-[hsl(var(--info))] text-[hsl(var(--info))]' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <Card className="p-4 space-y-3 max-w-xl">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Nome completo</label>
              <Input className="h-8 text-xs mt-1" defaultValue={profile?.full_name || ''} disabled={!canEdit}
                onBlur={e => e.target.value !== profile?.full_name && saveProfile({ full_name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Email</label>
              <Input className="h-8 text-xs mt-1" defaultValue={profile?.email || ''} disabled />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Telefone</label>
              <Input className="h-8 text-xs mt-1" defaultValue={profile?.phone || ''} disabled={!canEdit}
                onBlur={e => e.target.value !== (profile?.phone || '') && saveProfile({ phone: e.target.value })} />
            </div>
            <div className="text-xs text-muted-foreground">Estado: {profile?.status || 'active'}</div>
          </Card>
        )}

        {tab === 'logs' && (
          <div className="space-y-2">
            <Input placeholder="Filtrar logs..." className="h-8 text-xs max-w-md" value={logFilter} onChange={e => setLogFilter(e.target.value)} />
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>
                  <th className="text-left p-2">Data</th><th className="text-left p-2">Ação</th><th className="text-left p-2">Entidade</th><th className="text-left p-2">Detalhes</th>
                </tr></thead>
                <tbody>
                  {filteredLogs.map(l => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-PT')}</td>
                      <td className="p-2">{l.action}</td>
                      <td className="p-2">{l.entity_type} {l.entity_id?.slice(0, 8)}</td>
                      <td className="p-2 text-muted-foreground truncate max-w-md">{typeof l.metadata === 'object' ? JSON.stringify(l.metadata) : l.metadata}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sem registos</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === 'leads' && (
          <div className="space-y-2">
            <Input placeholder="Pesquisar..." className="h-8 text-xs max-w-md" value={leadSearch} onChange={e => setLeadSearch(e.target.value)} />
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>
                  <th className="text-left p-2">ID</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Destino</th><th className="text-left p-2">Estado</th><th className="text-right p-2">Valor</th><th className="text-left p-2">Data</th>
                </tr></thead>
                <tbody>
                  {filteredLeads.map(l => (
                    <tr key={l.id} className="border-t border-border hover:bg-muted/50">
                      <td className="p-2 font-mono"><Link to={`/leads/${l.id}`} className="text-primary hover:underline">{l.lead_code}</Link></td>
                      <td className="p-2"><Link to={`/leads/${l.id}`} className="hover:underline">{l.client_name}</Link></td>
                      <td className="p-2">{l.destination}</td>
                      <td className="p-2">{l.status}</td>
                      <td className="p-2 text-right">{l.pvp_override ? fmtEur(Number(l.pvp_override)) : '—'}</td>
                      <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('pt-PT')}</td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem leads atribuídas</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === 'kpis' && kpis && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <KPIFiltersBar value={kpiFilters} onChange={setKpiFilters} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportKPIs('pdf')}><FileDown className="h-3 w-3 mr-1" />PDF</Button>
                <Button size="sm" variant="outline" onClick={() => exportKPIs('excel')}><FileDown className="h-3 w-3 mr-1" />Excel</Button>
              </div>
            </div>
            <KPICards k={kpis} />
            {kpis.monthly.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold mb-2">Propostas por mês</p>
                <div className="flex items-end gap-2 h-40">
                  {kpis.monthly.map(m => {
                    const max = Math.max(...kpis.monthly.map(x => x.count), 1);
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-[10px]">{m.count}</div>
                        <div className="w-full bg-primary rounded-t" style={{ height: `${(m.count / max) * 100}%` }} />
                        <div className="text-[9px] text-muted-foreground">{m.month}</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
