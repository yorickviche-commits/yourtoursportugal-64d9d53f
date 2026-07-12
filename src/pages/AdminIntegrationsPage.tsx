import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plug, RefreshCw, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface Integration {
  id: string;
  name: string;
  api_key_ref: string | null;
  status: string;
  last_sync_at: string | null;
  error_count: number;
  config: any;
}

const INTEGRATION_ICONS: Record<string, string> = {
  wetravel: '🌍', nethunt: '📋', stripe: '💳', email_service: '✉️', google_calendar: '📅',
};

const AdminIntegrationsPage = () => {
  const { isAdmin } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchIntegrations = async () => {
    setLoading(true);
    const { data } = await supabase.from('integration_settings').select('*').order('name');
    setIntegrations((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const toggleStatus = async (integration: Integration) => {
    const newStatus = integration.status === 'active' ? 'inactive' : 'active';
    await supabase.from('integration_settings').update({ status: newStatus } as any).eq('id', integration.id);
    toast({ title: `${integration.name} ${newStatus === 'active' ? 'ativado' : 'desativado'}` });
    fetchIntegrations();
  };

  const resync = async (integration: Integration) => {
    await supabase.from('integration_settings').update({
      last_sync_at: new Date().toISOString(),
      error_count: 0,
    } as any).eq('id', integration.id);
    toast({ title: `${integration.name} re-sincronizado` });
    fetchIntegrations();
  };

  if (!isAdmin) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div></AppLayout>;
  }

  const gcal = integrations.find(i => i.name === 'google_calendar');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Plug className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        </div>

        {gcal && <GoogleCalendarPanel integ={gcal} onChange={fetchIntegrations} />}

        {loading ? <p className="text-muted-foreground">A carregar...</p> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {integrations.map(integ => (
              <Card key={integ.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{INTEGRATION_ICONS[integ.name] || '🔌'}</span>
                      <div>
                        <p className="font-semibold text-foreground capitalize">{integ.name}</p>
                        <p className="text-xs text-muted-foreground">{integ.config?.description || ''}</p>
                      </div>
                    </div>
                    <Badge className={integ.status === 'active' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
                      {integ.status}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Último sync</span>
                      <span>{integ.last_sync_at ? format(new Date(integ.last_sync_at), 'dd/MM HH:mm') : 'Nunca'}</span>
                    </div>
                    {integ.error_count > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Erros</span>
                        <span>{integ.error_count}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(integ)} className="flex-1 text-xs">
                      {integ.status === 'active' ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resync(integ)} className="text-xs">
                      <RefreshCw className="h-3 w-3 mr-1" />Sync
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function GoogleCalendarPanel({ integ, onChange }: { integ: Integration; onChange: () => void }) {
  const { toast } = useToast();
  const [calendarId, setCalendarId] = useState<string>(integ.config?.calendar_id || 'primary');
  const [enabled, setEnabled] = useState<boolean>(!!integ.config?.enabled);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('integration_settings').update({
      status: enabled ? 'active' : 'disabled',
      config: { ...(integ.config || {}), calendar_id: calendarId.trim() || 'primary', enabled },
    } as any).eq('id', integ.id);
    setSaving(false);
    if (error) toast({ title: 'Erro ao guardar', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Configuração guardada' }); onChange(); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', { body: { lead_id: '00000000-0000-0000-0000-000000000000', mode: 'update' } });
      if (error) throw error;
      toast({ title: 'Ligação OK', description: JSON.stringify(data).slice(0, 100) });
    } catch (e: any) {
      toast({ title: 'Erro na ligação', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Google Calendar — Operações YT</p>
              <p className="text-xs text-muted-foreground">Sincroniza automaticamente cada dia das leads em estado "Ganho" para o calendário partilhado.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">{enabled ? 'Ativo' : 'Desativado'}</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground">ID do calendário</label>
            <Input value={calendarId} onChange={e => setCalendarId(e.target.value)} placeholder="primary ou c_abc123@group.calendar.google.com" className="text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">Use "primary" para o calendário principal da conta ligada, ou copie o ID de um calendário partilhado.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={test} disabled={testing}>
              {testing ? 'A testar...' : 'Testar'}
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? 'A guardar...' : 'Guardar'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminIntegrationsPage;
