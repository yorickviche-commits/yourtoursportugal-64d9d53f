import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plug, RefreshCw, AlertTriangle } from 'lucide-react';
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
  wetravel: '🌍', nethunt: '📋', stripe: '💳', email_service: '✉️',
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Plug className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        </div>

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

export default AdminIntegrationsPage;
