import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, ExternalLink, Search, GripVertical } from 'lucide-react';
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
}

type PipelineType = 'sales' | 'operations';

const SALES_STAGES = [
  'SALES - New Lead / Incoming Request',
  'SALES - Discovery Stage & Itinerary Creation',
  'SALES -  -  Budgeting & Fine-Tuning',
  'SALES - Final Negotiation & Ready to Book',
];

const OPERATIONS_STAGES = [
  'OPERATIONS - Deposit/Payment Received',
  'OPERATIONS - Suppliers Bookings & Confirmations',
  'OPERATIONS - Technical Briefing (Internal & Suppliers)',
  'OPERATIONS - Clients Final Briefing',
  'OPERATIONS - Trip Ready / In Execution',
  'OPERATIONS - Trip Confirmed & In Preparation',
  'OPERATIONS - Trip Completed',
];

const getStageColor = (stage: string) => {
  const s = stage.toLowerCase();
  if (s.includes('new lead') || s.includes('incoming')) return 'bg-blue-500/10 border-blue-500/30 text-blue-700';
  if (s.includes('discovery')) return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700';
  if (s.includes('budgeting') || s.includes('fine-tuning')) return 'bg-amber-500/10 border-amber-500/30 text-amber-700';
  if (s.includes('negotiation') || s.includes('ready to book')) return 'bg-orange-500/10 border-orange-500/30 text-orange-700';
  if (s.includes('deposit') || s.includes('payment received')) return 'bg-green-500/10 border-green-500/30 text-green-700';
  if (s.includes('suppliers bookings')) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700';
  if (s.includes('technical briefing')) return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700';
  if (s.includes('clients final')) return 'bg-purple-500/10 border-purple-500/30 text-purple-700';
  if (s.includes('trip ready') || s.includes('execution')) return 'bg-rose-500/10 border-rose-500/30 text-rose-700';
  if (s.includes('completed')) return 'bg-teal-500/10 border-teal-500/30 text-teal-700';
  return 'bg-muted/50 border-border text-foreground';
};

const getShortStageName = (stage: string): string => {
  const parts = stage.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : stage;
};

const getDaysSinceEmail = (record: NethuntRecord): number | null => {
  const lastEmail = record.fields?.['Last Email Received'] || record.fields?.['Last Email Sent'];
  if (!lastEmail) return null;
  const d = new Date(lastEmail);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

const getDaysOnStage = (record: NethuntRecord): number | null => {
  const updated = record.updatedAt;
  if (!updated) return null;
  const d = new Date(updated);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

const CRMPage = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<NethuntFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<NethuntFolder | null>(null);
  const [records, setRecords] = useState<NethuntRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pipeline, setPipeline] = useState<PipelineType>('sales');
  const [detectedStages, setDetectedStages] = useState<Set<string>>(new Set());

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
          limit: 500,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const recs = Array.isArray(data) ? data : [];
      setRecords(recs);

      const stageSet = new Set<string>();
      recs.forEach((r: NethuntRecord) => {
        const stage = r.fields?.Stage || r.fields?.stage;
        if (stage && typeof stage === 'string') stageSet.add(stage);
      });
      setDetectedStages(stageSet);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar registos');
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => { fetchFolders(); }, []);

  const getStagesForPipeline = (): string[] => {
    const base = pipeline === 'sales' ? SALES_STAGES : OPERATIONS_STAGES;
    // Include stages from data that match the pipeline prefix but aren't in defaults
    const prefix = pipeline === 'sales' ? 'SALES' : 'OPERATIONS';
    const extra: string[] = [];
    detectedStages.forEach(s => {
      if (s.toUpperCase().startsWith(prefix) && !base.includes(s)) extra.push(s);
    });
    return [...base, ...extra].filter(s => detectedStages.has(s) || base.includes(s));
  };

  const getRecordsByStage = (stage: string): NethuntRecord[] => {
    return records.filter(r => (r.fields?.Stage || r.fields?.stage) === stage);
  };

  const getPipelineRecordCount = (): number => {
    const prefix = pipeline === 'sales' ? 'SALES' : 'OPERATIONS';
    return records.filter(r => {
      const stage = r.fields?.Stage || r.fields?.stage || '';
      return stage.toUpperCase().startsWith(prefix);
    }).length;
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;

    const destStage = result.destination.droppableId;
    const recordId = result.draggableId;
    const record = records.find(r => r.recordId === recordId);
    if (!record) return;

    const oldRecords = [...records];
    setRecords(prev =>
      prev.map(r => r.recordId === recordId ? { ...r, fields: { ...r.fields, Stage: destStage } } : r)
    );

    try {
      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: {
          action: 'update-record',
          recordId,
          fieldActions: { Stage: { overwrite: true, add: destStage } },
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Stage atualizado',
        description: `"${record.fields?.Name || recordId}" → ${getShortStageName(destStage)}`,
      });
    } catch (err: any) {
      setRecords(oldRecords);
      toast({ title: 'Erro ao atualizar stage', description: err.message, variant: 'destructive' });
    }
  };

  const stages = getStagesForPipeline();

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">CRM Pipeline</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sincronizado com NetHunt • Drag & drop entre stages
            </p>
          </div>
          <div className="flex gap-2">
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
            <Button variant="link" size="sm" onClick={() => { setError(null); fetchFolders(); }}>Tentar novamente</Button>
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

        {/* Pipeline tabs + Search */}
        {selectedFolder && (
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Tabs value={pipeline} onValueChange={(v) => setPipeline(v as PipelineType)} className="flex-shrink-0">
              <TabsList className="h-9">
                <TabsTrigger value="sales" className="text-xs px-4">
                  🟡 Sales Pipeline
                </TabsTrigger>
                <TabsTrigger value="operations" className="text-xs px-4">
                  🟢 Operations Pipeline
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ficheiros..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchRecords(selectedFolder, searchQuery); }}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Badge variant="secondary" className="flex-shrink-0">{getPipelineRecordCount()} ficheiros</Badge>
          </div>
        )}

        {/* Kanban Board */}
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
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto flex-1 pb-4 min-h-0">
              {stages.map(stage => {
                const stageRecords = getRecordsByStage(stage);
                return (
                  <div key={stage} className="min-w-[280px] max-w-[300px] flex-shrink-0 flex flex-col">
                    <div className={`px-3 py-2 rounded-t-lg border ${getStageColor(stage)} flex items-center justify-between`}>
                      <span className="text-xs font-semibold truncate">{getShortStageName(stage)}</span>
                      <Badge variant="outline" className="text-[10px] ml-1 flex-shrink-0">{stageRecords.length}</Badge>
                    </div>

                    <Droppable droppableId={stage}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-1.5 rounded-b-lg border border-t-0 border-border space-y-1.5 min-h-[80px] transition-colors ${
                            snapshot.isDraggingOver ? 'bg-primary/5' : 'bg-muted/20'
                          }`}
                        >
                          {stageRecords.map((record, index) => {
                            const daysSinceEmail = getDaysSinceEmail(record);
                            const daysOnStage = getDaysOnStage(record);
                            return (
                              <Draggable key={record.recordId} draggableId={record.recordId} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    className={`group ${dragSnapshot.isDragging ? 'rotate-2 shadow-lg' : ''}`}
                                  >
                                    <Card
                                      className="cursor-pointer hover:border-primary/40 transition-all"
                                      onClick={() => navigate(`/crm/${selectedFolder!.id}/${record.recordId}`)}
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
                                            <p className="text-xs font-medium truncate">{record.fields?.Name || record.recordId}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                              Stage: <span className="font-medium">{getShortStageName(record.fields?.Stage || '')}</span>
                                            </p>
                                            {record.fields?.['Close date'] && (
                                              <p className="text-[10px] text-muted-foreground">
                                                Close: {record.fields['Close date']}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                              {daysSinceEmail !== null && (
                                                <span className={`text-[10px] ${daysSinceEmail > 7 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                                  📧 {daysSinceEmail}d
                                                </span>
                                              )}
                                              {daysOnStage !== null && (
                                                <span className={`text-[10px] ${daysOnStage > 14 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                                  ⏱ {daysOnStage}d on stage
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>
    </AppLayout>
  );
};

export default CRMPage;
