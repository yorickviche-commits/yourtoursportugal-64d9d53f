import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { RefreshCw, ExternalLink, Search, GripVertical, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from '@/hooks/use-toast';

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
  link?: string;
}

// Default stages for "Files & Processos" — will auto-detect from data
const DEFAULT_STAGES = [
  'SALES - New Lead / Incoming Request',
  'SALES -  -  Budgeting & Fine-Tuning',
  'SALES - Final Negotiation & Ready to Book',
  'OPERATIONS - Deposit/Payment Received',
  'OPERATIONS - Trip Confirmed & In Preparation',
  'OPERATIONS - Trip Completed',
  'CLOSED - Won',
  'CLOSED - Lost',
];

const CRMPage = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<NethuntFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<NethuntFolder | null>(null);
  const [records, setRecords] = useState<NethuntRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES);

  const fetchFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: { action: 'list-folders' },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const folderList = Array.isArray(data) ? data : [];
      setFolders(folderList);
      // Auto-select first folder
      if (folderList.length > 0 && !selectedFolder) {
        fetchRecords(folderList[0]);
      }
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
          limit: 200,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const recs = Array.isArray(data) ? data : [];
      setRecords(recs);

      // Auto-detect stages from data
      const stageSet = new Set<string>();
      recs.forEach(r => {
        const stage = r.fields?.Stage || r.fields?.stage;
        if (stage && typeof stage === 'string') stageSet.add(stage);
      });
      if (stageSet.size > 0) {
        // Merge with defaults, preserving order
        const merged = [...DEFAULT_STAGES];
        stageSet.forEach(s => {
          if (!merged.includes(s)) merged.push(s);
        });
        setStages(merged.filter(s => stageSet.has(s) || DEFAULT_STAGES.includes(s)));
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar registos');
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const getRecordStage = (record: NethuntRecord): string => {
    return record.fields?.Stage || record.fields?.stage || 'Sem Stage';
  };

  const getRecordName = (record: NethuntRecord): string => {
    return record.fields?.Name || record.fields?.name || record.id;
  };

  const getRecordsByStage = (stage: string): NethuntRecord[] => {
    return records.filter(r => getRecordStage(r) === stage);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceStage = result.source.droppableId;
    const destStage = result.destination.droppableId;

    if (sourceStage === destStage) return;

    const recordId = result.draggableId;
    const record = records.find(r => r.recordId === recordId);
    if (!record) return;

    // Optimistic update
    const oldRecords = [...records];
    setRecords(prev =>
      prev.map(r =>
        r.recordId === recordId
          ? { ...r, fields: { ...r.fields, Stage: destStage } }
          : r
      )
    );

    try {
      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: {
          action: 'update-record',
          recordId,
          fieldActions: {
            Stage: {
              overwrite: true,
              add: destStage,
            },
          },
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Stage atualizado',
        description: `"${getRecordName(record)}" movido para "${destStage.split(' - ').pop()}"`,
      });
    } catch (err: any) {
      // Rollback
      setRecords(oldRecords);
      toast({
        title: 'Erro ao atualizar stage',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const openRecordDetail = (record: NethuntRecord) => {
    if (selectedFolder) {
      navigate(`/crm/${selectedFolder.id}/${record.recordId}`);
    }
  };

  const getStageColor = (stage: string) => {
    const s = stage.toLowerCase();
    if (s.includes('new lead') || s.includes('incoming')) return 'bg-blue-500/10 border-blue-500/30 text-blue-700';
    if (s.includes('budgeting') || s.includes('fine-tuning')) return 'bg-amber-500/10 border-amber-500/30 text-amber-700';
    if (s.includes('negotiation') || s.includes('ready to book')) return 'bg-orange-500/10 border-orange-500/30 text-orange-700';
    if (s.includes('deposit') || s.includes('payment received')) return 'bg-green-500/10 border-green-500/30 text-green-700';
    if (s.includes('confirmed') || s.includes('preparation')) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700';
    if (s.includes('completed')) return 'bg-teal-500/10 border-teal-500/30 text-teal-700';
    if (s.includes('won')) return 'bg-green-600/10 border-green-600/30 text-green-800';
    if (s.includes('lost')) return 'bg-red-500/10 border-red-500/30 text-red-700';
    return 'bg-muted/50 border-border text-foreground';
  };

  const getStageBadgeVariant = (stage: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const s = stage.toLowerCase();
    if (s.includes('won') || s.includes('completed') || s.includes('confirmed')) return 'default';
    if (s.includes('lost')) return 'destructive';
    if (s.includes('negotiation') || s.includes('deposit')) return 'secondary';
    return 'outline';
  };

  const getShortStageName = (stage: string): string => {
    const parts = stage.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : stage;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">CRM Pipeline</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Arrasta os ficheiros entre stages • Dados sincronizados com NetHunt
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex border border-border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none text-xs h-8"
                onClick={() => setViewMode('kanban')}
              >
                Pipeline
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none text-xs h-8"
                onClick={() => setViewMode('list')}
              >
                Lista
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => selectedFolder && fetchRecords(selectedFolder)}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
            </Button>
            <a href="https://nethunt.com" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3 w-3 mr-1" /> NetHunt
              </Button>
            </a>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex-shrink-0">
            {error}
            <Button variant="link" size="sm" onClick={() => { setError(null); fetchFolders(); }}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Folder tabs */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {loading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-28" />)
          ) : (
            folders.map(folder => (
              <Button
                key={folder.id}
                variant={selectedFolder?.id === folder.id ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => fetchRecords(folder)}
              >
                {folder.name}
              </Button>
            ))
          )}
        </div>

        {/* Search */}
        {selectedFolder && (
          <div className="flex gap-2 flex-shrink-0">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ficheiros..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchRecords(selectedFolder, searchQuery); }}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button size="sm" onClick={() => fetchRecords(selectedFolder, searchQuery)}>
              Pesquisar
            </Button>
            <Badge variant="secondary" className="self-center">{records.length} ficheiros</Badge>
          </div>
        )}

        {/* Content */}
        {recordsLoading ? (
          <div className="flex gap-3 overflow-x-auto flex-1 pb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="min-w-[280px] flex-shrink-0">
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-24 w-full mb-2" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : viewMode === 'kanban' ? (
          /* ── KANBAN VIEW ── */
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto flex-1 pb-4 min-h-0">
              {stages.map(stage => {
                const stageRecords = getRecordsByStage(stage);
                return (
                  <div key={stage} className="min-w-[280px] max-w-[300px] flex-shrink-0 flex flex-col">
                    {/* Stage header */}
                    <div className={`px-3 py-2 rounded-t-lg border ${getStageColor(stage)} flex items-center justify-between`}>
                      <span className="text-xs font-semibold truncate">{getShortStageName(stage)}</span>
                      <Badge variant="outline" className="text-[10px] ml-1 flex-shrink-0">
                        {stageRecords.length}
                      </Badge>
                    </div>

                    {/* Droppable column */}
                    <Droppable droppableId={stage}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-1.5 rounded-b-lg border border-t-0 border-border space-y-1.5 min-h-[80px] transition-colors ${
                            snapshot.isDraggingOver ? 'bg-primary/5' : 'bg-muted/20'
                          }`}
                        >
                          {stageRecords.map((record, index) => (
                            <Draggable key={record.recordId} draggableId={record.recordId} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`group ${dragSnapshot.isDragging ? 'rotate-2 shadow-lg' : ''}`}
                                >
                                  <Card
                                    className="cursor-pointer hover:border-primary/40 transition-all"
                                    onClick={() => openRecordDetail(record)}
                                  >
                                    <CardContent className="p-2.5">
                                      <div className="flex items-start gap-1.5">
                                        <div
                                          {...dragProvided.dragHandleProps}
                                          className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
                                        >
                                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">{getRecordName(record)}</p>
                                          {record.fields?.['Close date'] && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                              Fecho: {record.fields['Close date']}
                                            </p>
                                          )}
                                          {record.fields?.['B2B / B2C'] && (
                                            <Badge variant="outline" className="text-[9px] py-0 mt-1">
                                              {Array.isArray(record.fields['B2B / B2C'])
                                                ? record.fields['B2B / B2C'][0]
                                                : record.fields['B2B / B2C']}
                                            </Badge>
                                          )}
                                          {record.fields?.['Last Email Received'] && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                              📧 {new Date(record.fields['Last Email Received']).toLocaleDateString('pt-PT')}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        ) : (
          /* ── LIST VIEW ── */
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 overflow-y-auto flex-1 pb-4">
            {records.map(record => (
              <Card
                key={record.recordId}
                className="cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => openRecordDetail(record)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate flex-1">{getRecordName(record)}</p>
                    {record.link && (
                      <a
                        href={record.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                  <Badge variant={getStageBadgeVariant(getRecordStage(record))} className="text-[10px] mt-1">
                    {getShortStageName(getRecordStage(record))}
                  </Badge>
                  {record.fields?.['Close date'] && (
                    <p className="text-xs text-muted-foreground mt-1">Fecho: {record.fields['Close date']}</p>
                  )}
                  {record.updatedAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Atualizado: {new Date(record.updatedAt).toLocaleDateString('pt-PT')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
            {records.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">Nenhum ficheiro encontrado</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CRMPage;
