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
import { ArrowLeft, ExternalLink, Save, RefreshCw, MessageSquare, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface NethuntRecord {
  id: string;
  recordId: string;
  createdAt?: string;
  updatedAt?: string;
  fields: Record<string, any>;
  link?: string;
}

interface NethuntComment {
  commentId: string;
  recordId: string;
  createdAt: string;
  text: string;
}

interface FieldMeta {
  name: string;
}

const CRMRecordDetailPage = () => {
  const { folderId, recordId } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState<NethuntRecord | null>(null);
  const [originalFields, setOriginalFields] = useState<Record<string, any>>({});
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [fieldMeta, setFieldMeta] = useState<FieldMeta[]>([]);
  const [comments, setComments] = useState<NethuntComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const fetchRecord = async () => {
    if (!folderId || !recordId) return;
    setLoading(true);
    try {
      // Fetch record, field schema, and comments in parallel
      const [recordRes, fieldsRes, commentsRes] = await Promise.all([
        supabase.functions.invoke('nethunt-proxy', {
          body: { action: 'find-record-by-id', folderId, recordId },
        }),
        supabase.functions.invoke('nethunt-proxy', {
          body: { action: 'folder-fields', folderId },
        }),
        supabase.functions.invoke('nethunt-proxy', {
          body: { action: 'recent-comments', folderId, limit: 50 },
        }),
      ]);

      if (recordRes.error) throw recordRes.error;
      if (recordRes.data?.error) throw new Error(recordRes.data.error);

      const records = Array.isArray(recordRes.data) ? recordRes.data : [];
      const rec = records.find((r: any) => r.recordId === recordId) || records[0];
      if (!rec) throw new Error('Registo não encontrado');

      setRecord(rec);
      setOriginalFields({ ...rec.fields });
      setEditedFields({ ...rec.fields });

      if (fieldsRes.data && !fieldsRes.data?.error) {
        setFieldMeta(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
      }

      if (commentsRes.data && !commentsRes.data?.error) {
        const allComments = Array.isArray(commentsRes.data) ? commentsRes.data : [];
        setComments(allComments.filter((c: any) => c.recordId === recordId));
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [folderId, recordId]);

  const hasChanges = () => {
    return JSON.stringify(editedFields) !== JSON.stringify(originalFields);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedFields(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSave = async () => {
    if (!record || !hasChanges()) return;
    setSaving(true);

    try {
      // Build fieldActions for changed fields
      const fieldActions: Record<string, any> = {};
      for (const [key, newValue] of Object.entries(editedFields)) {
        const oldValue = originalFields[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          fieldActions[key] = {
            overwrite: true,
            add: newValue,
          };
        }
      }

      const { data, error: fnError } = await supabase.functions.invoke('nethunt-proxy', {
        body: {
          action: 'update-record',
          recordId: record.recordId,
          fieldActions,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setOriginalFields({ ...editedFields });
      toast({ title: 'Guardado!', description: 'Alterações sincronizadas com NetHunt' });
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
        body: {
          action: 'create-comment',
          recordId: record.recordId,
          text: newComment,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setComments(prev => [
        { commentId: data.commentId || Date.now().toString(), recordId: record.recordId, createdAt: new Date().toISOString(), text: newComment },
        ...prev,
      ]);
      setNewComment('');
      toast({ title: 'Comentário adicionado' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSendingComment(false);
    }
  };

  const renderFieldInput = (fieldName: string, value: any) => {
    if (value === null || value === undefined) {
      return (
        <Input
          value=""
          onChange={e => handleFieldChange(fieldName, e.target.value)}
          className="text-sm h-9"
          placeholder="(vazio)"
        />
      );
    }

    if (typeof value === 'boolean') {
      return (
        <Button
          variant={value ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFieldChange(fieldName, !value)}
        >
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
                onChange={e => {
                  const newArr = [...value];
                  newArr[idx] = e.target.value;
                  handleFieldChange(fieldName, newArr);
                }}
                className="text-sm h-8"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const newArr = value.filter((_: any, i: number) => i !== idx);
                  handleFieldChange(fieldName, newArr);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => handleFieldChange(fieldName, [...value, ''])}
          >
            + Adicionar
          </Button>
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <Input
          type="number"
          value={value}
          onChange={e => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
          className="text-sm h-9"
        />
      );
    }

    // Long strings -> textarea
    const strValue = String(value);
    if (strValue.length > 100) {
      return (
        <Textarea
          value={strValue}
          onChange={e => handleFieldChange(fieldName, e.target.value)}
          className="text-sm min-h-[80px]"
        />
      );
    }

    return (
      <Input
        value={strValue}
        onChange={e => handleFieldChange(fieldName, e.target.value)}
        className="text-sm h-9"
      />
    );
  };

  const isFieldChanged = (fieldName: string) => {
    return JSON.stringify(editedFields[fieldName]) !== JSON.stringify(originalFields[fieldName]);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4 max-w-4xl mx-auto">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
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

  // Get all field names: from field meta + from record fields
  const allFieldNames = new Set<string>();
  fieldMeta.forEach(f => allFieldNames.add(f.name));
  Object.keys(editedFields).forEach(k => allFieldNames.add(k));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {editedFields.Name || editedFields.name || record.recordId}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {editedFields.Stage && (
                  <Badge variant="secondary" className="text-[10px]">{editedFields.Stage}</Badge>
                )}
                {record.createdAt && (
                  <span className="text-[10px] text-muted-foreground">
                    Criado: {new Date(record.createdAt).toLocaleDateString('pt-PT')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRecord}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
            </Button>
            {record.link && (
              <a href={record.link} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" /> NetHunt
                </Button>
              </a>
            )}
            <Button
              size="sm"
              disabled={!hasChanges() || saving}
              onClick={handleSave}
            >
              <Save className="h-3 w-3 mr-1" />
              {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        </div>

        {hasChanges() && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs p-2.5 rounded-md">
            ⚠️ Tens alterações por guardar. Clica "Guardar" para sincronizar com NetHunt.
          </div>
        )}

        {/* Fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Campos do Registo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...allFieldNames].map(fieldName => (
              <div key={fieldName} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 items-start">
                <label className={`text-xs font-medium pt-2 ${isFieldChanged(fieldName) ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {fieldName}
                  {isFieldChanged(fieldName) && ' •'}
                </label>
                {renderFieldInput(fieldName, editedFields[fieldName])}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Comentários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add comment */}
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Adicionar comentário..."
                className="text-sm min-h-[60px]"
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

            <Separator />

            {/* Comments list */}
            {comments.length > 0 ? (
              <div className="space-y-2">
                {comments.map(comment => (
                  <div key={comment.commentId} className="bg-muted/30 rounded-md p-2.5">
                    <p className="text-sm">{comment.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(comment.createdAt).toLocaleString('pt-PT')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem comentários</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CRMRecordDetailPage;
