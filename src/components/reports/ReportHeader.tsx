import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  BookmarkPlus, Copy, GripVertical, Link2, Lock, Pencil, Play, Save, Settings2, Trash2, X, Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedReports, useSavedReportMutations } from '@/hooks/useSavedReports';
import { encodeDefinition } from '@/lib/reports/runReport';
import {
  SAVED_REPORT_CATEGORIES, type ReportDefinition, type SavedReport, type SavedReportCategory,
} from '@/types/reports';

interface Props {
  selected: SavedReport | null;
  definition: ReportDefinition;
  ranAt: Date | null;
  running: boolean;
  onToggleBuilder: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  onSelect: (r: SavedReport) => void;
  onNew: () => void;
}

function relativeTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'há segundos';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export default function ReportHeader({
  selected, definition, ranAt, running,
  onToggleBuilder, onGenerate, onCancel, onSelect, onNew,
}: Props) {
  const { user, isAdmin } = useAuth();
  const { data: saved } = useSavedReports('files');
  const { create, update, remove, reorder } = useSavedReportMutations('files');

  const [dialog, setDialog] = useState<null | 'new' | 'edit' | 'reorder'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<SavedReportCategory>('Performance');
  const [visibility, setVisibility] = useState<'private' | 'team'>('private');
  const [updateDef, setUpdateDef] = useState(true);
  const [tick, setTick] = useState(0);
  const [orderList, setOrderList] = useState<SavedReport[]>([]);

  useEffect(() => {
    const t = window.setInterval(() => setTick(x => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const mine = useMemo(
    () => (saved || []).filter(r => !r.is_suggested && (r.owner_id === user?.id || isAdmin)),
    [saved, user?.id, isAdmin]
  );

  const canEditSelected = !!selected && (!selected.is_suggested) && (selected.owner_id === user?.id || isAdmin);

  const openNew = (copy = false) => {
    setName(copy && selected ? `${selected.name} (cópia)` : selected?.name ? `${selected.name} (cópia)` : 'Novo relatório');
    setNote(selected?.note || '');
    setCategory((selected?.category as SavedReportCategory) || 'Performance');
    setVisibility('private');
    setDialog('new');
  };

  const openEdit = () => {
    if (!selected) return;
    setName(selected.name);
    setNote(selected.note || '');
    setCategory(selected.category);
    setVisibility(selected.visibility);
    setUpdateDef(false);
    setDialog('edit');
  };

  const openReorder = () => {
    setOrderList(mine.slice().sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
    setDialog('reorder');
  };

  const submitNew = async () => {
    try {
      const r = await create.mutateAsync({ name: name.trim() || 'Sem nome', note, category, visibility, definition });
      toast.success('Relatório guardado');
      setDialog(null);
      onSelect(r);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível guardar');
    }
  };

  const submitEdit = async () => {
    if (!selected) return;
    try {
      const r = await update.mutateAsync({
        id: selected.id, name: name.trim() || selected.name, note, category, visibility,
        definition, updateDefinition: updateDef,
      });
      toast.success('Relatório atualizado');
      setDialog(null);
      onSelect(r);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível atualizar');
    }
  };

  const submitDelete = async () => {
    if (!selected) return;
    try {
      await remove.mutateAsync(selected.id);
      toast.success('Relatório apagado');
      setConfirmDelete(false);
      onNew();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível apagar');
    }
  };

  const onDragEnd = async (res: DropResult) => {
    if (!res.destination) return;
    const next = orderList.slice();
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    setOrderList(next);
    try {
      await reorder.mutateAsync(next.map((r, i) => ({ id: r.id, sort_order: (i + 1) * 10 })));
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível reordenar');
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/reports#d=${encodeDefinition(definition)}`;
    try {
      await navigator.clipboard.writeText(url);
      window.location.hash = `d=${encodeDefinition(definition)}`;
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  return (
    <div className="border border-border rounded-lg bg-card p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold truncate">{selected?.name || 'Novo relatório (Files)'}</h2>
            {selected?.is_suggested && (
              <Badge variant="secondary" className="text-[9px] gap-1"><Lock className="h-2.5 w-2.5" /> fábrica</Badge>
            )}
          </div>
          {selected?.note && <p className="text-[11px] text-muted-foreground mt-0.5">{selected.note}</p>}
          {ranAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5" data-tick={tick}>
              Relatório atualizado {relativeTime(ranAt)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onToggleBuilder}>
            <Settings2 className="h-3 w-3 mr-1" /> Avançado
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copyLink}>
            <Link2 className="h-3 w-3 mr-1" /> Copiar link
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">Relatórios guardados</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs">Gerir</DropdownMenuLabel>
              <DropdownMenuItem className="text-xs" onClick={() => openNew(false)}>
                <BookmarkPlus className="h-3 w-3 mr-2" /> Novo relatório guardado
              </DropdownMenuItem>
              {selected?.is_suggested && (
                <DropdownMenuItem className="text-xs" onClick={() => openNew(true)}>
                  <Copy className="h-3 w-3 mr-2" /> Guardar como cópia
                </DropdownMenuItem>
              )}
              {canEditSelected && (
                <>
                  <DropdownMenuItem className="text-xs" onClick={openEdit}>
                    <Pencil className="h-3 w-3 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3 w-3 mr-2" /> Apagar
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={openReorder} disabled={!mine.length}>
                <GripVertical className="h-3 w-3 mr-2" /> Reordenar os meus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {running ? (
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onCancel}>
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white"
              onClick={onGenerate}
            >
              <Play className="h-3 w-3 mr-1" /> Gerar
            </Button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={dialog === 'new' || dialog === 'edit'} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dialog === 'new' ? 'Novo relatório guardado' : 'Editar relatório'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Nome</label>
              <Input className="h-8 text-xs mt-1" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Nota</label>
              <Textarea className="text-xs mt-1" rows={2} value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Categoria</label>
                <Select value={category} onValueChange={v => setCategory(v as SavedReportCategory)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SAVED_REPORT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Visibilidade</label>
                <Select value={visibility} onValueChange={v => setVisibility(v as 'private' | 'team')}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Privado</SelectItem>
                    <SelectItem value="team">Equipa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {dialog === 'edit' && (
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={updateDef} onCheckedChange={v => setUpdateDef(!!v)} />
                Atualizar para as definições atuais
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={dialog === 'new' ? submitNew : submitEdit}
              disabled={create.isPending || update.isPending}
            >
              {(create.isPending || update.isPending) ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'reorder'} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Reordenar relatórios</DialogTitle></DialogHeader>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="saved-order">
              {prov => (
                <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-1">
                  {orderList.map((r, i) => (
                    <Draggable key={r.id} draggableId={r.id} index={i}>
                      {(p, snap) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          className={cn('flex items-center gap-2 border border-border rounded px-2 py-1.5 bg-card text-xs', snap.isDragging && 'shadow')}
                        >
                          <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-3 w-3" /></span>
                          <span className="truncate">{r.name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">{r.category}</span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {prov.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <DialogFooter>
            <Button size="sm" className="h-7 text-xs" onClick={() => setDialog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Apagar relatório «{selected?.name}»?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta ação não pode ser revertida. O relatório guardado será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={e => { e.preventDefault(); void submitDelete(); }}
              disabled={remove.isPending}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
