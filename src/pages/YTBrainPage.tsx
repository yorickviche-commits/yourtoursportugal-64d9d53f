import { useMemo, useState, DragEvent } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Brain, Plus, Search, Folder, FolderPlus, FileText, FileType2, Link2, Paperclip,
  LayoutGrid, List, MoreVertical, Trash2, RotateCcw, FolderInput, Clock, Files,
  Pencil, Loader2, Tags,
} from 'lucide-react';
import {
  BRAIN_LABEL, CONF_BADGE_CLASS, CONF_LABELS, STATUS_LABELS, categoryColorClass,
  type YtbConfidentiality, type YtbDocType, type YtbStatus,
} from '@/lib/ytBrain';
import {
  useBrainAccess, useYtbCategories, useYtbDocuments, useYtbFolders,
  useDocumentMutations, useFolderMutations, type YtbDocument, type YtbFolder,
} from '@/hooks/useYtBrain';
import AddDocumentDialog from '@/components/ytbrain/AddDocumentDialog';
import DocumentViewer from '@/components/ytbrain/DocumentViewer';
import FolderTreeSelect from '@/components/ytbrain/FolderTreeSelect';

type Scope = 'folder' | 'all' | 'recent' | 'trash';

const typeIcon = (t: YtbDocType) =>
  t === 'text' ? FileText : t === 'pdf' ? FileType2 : t === 'link' ? Link2 : Paperclip;

const YTBrainPage = () => {
  const { toast } = useToast();
  const { canEdit, isAdmin } = useBrainAccess();
  const [scope, setScope] = useState<Scope>('all');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [conf, setConf] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<'text' | 'file' | 'link'>('text');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<YtbDocument | null>(null);
  const [viewing, setViewing] = useState<YtbDocument | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ docs: string[] } | { folder: YtbFolder } | null>(null);
  const [moveDest, setMoveDest] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<YtbFolder | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');
  const [hardDeleteDoc, setHardDeleteDoc] = useState<YtbDocument | null>(null);

  const { data: folders = [], isLoading: foldersLoading } = useYtbFolders(scope === 'trash');
  const { data: categories = [] } = useYtbCategories();
  const filter = useMemo(() => ({
    scope, folderId,
    search,
    categoryId: categoryId === 'all' ? null : categoryId,
    confidentiality: conf === 'all' ? null : (conf as YtbConfidentiality),
    status: status === 'all' ? null : (status as YtbStatus),
    type: type === 'all' ? null : (type as YtbDocType),
  }), [scope, folderId, search, categoryId, conf, status, type]);
  const { data: docs = [], isLoading } = useYtbDocuments(filter);

  const folderMut = useFolderMutations();
  const docMut = useDocumentMutations();

  const activeFolders = folders.filter(f => (scope === 'trash' ? f.is_deleted : !f.is_deleted));
  const children = (parent: string | null) => activeFolders.filter(f => f.parent_folder_id === parent);

  const breadcrumbs = useMemo(() => {
    const path: YtbFolder[] = [];
    let cur = folders.find(f => f.id === folderId);
    while (cur) {
      path.unshift(cur);
      cur = folders.find(f => f.id === cur!.parent_folder_id);
    }
    return path;
  }, [folderId, folders]);

  const openFolder = (id: string | null) => { setScope('folder'); setFolderId(id); setSelected([]); };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setPendingFile(f); setEditing(null); setAddTab('file'); setAddOpen(true);
  };

  const doMove = async () => {
    if (!moveTarget) return;
    try {
      if ('docs' in moveTarget) await docMut.move.mutateAsync({ ids: moveTarget.docs, folder_id: moveDest });
      else await folderMut.update.mutateAsync({ id: moveTarget.folder.id, parent_folder_id: moveDest });
      toast({ title: 'Movido com sucesso' });
      setMoveTarget(null); setSelected([]);
    } catch (e: any) {
      toast({ title: 'Erro ao mover', description: e.message, variant: 'destructive' });
    }
  };

  const createFolder = async (parent: string | null) => {
    if (!newFolderName.trim()) return;
    await folderMut.create.mutateAsync({ name: newFolderName.trim(), parent_folder_id: parent });
    setNewFolderName(''); setNewFolderParent(undefined);
    toast({ title: 'Pasta criada' });
  };

  /* ── folder tree (left panel) ────────────────────────────────────── */
  const renderTree = (parent: string | null, depth = 0) =>
    children(parent).map(f => (
      <div key={f.id}>
        <div className={cn('group flex items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-muted',
          scope === 'folder' && folderId === f.id && 'bg-primary/10 text-primary font-medium')}
          style={{ paddingLeft: depth * 12 + 6 }}>
          <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            onClick={() => { openFolder(f.id); setExpanded(p => ({ ...p, [f.id]: !p[f.id] })); }}>
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{f.name}</span>
          </button>
          {canEdit && scope !== 'trash' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="opacity-0 group-hover:opacity-100"><MoreVertical className="h-3.5 w-3.5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setNewFolderParent(f.id); setNewFolderName(''); }}>
                  <FolderPlus className="mr-2 h-3.5 w-3.5" />Nova subpasta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRenaming(f); setRenameValue(f.name); }}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />Renomear
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMoveTarget({ folder: f }); setMoveDest(f.parent_folder_id); }}>
                  <FolderInput className="mr-2 h-3.5 w-3.5" />Mover
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive"
                  onClick={async () => { await folderMut.softDelete.mutateAsync(f.id); toast({ title: 'Pasta movida para o lixo' }); }}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" />Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {scope === 'trash' && canEdit && (
            <button title="Restaurar" onClick={() => folderMut.restore.mutateAsync(f.id)}>
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        {expanded[f.id] && renderTree(f.id, depth + 1)}
      </div>
    ));

  const shortcut = (label: string, icon: any, s: Scope) => {
    const Icon = icon;
    return (
      <button onClick={() => { setScope(s); setFolderId(null); setSelected([]); }}
        className={cn('flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-muted',
          scope === s && 'bg-primary/10 font-medium text-primary')}>
        <Icon className="h-3.5 w-3.5" />{label}
      </button>
    );
  };

  const DocBadges = ({ d }: { d: YtbDocument }) => (
    <div className="flex flex-wrap items-center gap-1">
      {categories.filter(c => d.category_ids?.includes(c.id)).map(c => (
        <Badge key={c.id} variant="outline" className={cn('text-[10px]', categoryColorClass(c.color))}>{c.name}</Badge>
      ))}
      <Badge variant="secondary" className={cn('text-[10px]', CONF_BADGE_CLASS[d.confidentiality])}>
        {CONF_LABELS[d.confidentiality]}
      </Badge>
      {d.status !== 'active' && <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[d.status]}</Badge>}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-4" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{BRAIN_LABEL}</h1>
          <span className="hidden text-sm text-muted-foreground md:inline">
            Base de conhecimento oficial · fonte de verdade da IA
          </span>
          {canEdit && (
            <Button className="ml-auto" onClick={() => { setEditing(null); setPendingFile(null); setAddTab('text'); setAddOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Adicionar
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {/* left panel */}
          <Card className="h-fit p-2">
            <div className="space-y-0.5">
              {shortcut('Todos os documentos', Files, 'all')}
              {shortcut('Recentes', Clock, 'recent')}
              {shortcut('Lixo', Trash2, 'trash')}
            </div>
            <div className="mt-3 border-t pt-2">
              <div className="mb-1 flex items-center justify-between px-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                Pastas
                {canEdit && scope !== 'trash' && (
                  <button title="Nova pasta na raiz" onClick={() => { setNewFolderParent(null); setNewFolderName(''); }}>
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {foldersLoading ? <Loader2 className="mx-auto my-3 h-4 w-4 animate-spin" /> : renderTree(null)}
              {newFolderParent !== undefined && (
                <div className="mt-1 flex gap-1 px-1">
                  <Input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createFolder(newFolderParent)}
                    placeholder="Nome" className="h-7 text-xs" />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => createFolder(newFolderParent)}>OK</Button>
                </div>
              )}
            </div>
          </Card>

          {/* main area */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar título, descrição ou conteúdo…" className="h-9 pl-8" />
              </div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={conf} onValueChange={setConf}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Confidencialidade</SelectItem>
                  {(Object.keys(CONF_LABELS) as YtbConfidentiality[]).map(k =>
                    <SelectItem key={k} value={k}>{CONF_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado</SelectItem>
                  {(Object.keys(STATUS_LABELS) as YtbStatus[]).map(k =>
                    <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tipo</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="file">Ficheiro</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-md border">
                <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-9 rounded-r-none"
                  onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
                <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-9 rounded-l-none"
                  onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* breadcrumbs */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <button className="hover:text-foreground" onClick={() => { setScope('all'); setFolderId(null); }}>
                {BRAIN_LABEL}
              </button>
              {scope === 'folder' && breadcrumbs.map(b => (
                <span key={b.id} className="flex items-center gap-1">
                  <span>/</span>
                  <button className="hover:text-foreground" onClick={() => openFolder(b.id)}>{b.name}</button>
                </span>
              ))}
              {scope === 'trash' && <span>/ Lixo</span>}
              {scope === 'recent' && <span>/ Recentes</span>}
            </div>

            {/* bulk actions */}
            {selected.length > 0 && canEdit && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
                <span className="font-medium">{selected.length} selecionado(s)</span>
                <Button size="sm" variant="outline" onClick={() => { setMoveTarget({ docs: selected }); setMoveDest(folderId); }}>
                  <FolderInput className="mr-1.5 h-3.5 w-3.5" />Mover
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline"><Tags className="mr-1.5 h-3.5 w-3.5" />Categorizar</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {categories.map(c => (
                      <DropdownMenuItem key={c.id} onClick={async () => {
                        await docMut.bulkCategorize.mutateAsync({ ids: selected, categoryIds: [c.id] });
                        toast({ title: 'Categoria aplicada' }); setSelected([]);
                      }}>{c.name}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {scope === 'trash' ? (
                  <Button size="sm" variant="outline" onClick={async () => {
                    await docMut.restore.mutateAsync(selected); setSelected([]); toast({ title: 'Restaurado' });
                  }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restaurar</Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={async () => {
                    await docMut.softDelete.mutateAsync(selected); setSelected([]); toast({ title: 'Movido para o lixo' });
                  }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar</Button>
                )}
              </div>
            )}

            {/* subfolders shown inside a folder */}
            {scope === 'folder' && children(folderId).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {children(folderId).map(f => (
                  <button key={f.id} onClick={() => openFolder(f.id)}
                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted">
                    <Folder className="h-4 w-4 text-muted-foreground" />{f.name}
                  </button>
                ))}
              </div>
            )}

            {/* documents */}
            {isLoading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : docs.length === 0 ? (
              <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <Brain className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {scope === 'trash' ? 'O lixo está vazio.' : 'Ainda não há documentos aqui.'}
                </p>
                {canEdit && scope !== 'trash' && (
                  <p className="text-xs text-muted-foreground">
                    Arrasta um ficheiro para aqui ou usa o botão “Adicionar”.
                  </p>
                )}
              </Card>
            ) : view === 'grid' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map(d => {
                  const Icon = typeIcon(d.type);
                  return (
                    <Card key={d.id} className="cursor-pointer p-3 transition hover:border-primary/40"
                      onClick={() => setViewing(d)}>
                      <div className="mb-1.5 flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="line-clamp-2 text-sm font-medium">{d.title}</span>
                      </div>
                      {d.description && <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>}
                      <DocBadges d={d} />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {new Date(d.updated_at).toLocaleDateString('pt-PT')}
                      </p>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="divide-y">
                {docs.map(d => {
                  const Icon = typeIcon(d.type);
                  return (
                    <div key={d.id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/40">
                      {canEdit && (
                        <Checkbox checked={selected.includes(d.id)}
                          onCheckedChange={v => setSelected(p => v ? [...p, d.id] : p.filter(x => x !== d.id))} />
                      )}
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <button className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => setViewing(d)}>
                        {d.title}
                      </button>
                      <div className="hidden md:block"><DocBadges d={d} /></div>
                      <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">
                        {new Date(d.updated_at).toLocaleDateString('pt-PT')}
                      </span>
                      {scope === 'trash' && isAdmin && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                          onClick={() => setHardDeleteDoc(d)}>Eliminar def.</Button>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* dialogs */}
      <AddDocumentDialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) { setEditing(null); setPendingFile(null); } }}
        currentFolderId={scope === 'folder' ? folderId : null} initialTab={addTab}
        pendingFile={pendingFile} editing={editing} />

      <DocumentViewer doc={viewing} onOpenChange={() => setViewing(null)}
        onEdit={d => { setViewing(null); setEditing(d); setAddOpen(true); }}
        onMove={d => { setViewing(null); setMoveTarget({ docs: [d.id] }); setMoveDest(d.folder_id); }}
        onDelete={async d => {
          await docMut.softDelete.mutateAsync([d.id]); setViewing(null); toast({ title: 'Movido para o lixo' });
        }} />

      <Dialog open={!!moveTarget} onOpenChange={() => setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover para…</DialogTitle></DialogHeader>
          <FolderTreeSelect folders={folders.filter(f => !f.is_deleted)} value={moveDest} onChange={setMoveDest} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>Cancelar</Button>
            <Button onClick={doMove}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={() => setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Renomear pasta</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (renaming) await folderMut.update.mutateAsync({ id: renaming.id, name: renameValue.trim() });
              setRenaming(null); toast({ title: 'Pasta renomeada' });
            }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hardDeleteDoc} onOpenChange={() => setHardDeleteDoc(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar definitivamente?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{hardDeleteDoc?.title}” e o respetivo ficheiro serão apagados de forma irreversível.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteDoc(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (hardDeleteDoc) await docMut.hardDelete.mutateAsync([hardDeleteDoc]);
              setHardDeleteDoc(null); toast({ title: 'Eliminado definitivamente' });
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default YTBrainPage;
