import { useRef, useState } from 'react';
import { Pencil, Trash2, Paperclip, Loader2, Save, Upload, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useItemNotesQuery, useCreateItemNote, useDeleteItemNote, useUpdateItemNote, DbItemNote } from '@/hooks/useItemNotesQuery';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface ItemNotesDialogProps {
  entityType: 'cost_item' | 'itinerary_item' | 'lead_cost_item' | 'lead_operation';
  entityId: string;
  label?: string;
}

const STORAGE_PREFIX = 'storage:item-notes/';

const errMsg = (e: any) => {
  const m = e?.message || String(e);
  if (/row-level security|permission denied/i.test(m)) return 'Sem permissão para gravar notas. Contacte um administrador.';
  return m;
};

const isValidUrl = (u: string) => {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; }
};

const openAttachment = async (url: string) => {
  if (url.startsWith(STORAGE_PREFIX)) {
    const { data, error } = await supabase.storage.from('item-notes').createSignedUrl(url.slice(STORAGE_PREFIX.length), 600);
    if (error || !data?.signedUrl) { toast({ title: 'Erro ao abrir anexo', description: errMsg(error), variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  } else window.open(url, '_blank', 'noopener,noreferrer');
};

const ItemNotesDialog = ({ entityType, entityId, label }: ItemNotesDialogProps) => {
  const { data: notes = [], isLoading } = useItemNotesQuery(entityType, entityId);
  const createNote = useCreateItemNote();
  const deleteNote = useDeleteItemNote();
  const updateNote = useUpdateItemNote();
  const [noteText, setNoteText] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveNote = async () => {
    if (!noteText.trim()) { toast({ title: 'Escreva uma nota primeiro' }); return; }
    try {
      await createNote.mutateAsync({ entity_type: entityType, entity_key: entityId, note_text: noteText.trim() });
      setNoteText('');
      toast({ title: 'Nota guardada' });
    } catch (e) { toast({ title: 'Erro ao guardar nota', description: errMsg(e), variant: 'destructive' }); }
  };

  const saveUrlAttachment = async () => {
    const url = attachUrl.trim();
    if (!url) { toast({ title: 'Indique o URL do anexo' }); return; }
    if (!isValidUrl(url)) { toast({ title: 'URL inválido', description: 'Use um endereço http(s):// completo.', variant: 'destructive' }); return; }
    try {
      await createNote.mutateAsync({ entity_type: entityType, entity_key: entityId, attachment_url: url, attachment_name: attachName.trim() || undefined });
      setAttachUrl(''); setAttachName('');
      toast({ title: 'Anexo adicionado' });
    } catch (e) { toast({ title: 'Erro ao adicionar anexo', description: errMsg(e), variant: 'destructive' }); }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${entityType}/${entityId.replace(/[^\w\-:]+/g, '_')}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from('item-notes').upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      await createNote.mutateAsync({ entity_type: entityType, entity_key: entityId, attachment_url: STORAGE_PREFIX + path, attachment_name: attachName.trim() || file.name });
      setAttachName('');
      toast({ title: 'Ficheiro carregado' });
    } catch (e) { toast({ title: 'Erro ao carregar ficheiro', description: errMsg(e), variant: 'destructive' }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const remove = async (note: DbItemNote) => {
    if (!window.confirm('Apagar esta nota/anexo?')) return;
    try {
      await deleteNote.mutateAsync({
        id: note.id, entityType, entityKey: entityId,
        storagePath: note.attachment_url?.startsWith(STORAGE_PREFIX) ? note.attachment_url.slice(STORAGE_PREFIX.length) : null,
      });
      toast({ title: 'Nota apagada' });
    } catch (e) { toast({ title: 'Erro ao apagar', description: errMsg(e), variant: 'destructive' }); }
  };

  const saveEdit = async (id: string) => {
    try {
      await updateNote.mutateAsync({ id, note_text: editText.trim(), entityType, entityKey: entityId });
      setEditingId(null);
      toast({ title: 'Nota atualizada' });
    } catch (e) { toast({ title: 'Erro ao editar', description: errMsg(e), variant: 'destructive' }); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-muted rounded relative" title="Notas & Anexos" aria-label="Notas & Anexos">
          <Pencil className={`h-3 w-3 ${notes.length ? 'text-[hsl(var(--info))]' : 'text-muted-foreground'}`} />
          {notes.length > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 bg-[hsl(var(--info))] rounded-full text-[8px] text-primary-foreground flex items-center justify-center font-bold">
              {notes.length}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Notas & Anexos{label ? ` — ${label}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 border-b pb-3">
          <Textarea
            placeholder="Escrever nota... (Ctrl/Cmd+Enter para guardar)"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNote(); } }}
            className="text-xs min-h-[60px]"
          />
          <Button size="sm" className="text-xs gap-1" onClick={saveNote} disabled={createNote.isPending || !noteText.trim()}>
            {createNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Guardar nota
          </Button>

          <div className="pt-2 space-y-2">
            <div className="flex gap-2">
              <Input placeholder="URL do anexo (https://...)" value={attachUrl} onChange={e => setAttachUrl(e.target.value)} className="h-7 text-xs flex-1" />
              <Input placeholder="Nome" value={attachName} onChange={e => setAttachName(e.target.value)} className="h-7 text-xs w-28" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={saveUrlAttachment} disabled={createNote.isPending || !attachUrl.trim()}>
                <Paperclip className="h-3 w-3" /> Adicionar anexo
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Carregar ficheiro
              </Button>
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sem notas</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="border rounded-md p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                    {note.author_name ? ` · ${note.author_name}` : ''}
                    {note.updated_at ? ' · editada' : ''}
                  </p>
                  <div className="flex gap-1">
                    {!note.attachment_url && editingId !== note.id && (
                      <button onClick={() => { setEditingId(note.id); setEditText(note.note_text || ''); }} className="p-1 hover:bg-muted rounded" aria-label="Editar nota">
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    <button onClick={() => remove(note)} className="p-1 hover:bg-muted rounded" aria-label="Apagar nota">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
                {editingId === note.id ? (
                  <div className="mt-1 space-y-1">
                    <Textarea value={editText} onChange={e => setEditText(e.target.value)} className="text-xs min-h-[50px]"
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(note.id); } }} />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => saveEdit(note.id)} disabled={!editText.trim() || updateNote.isPending}><Check className="h-3 w-3" />Guardar</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => setEditingId(null)}><X className="h-3 w-3" />Cancelar</Button>
                    </div>
                  </div>
                ) : note.note_text && <p className="text-xs mt-1 whitespace-pre-wrap">{note.note_text}</p>}
                {note.attachment_url && (
                  <button onClick={() => openAttachment(note.attachment_url!)} className="mt-2 text-xs text-[hsl(var(--info))] hover:underline flex items-center gap-1 text-left">
                    <Paperclip className="h-3 w-3" />{note.attachment_name || note.attachment_url}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ItemNotesDialog;
