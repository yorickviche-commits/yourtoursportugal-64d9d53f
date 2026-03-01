import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ExternalLink, FolderOpen, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface NethuntFolder {
  id: string;
  name: string;
}

interface NethuntRecord {
  id: string;
  recordId: string;
  createdAt?: string;
  updatedAt?: string;
  fields: Record<string, any>;
}

const CRMPage = () => {
  const [folders, setFolders] = useState<NethuntFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<NethuntFolder | null>(null);
  const [records, setRecords] = useState<NethuntRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: { action: 'list-folders' },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setFolders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pastas');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (folder: NethuntFolder, query?: string) => {
    setRecordsLoading(true);
    setSelectedFolder(folder);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: { 
          action: query ? 'find-records' : 'recent-records', 
          folderId: folder.id,
          query: query || undefined,
          limit: 30,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar registos');
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const getRecordName = (record: NethuntRecord) => {
    const fields = record.fields;
    return fields['Name'] || fields['name'] || fields['Deal Name'] || fields['Company'] || record.id;
  };

  const getRecordEmail = (record: NethuntRecord) => {
    const fields = record.fields;
    return fields['Primary Email Address'] || fields['Email'] || fields['email'] || null;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">CRM (NetHunt)</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Dados em tempo real do NetHunt CRM</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchFolders}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
            </Button>
            <a href="https://nethunt.com" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir NetHunt
              </Button>
            </a>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
            <Button variant="link" size="sm" onClick={() => { setError(null); fetchFolders(); }}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Folders */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" /> Pastas CRM
          </h2>
          {loading ? (
            <div className="flex gap-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-28" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {folders.map(folder => (
                <Button
                  key={folder.id}
                  variant={selectedFolder?.id === folder.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => fetchRecords(folder)}
                >
                  {folder.name}
                </Button>
              ))}
              {folders.length === 0 && !error && (
                <p className="text-sm text-muted-foreground">Nenhuma pasta encontrada</p>
              )}
            </div>
          )}
        </div>

        {/* Records section */}
        {selectedFolder && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {selectedFolder.name}
              </h2>
              <Badge variant="secondary">{records.length} registos</Badge>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar registos..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchRecords(selectedFolder, searchQuery); }}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Button size="sm" onClick={() => fetchRecords(selectedFolder, searchQuery)}>
                Pesquisar
              </Button>
            </div>

            {/* Records list */}
            {recordsLoading ? (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {records.map(record => (
                  <Card key={record.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-3">
                      <p className="font-medium text-sm truncate">{getRecordName(record)}</p>
                      {getRecordEmail(record) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {getRecordEmail(record)}
                        </p>
                      )}
                      {record.updatedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Atualizado: {new Date(record.updatedAt).toLocaleDateString('pt-PT')}
                        </p>
                      )}
                      {/* Show extra fields */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(record.fields)
                          .filter(([key]) => !['Name', 'name', 'Primary Email Address', 'Email'].includes(key))
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-[10px] py-0">
                              {key}: {typeof value === 'string' ? value.slice(0, 20) : Array.isArray(value) ? value.length : String(value)}
                            </Badge>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {records.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full">Nenhum registo encontrado</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CRMPage;
