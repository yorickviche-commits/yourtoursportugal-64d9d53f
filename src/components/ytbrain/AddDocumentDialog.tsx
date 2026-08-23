import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UploadCloud, FileText, Link2, Loader2 } from 'lucide-react';
import { RichHtmlEditor } from "@/components/communications/RichHtmlEditor";
import FolderTreeSelect from './FolderTreeSelect';
import {
  BRAIN_BUCKET, CONF_HELP, CONF_LABELS, STATUS_LABELS, categoryColorClass,
  type YtbConfidentiality, type YtbStatus,
} from '@/lib/ytBrain';
import {
  useYtbCategories, useYtbFolders, useDocumentMutations, type YtbDocument,
} from '@/hooks/useYtBrain';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentFolderId: string | null;
  initialTab?: 'text' | 'file' | 'link';
  pendingFile?: File | null;
  editing?: YtbDocument | null;
}

const AddDocumentDialog = ({ open, onOpenChange, currentFolderId, initialTab = 'text', pendingFile, editing }: Props) => {
  const { toast } = useToast();
  const { data: folders = [] } = useYtbFolders();
  const { data: categories = [] } = useYtbCategories();
  const { create, update } = useDocumentMutations();

  const [tab, setTab] = useState<'text' | 'file' | 'link'>(initialTab);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState<string | null>(currentFolderId);
  const [catIds, setCatIds] = useState<string[]>([]);
  const [confidentiality, setConfidentiality] = useState<YtbConfidentiality>('internal');
  const [status, setStatus] = useState<YtbStatus>('active');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTab(editing.type === 'link' ? 'link' : editing.type === 'text' ? 'text' : 'file');
      setTitle(editing.title);
      setContent(editing.content ?? '');
      setUrl(editing.url ?? '');
      setFolderId(editing.folder_id);
      setCatIds(editing.category_ids ?? []);
      setConfidentiality(editing.confidentiality);
      setStatus(editing.status);
      setTags((editing.tags ?? []).join(', '));
      setDescription(editing.description ?? '');
      setFile(null);
    } else {
      setTab(initialTab);
      setTitle(pendingFile?.name?.replace(/\.[^.]+$/, '') ?? '');
      setContent(''); setUrl(''); setFile(pendingFile ?? null);
      setFolderId(currentFolderId); setCatIds([]); setConfidentiality('internal');
      setStatus('active'); setTags(''); setDescription('');
    }
  }, [open, editing, pendingFile, initialTab, currentFolderId]);

  const toggleCat = (id: string) =>
    setCatIds(p => (p.includes(id) ? p.filter(c => c !== id) : [...p, id]));

  const save = async () => {
    if (!title.trim()) { toast({ title: 'Indica um título', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let file_path = editing?.file_path ?? null;
      let file_name = editing?.file_name ?? null;
      let file_size = editing?.file_size ?? null;
      let type: 'text' | 'pdf' | 'file' | 'link' = tab === 'text' ? 'text' : tab === 'link' ? 'link' : 'file';

      if (tab === 'file' && file) {
        const path = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
        const { error } = await supabase.storage.from(BRAIN_BUCKET).upload(path, file, { upsert: false });
        if (error) throw error;
        file_path = path; file_name = file.name; file_size = file.size;
        type = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdf' : 'file';
      } else if (tab === 'file' && editing) {
        type = editing.type;
      } else if (tab === 'file' && !file) {
        throw new Error('Seleciona um ficheiro.');
      }
      if (tab === 'link' && !url.trim()) throw new Error('Indica o URL.');

      const payload = {
        folder_id: folderId,
        title: title.trim(),
        type,
        content: tab === 'text' ? content : null,
        file_path, file_name, file_size,
        url: tab === 'link' ? url.trim() : null,
        description: description.trim() || null,
        status, confidentiality,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        category_ids: catIds,
      };

      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);

      toast({ title: editing ? 'Documento atualizado' : 'Documento adicionado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao guardar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar documento' : 'Adicionar ao YT Brain'}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="text" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Texto</TabsTrigger>
            <TabsTrigger value="file" className="gap-1.5"><UploadCloud className="h-3.5 w-3.5" />Ficheiro</TabsTrigger>
            <TabsTrigger value="link" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Link</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs">Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: SOP — Confirmação de reservas" />
          </div>

          <TabsContent value="text" className="mt-3">
            <Label className="text-xs">Conteúdo</Label>
            <RichHtmlEditor value={content} onChange={setContent} minHeight={220}
              placeholder="Escreve aqui o conhecimento (procedimento, regras, texto oficial)…" />
          </TabsContent>

          <TabsContent value="file" className="mt-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:border-primary/40">
              <UploadCloud className="h-6 w-6" />
              {file ? <span className="font-medium text-foreground">{file.name}</span>
                : editing?.file_name ? <span>Atual: {editing.file_name} — escolhe outro para substituir</span>
                  : <span>Arrasta ou clica para escolher (PDF, docx, imagens)</span>}
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </TabsContent>

          <TabsContent value="link" className="mt-3 space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
          </TabsContent>
        </Tabs>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Pasta de destino</Label>
            <FolderTreeSelect folders={folders} value={folderId} onChange={setFolderId} allowCreate />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categorias</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button key={c.id} type="button" onClick={() => toggleCat(c.id)}>
                    <Badge variant="outline"
                      className={`${categoryColorClass(c.color)} ${catIds.includes(c.id) ? 'ring-2 ring-primary/40' : 'opacity-60'}`}>
                      {c.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Confidencialidade</Label>
              <RadioGroup value={confidentiality} onValueChange={v => setConfidentiality(v as YtbConfidentiality)}
                className="flex gap-4">
                {(Object.keys(CONF_LABELS) as YtbConfidentiality[]).map(k => (
                  <div key={k} className="flex items-center gap-1.5">
                    <RadioGroupItem value={k} id={`conf-${k}`} />
                    <Label htmlFor={`conf-${k}`} className="text-xs font-normal">{CONF_LABELS[k]}</Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-[11px] text-muted-foreground">{CONF_HELP}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={status} onValueChange={v => setStatus(v as YtbStatus)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as YtbStatus[]).map(k => (
                      <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tags (vírgulas)</Label>
                <Input value={tags} onChange={e => setTags(e.target.value)} className="h-9" placeholder="porto, guias" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição curta</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Quando deve este documento ser usado?" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? 'Guardar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddDocumentDialog;
