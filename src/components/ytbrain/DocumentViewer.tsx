import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Download, ExternalLink, Pencil, FolderInput, Trash2, Loader2, BrainCircuit, History, RotateCcw,
} from 'lucide-react';
import {
  BRAIN_BUCKET, CONF_BADGE_CLASS, CONF_LABELS, STATUS_LABELS, categoryColorClass,
} from '@/lib/ytBrain';
import {
  useBrainAccess, useYtbCategories, useYtbIndexState, useYtbVersions,
  useDocumentMutations, type YtbDocument,
} from '@/hooks/useYtBrain';

interface Props {
  doc: YtbDocument | null;
  onOpenChange: (v: boolean) => void;
  onEdit: (doc: YtbDocument) => void;
  onMove: (doc: YtbDocument) => void;
  onDelete: (doc: YtbDocument) => void;
}

const DocumentViewer = ({ doc, onOpenChange, onEdit, onMove, onDelete }: Props) => {
  const { canEdit } = useBrainAccess();
  const { toast } = useToast();
  const { data: categories = [] } = useYtbCategories();
  const { data: versions = [] } = useYtbVersions(doc?.id);
  const { data: chunkCount } = useYtbIndexState(doc?.id);
  const { update } = useDocumentMutations();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  useEffect(() => {
    setSignedUrl(null);
    if (!doc?.file_path) return;
    setLoadingUrl(true);
    supabase.storage.from(BRAIN_BUCKET).createSignedUrl(doc.file_path, 3600)
      .then(({ data }) => setSignedUrl(data?.signedUrl ?? null))
      .finally(() => setLoadingUrl(false));
  }, [doc?.file_path]);

  if (!doc) return null;
  const cats = categories.filter(c => doc.category_ids?.includes(c.id));

  const restoreVersion = async (v: any) => {
    await update.mutateAsync({ id: doc.id, title: v.title ?? doc.title, content: v.content, url: v.url });
    toast({ title: `Versão ${v.version_number} restaurada` });
  };

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 text-lg">{doc.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge className={CONF_BADGE_CLASS[doc.confidentiality]} variant="secondary">
            {CONF_LABELS[doc.confidentiality]}
          </Badge>
          {doc.status !== 'active' && <Badge variant="outline">{STATUS_LABELS[doc.status]}</Badge>}
          {cats.map(c => (
            <Badge key={c.id} variant="outline" className={categoryColorClass(c.color)}>{c.name}</Badge>
          ))}
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <BrainCircuit className="h-3.5 w-3.5" />
            {chunkCount ? 'Indexado para IA ✓' : 'a indexar…'}
          </span>
        </div>

        {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}

        <Separator />

        {doc.type === 'text' && (
          <div className="prose prose-sm max-w-none text-sm [&_*]:!font-sans"
            dangerouslySetInnerHTML={{ __html: doc.content ?? '' }} />
        )}

        {doc.type === 'pdf' && (
          loadingUrl ? <Loader2 className="h-5 w-5 animate-spin" />
            : signedUrl ? <iframe src={signedUrl} title={doc.title} className="h-[60vh] w-full rounded-md border" />
              : <p className="text-sm text-muted-foreground">Não foi possível abrir o ficheiro.</p>
        )}

        {doc.type === 'file' && (
          <Button variant="outline" size="sm" disabled={!signedUrl} asChild={!!signedUrl}>
            {signedUrl
              ? <a href={signedUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />{doc.file_name}</a>
              : <span><Download className="mr-2 h-4 w-4" />A preparar…</span>}
          </Button>
        )}

        {doc.type === 'link' && doc.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={doc.url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />{doc.url}
            </a>
          </Button>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => onEdit(doc)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />Editar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMove(doc)}>
              <FolderInput className="mr-2 h-3.5 w-3.5" />Mover
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(doc)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />Eliminar
            </Button>
          </div>
        )}

        <Separator />
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <History className="h-4 w-4" />Histórico de versões
          </h4>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem versões anteriores.</p>
          ) : (
            <div className="space-y-1">
              {versions.map(v => (
                <div key={v.id} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                  <span className="font-medium">v{v.version_number}</span>
                  <span className="truncate text-muted-foreground">{v.title}</span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(v.created_at).toLocaleString('pt-PT')}
                  </span>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                      onClick={() => restoreVersion(v)}>
                      <RotateCcw className="mr-1 h-3 w-3" />Restaurar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewer;
