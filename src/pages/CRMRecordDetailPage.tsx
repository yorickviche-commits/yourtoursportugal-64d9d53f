import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft, ExternalLink, Save, RefreshCw, Send,
  Mail, MessageSquare, Clock, FileText, Phone, ChevronDown,
  GitCommitHorizontal, Settings, BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface NethuntRecord {
  id: string;
  recordId: string;
  createdAt?: string;
  updatedAt?: string;
  fields: Record<string, any>;
}

interface TimelineEvent {
  id: string;
  type: 'comment' | 'stage_change' | 'email' | 'call_log' | 'file' | 'update';
  date: string;
  title: string;
  description?: string;
  user?: string;
  meta?: Record<string, any>;
}

// Fields to show in the left sidebar "Deal Details"
const DEAL_FIELDS = ['Stage', 'Close date', 'B2B / B2C', 'Source (Site, OTA, Direct)', 'Country/Nationality', 'Sale Potencial', 'Lead to Reactivate'];
const STAT_FIELDS = ['Last Email Received', 'Last Email Sent', 'Time Since Last Email', 'Days on Stage'];
const SYSTEM_FIELDS = ['Updated', 'Created', 'Record ID'];
const HIDDEN_FIELDS = new Set([...DEAL_FIELDS, ...STAT_FIELDS, ...SYSTEM_FIELDS, 'Name', 'name']);

const CRMRecordDetailPage = () => {
  const { folderId, recordId } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState<NethuntRecord | null>(null);
  const [originalFields, setOriginalFields] = useState<Record<string, any>>({});
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [fieldMeta, setFieldMeta] = useState<{ name: string }[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const [dealOpen, setDealOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(true);
  const [sysOpen, setSysOpen] = useState(false);

  const fetchAll = async () => {
    if (!folderId || !recordId) return;
    setLoading(true);
    try {
      const [recordRes, fieldsRes, commentsRes, changesRes, callLogsRes, driveFilesRes] = await Promise.all([
        supabase.functions.invoke('nethunt-proxy', { body: { action: 'find-record-by-id', folderId, recordId } }),
        supabase.functions.invoke('nethunt-proxy', { body: { action: 'folder-fields', folderId } }),
        supabase.functions.invoke('nethunt-proxy', { body: { action: 'recent-comments', folderId, limit: 100 } }),
        supabase.functions.invoke('nethunt-proxy', { body: { action: 'record-changes', folderId, recordId, limit: 100 } }),
        supabase.functions.invoke('nethunt-proxy', { body: { action: 'recent-call-logs', folderId, limit: 50 } }),
        supabase.functions.invoke('nethunt-proxy', { body: { action: 'recent-drive-files', folderId, limit: 50 } }),
      ]);

      if (recordRes.error) throw recordRes.error;
      const records = Array.isArray(recordRes.data) ? recordRes.data : [];
      const rec = records.find((r: any) => r.recordId === recordId) || records[0];
      if (!rec) throw new Error('Registo não encontrado');

      setRecord(rec);
      setOriginalFields({ ...rec.fields });
      setEditedFields({ ...rec.fields });

      if (fieldsRes.data && !fieldsRes.data?.error) {
        setFieldMeta(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
      }

      // Build timeline
      const events: TimelineEvent[] = [];

      // Comments
      if (commentsRes.data && !commentsRes.data?.error) {
        const allComments = Array.isArray(commentsRes.data) ? commentsRes.data : [];
        allComments
          .filter((c: any) => c.recordId === recordId)
          .forEach((c: any) => {
            events.push({
              id: c.commentId || c.id,
              type: 'comment',
              date: c.createdAt,
              title: 'Comentário',
              description: c.text,
            });
          });
      }

      // Record changes (stage changes, field updates)
      if (changesRes.data && !changesRes.data?.error) {
        const changes = Array.isArray(changesRes.data) ? changesRes.data : [];
        changes
          .filter((ch: any) => ch.recordId === recordId)
          .forEach((ch: any) => {
            const userName = ch.user?.personalName || ch.user?.emailAddress || 'Sistema';
            if (ch.recordAction === 'UPDATE' && ch.fieldActions?.Stage) {
              const stageChange = ch.fieldActions.Stage;
              events.push({
                id: ch.id,
                type: 'stage_change',
                date: ch.time,
                title: `Stage: ${stageChange.remove || '—'} → ${stageChange.add || '—'}`,
                user: userName,
                meta: { fieldActions: ch.fieldActions },
              });
            } else if (ch.recordAction === 'UPDATE') {
              const changedFields = Object.keys(ch.fieldActions || {}).join(', ');
              events.push({
                id: ch.id,
                type: 'update',
                date: ch.time,
                title: `Campos atualizados: ${changedFields}`,
                user: userName,
                meta: { fieldActions: ch.fieldActions },
              });
            } else if (ch.recordAction === 'CREATE') {
              events.push({
                id: ch.id,
                type: 'update',
                date: ch.time,
                title: 'Registo criado',
                user: userName,
              });
            }
          });
      }

      // Call logs
      if (callLogsRes.data && !callLogsRes.data?.error) {
        const logs = Array.isArray(callLogsRes.data) ? callLogsRes.data : [];
        logs
          .filter((l: any) => l.recordId === recordId)
          .forEach((l: any) => {
            events.push({
              id: l.callLogId || l.id,
              type: 'call_log',
              date: l.createdAt || l.time,
              title: `Chamada (${l.duration || 0} min)`,
              description: l.text,
            });
          });
      }

      // Drive files
      if (driveFilesRes.data && !driveFilesRes.data?.error) {
        const files = Array.isArray(driveFilesRes.data) ? driveFilesRes.data : [];
        files
          .filter((f: any) => f.recordId === recordId)
          .forEach((f: any) => {
            events.push({
              id: f.fileId || f.id,
              type: 'file',
              date: f.createdAt,
              title: f.name || 'Ficheiro',
              description: f.mimeType,
              meta: { url: f.url, iconUrl: f.iconUrl },
            });
          });
      }

      // Sort by date desc
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimeline(events);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [folderId, recordId]);

  const hasChanges = () => JSON.stringify(editedFields) !== JSON.stringify(originalFields);

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedFields(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSave = async () => {
    if (!record || !hasChanges()) return;
    setSaving(true);
    try {
      const fieldActions: Record<string, any> = {};
      for (const [key, newValue] of Object.entries(editedFields)) {
        if (JSON.stringify(originalFields[key]) !== JSON.stringify(newValue)) {
          fieldActions[key] = { overwrite: true, add: newValue };
        }
      }
      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: { action: 'update-record', recordId: record.recordId, fieldActions },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setOriginalFields({ ...editedFields });
      toast({ title: 'Guardado!', description: 'Sincronizado com NetHunt' });
    } catch (err: any) {
      toast({ title: 'Erro ao guardar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !record) return;
    setSendingComment(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: { action: 'create-comment', recordId: record.recordId, text: newComment },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setTimeline(prev => [{
        id: data.commentId || Date.now().toString(),
        type: 'comment' as const,
        date: new Date().toISOString(),
        title: 'Comentário',
        description: newComment,
      }, ...prev]);
      setNewComment('');
      toast({ title: 'Comentário adicionado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSendingComment(false);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const timeStr = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Hoje, ${timeStr}`;
    if (diffDays === 1) return `Ontem, ${timeStr}`;
    return `${date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}, ${timeStr}`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
      case 'stage_change': return <GitCommitHorizontal className="h-3.5 w-3.5 text-orange-500" />;
      case 'email': return <Mail className="h-3.5 w-3.5 text-red-500" />;
      case 'call_log': return <Phone className="h-3.5 w-3.5 text-green-500" />;
      case 'file': return <FileText className="h-3.5 w-3.5 text-purple-500" />;
      case 'update': return <Settings className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getFieldValue = (name: string) => editedFields[name] ?? record?.fields?.[name] ?? null;

  const renderSidebarField = (label: string, value: any) => {
    if (value === null || value === undefined) return null;
    const display = Array.isArray(value) ? value.join(', ') : String(value);
    return (
      <div key={label} className="flex justify-between items-start gap-2 py-1.5">
        <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
        <span className="text-[11px] font-medium text-right">{display}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex gap-4 max-w-7xl mx-auto">
          <Skeleton className="h-[600px] w-[260px] flex-shrink-0" />
          <Skeleton className="h-[600px] flex-1" />
        </div>
      </AppLayout>
    );
  }

  if (!record) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Registo não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/crm')}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Voltar ao CRM
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Remaining fields for the "All Fields" tab
  const otherFields = [...new Set([
    ...fieldMeta.map(f => f.name),
    ...Object.keys(editedFields),
  ])].filter(f => !HIDDEN_FIELDS.has(f));

  const daysSinceEmail = (() => {
    const last = getFieldValue('Last Email Received') || getFieldValue('Last Email Sent');
    if (!last) return null;
    const d = new Date(last);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  })();

  return (
    <AppLayout>
      <div className="flex gap-4 max-w-7xl mx-auto h-full">
        {/* ─── LEFT SIDEBAR ─── */}
        <div className="w-[260px] flex-shrink-0 space-y-3 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="text-[10px]">
              Ficheiro
            </Badge>
          </div>

          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">
              {editedFields.Name || editedFields.name || record.recordId}
            </h1>
          </div>

          {/* Deal Details */}
          <Collapsible open={dealOpen} onOpenChange={setDealOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
              Deal Details
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dealOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 border-t border-border pt-2">
                {/* Stage selector */}
                <div className="py-1.5">
                  <span className="text-[11px] text-muted-foreground block mb-1">Stage</span>
                  <Input
                    value={editedFields.Stage || ''}
                    onChange={e => handleFieldChange('Stage', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                {DEAL_FIELDS.filter(f => f !== 'Stage').map(f => renderSidebarField(f, getFieldValue(f)))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Statistics */}
          <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
              <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Statistics</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 border-t border-border pt-2">
                {renderSidebarField('Last Email Received', getFieldValue('Last Email Received') ? new Date(getFieldValue('Last Email Received')).toLocaleDateString('pt-PT') : null)}
                {renderSidebarField('Last Email Sent', getFieldValue('Last Email Sent') ? new Date(getFieldValue('Last Email Sent')).toLocaleDateString('pt-PT') : null)}
                {renderSidebarField('Time Since Last Email', daysSinceEmail !== null ? `${daysSinceEmail} dias` : null)}
                {renderSidebarField('Days on Stage', getFieldValue('Days on Stage'))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* System Info */}
          <Collapsible open={sysOpen} onOpenChange={setSysOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
              System Info
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sysOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 border-t border-border pt-2">
                {renderSidebarField('Updated', record.updatedAt ? new Date(record.updatedAt).toLocaleString('pt-PT') : null)}
                {renderSidebarField('Created', record.createdAt ? new Date(record.createdAt).toLocaleString('pt-PT') : null)}
                {renderSidebarField('Record ID', record.recordId)}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Save button */}
          {hasChanges() && (
            <Button size="sm" className="w-full" disabled={saving} onClick={handleSave}>
              <Save className="h-3 w-3 mr-1" />
              {saving ? 'A guardar...' : 'Guardar Alterações'}
            </Button>
          )}
        </div>

        {/* ─── MAIN CONTENT ─── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Tabs defaultValue="timeline" className="flex-1 flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 mb-3">
              <TabsList className="h-9">
                <TabsTrigger value="timeline" className="text-xs gap-1">
                  <Clock className="h-3 w-3" /> Timeline
                </TabsTrigger>
                <TabsTrigger value="fields" className="text-xs gap-1">
                  <Settings className="h-3 w-3" /> Todos os Campos
                </TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchAll}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
                </Button>
              </div>
            </div>

            {/* ── TIMELINE TAB ── */}
            <TabsContent value="timeline" className="flex-1 overflow-y-auto space-y-3 mt-0">
              {/* Add comment */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Adicionar comentário... Menciona colegas com @..."
                      className="text-sm min-h-[50px]"
                    />
                    <Button
                      size="sm"
                      disabled={!newComment.trim() || sendingComment}
                      onClick={handleAddComment}
                      className="self-end"
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline events */}
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sem eventos na timeline
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border" />

                  {timeline.map((event, idx) => {
                    // Date separator
                    const prevDate = idx > 0 ? new Date(timeline[idx - 1].date).toLocaleDateString('pt-PT') : null;
                    const eventDate = new Date(event.date).toLocaleDateString('pt-PT');
                    const showDateSep = eventDate !== prevDate;

                    return (
                      <div key={event.id}>
                        {showDateSep && (
                          <div className="flex justify-center py-2">
                            <span className="bg-muted text-muted-foreground text-[10px] px-3 py-0.5 rounded-full relative z-10">
                              {new Date(event.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                          </div>
                        )}
                        <div className="flex gap-3 py-2 pl-1">
                          <div className="w-9 h-9 rounded-full bg-muted/50 border border-border flex items-center justify-center flex-shrink-0 relative z-10">
                            {getEventIcon(event.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                {event.user && (
                                  <span className="text-[11px] font-semibold text-foreground">{event.user}</span>
                                )}
                                <p className="text-xs font-medium text-foreground">{event.title}</p>
                                {event.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{event.description}</p>
                                )}
                                {/* File link */}
                                {event.type === 'file' && event.meta?.url && (
                                  <a
                                    href={event.meta.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                  >
                                    <ExternalLink className="h-3 w-3" /> Abrir ficheiro
                                  </a>
                                )}
                                {/* Stage change details */}
                                {event.type === 'stage_change' && event.meta?.fieldActions && (
                                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                                    {Object.entries(event.meta.fieldActions).filter(([k]) => k !== 'Stage').map(([field, action]: [string, any]) => (
                                      <Badge key={field} variant="outline" className="text-[9px]">
                                        {field}: {action.remove ? `${action.remove} →` : ''} {action.add || ''}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                                {formatDate(event.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── ALL FIELDS TAB ── */}
            <TabsContent value="fields" className="flex-1 overflow-y-auto mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Todos os Campos</CardTitle>
                    {hasChanges() && (
                      <Button size="sm" disabled={saving} onClick={handleSave}>
                        <Save className="h-3 w-3 mr-1" />
                        {saving ? 'A guardar...' : 'Guardar'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {otherFields.map(fieldName => {
                    const value = editedFields[fieldName];
                    const isChanged = JSON.stringify(value) !== JSON.stringify(originalFields[fieldName]);
                    return (
                      <div key={fieldName} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 items-start">
                        <label className={`text-xs font-medium pt-2 ${isChanged ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {fieldName}{isChanged && ' •'}
                        </label>
                        {renderFieldInput(fieldName, value)}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );

  function renderFieldInput(fieldName: string, value: any) {
    if (value === null || value === undefined) {
      return <Input value="" onChange={e => handleFieldChange(fieldName, e.target.value)} className="text-sm h-9" placeholder="(vazio)" />;
    }
    if (typeof value === 'boolean') {
      return (
        <Button variant={value ? 'default' : 'outline'} size="sm" onClick={() => handleFieldChange(fieldName, !value)}>
          {value ? 'Sim' : 'Não'}
        </Button>
      );
    }
    if (Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {value.map((item, idx) => (
            <div key={idx} className="flex gap-1">
              <Input
                value={typeof item === 'string' ? item : JSON.stringify(item)}
                onChange={e => { const a = [...value]; a[idx] = e.target.value; handleFieldChange(fieldName, a); }}
                className="text-sm h-8"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleFieldChange(fieldName, [...value, ''])}>
            + Adicionar
          </Button>
        </div>
      );
    }
    if (typeof value === 'number') {
      return <Input type="number" value={value} onChange={e => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)} className="text-sm h-9" />;
    }
    const strValue = String(value);
    if (strValue.length > 100) {
      return <Textarea value={strValue} onChange={e => handleFieldChange(fieldName, e.target.value)} className="text-sm min-h-[80px]" />;
    }
    return <Input value={strValue} onChange={e => handleFieldChange(fieldName, e.target.value)} className="text-sm h-9" />;
  }
};

export default CRMRecordDetailPage;
