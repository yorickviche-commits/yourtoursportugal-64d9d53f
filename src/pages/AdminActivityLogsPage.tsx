import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Search } from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
  id: string;
  user_id: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-success/20 text-success',
  create: 'bg-info/20 text-info',
  update: 'bg-warning/20 text-warning',
  delete: 'bg-destructive/20 text-destructive',
  approve: 'bg-primary/20 text-primary',
  api_call: 'bg-muted text-muted-foreground',
};

const AdminActivityLogsPage = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (filterAction !== 'all') query = query.eq('action_type', filterAction);
    const { data } = await query;
    setLogs((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [filterAction]);

  const filteredLogs = logs.filter(l => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.action_type.toLowerCase().includes(term) ||
      l.entity_type?.toLowerCase().includes(term) ||
      l.entity_id?.toLowerCase().includes(term) ||
      JSON.stringify(l.details).toLowerCase().includes(term)
    );
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar logs..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Filtrar ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="api_call">API Call</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-muted-foreground">A carregar...</p>
        ) : filteredLogs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredLogs.map(log => (
                <Card key={log.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge className={`text-[10px] shrink-0 ${ACTION_COLORS[log.action_type] || 'bg-muted text-muted-foreground'}`}>
                          {log.action_type}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {log.entity_type && <span className="text-muted-foreground">{log.entity_type}</span>}
                            {log.entity_id && <span className="ml-1 text-foreground">{log.entity_id}</span>}
                          </p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {JSON.stringify(log.details).slice(0, 120)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'dd/MM HH:mm')}</p>
                        {log.ip_address && <p className="text-[10px] text-muted-foreground">{log.ip_address}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminActivityLogsPage;
