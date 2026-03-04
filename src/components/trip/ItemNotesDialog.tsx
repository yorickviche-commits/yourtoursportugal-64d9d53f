import { useState } from 'react';
import { Pencil, Trash2, Paperclip, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useItemNotesQuery, useCreateItemNote, useDeleteItemNote } from '@/hooks/useItemNotesQuery';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface ItemNotesDialogProps {
  entityType: 'cost_item' | 'itinerary_item';
  entityId: string;
  label?: string;
}

const ItemNotesDialog = ({ entityType, entityId, label }: ItemNotesDialogProps) => {
  const { data: notes = [], isLoading } = useItemNotesQuery(entityType, entityId);
  const createNote = useCreateItemNote();
  const deleteNote = useDeleteItemNote();
  const [noteText, setNoteText] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [open, setOpen] = useState(false);

  const handleAdd = async () => {
    if (!noteText.trim() && !attachUrl.trim()) return;
    await createNote.mutateAsync({
      entity_type: entityType,
      entity_id: entityId,
      note_text: noteText.trim() || undefined,
      attachment_url: attachUrl.trim() || undefined,
      attachment_name: attachName.trim() || undefined,
    });
    setNoteText('');
    setAttachUrl('');
    setAttachName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-muted rounded relative" title="Notas & Anexos">
          <Pencil className="h-3 w-3 text-muted-foreground" />
          {notes.length > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-[hsl(var(--info))] rounded-full text-[8px] text-white flex items-center justify-center font-bold">
              {notes.length}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Notas & Anexos{label ? ` — ${label}` : ''}</DialogTitle>
        </DialogHeader>

        {/* Add note form */}
        <div className="space-y-2 border-b pb-3">
          <Textarea
            placeholder="Escrever nota..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            className="text-xs min-h-[60px]"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="URL do anexo (imagem/ficheiro)..."
                value={attachUrl}
                onChange={e => setAttachUrl(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <Input
              placeholder="Nome"
              value={attachName}
              onChange={e => setAttachName(e.target.value)}
              className="h-7 text-xs w-28"
            />
          </div>
          <Button size="sm" className="text-xs gap-1" onClick={handleAdd} disabled={createNote.isPending}>
            {createNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
            Adicionar
          </Button>
        </div>

        {/* Notes history */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sem notas</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="border rounded-md p-3 group relative">
                <div className="flex items-start justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: pt })}
                  </p>
                  <button
                    onClick={() => deleteNote.mutate({ id: note.id, entityType, entityId })}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
                {note.note_text && <p className="text-xs mt-1">{note.note_text}</p>}
                {note.attachment_url && (
                  <div className="mt-2">
                    {note.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={note.attachment_url} alt={note.attachment_name || 'Anexo'} className="max-h-40 rounded border" />
                    ) : (
                      <a href={note.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[hsl(var(--info))] hover:underline flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {note.attachment_name || 'Ver anexo'}
                      </a>
                    )}
                  </div>
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
