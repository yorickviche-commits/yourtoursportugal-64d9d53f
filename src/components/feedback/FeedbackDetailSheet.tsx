import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Copy, ExternalLink, Lock, Trash2, Wand2, Loader2, Save, Undo2, CheckCircle2, Video,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useInternalUsers } from '@/hooks/useInternalUsers';
import { useFeedbackDetail, useFeedbackList } from '@/hooks/useFeedbackQuery';
import {
  useAddFeedbackComment, useDeleteFeedback, useDeleteFeedbackAttachment, useUpdateFeedback,
} from '@/hooks/useFeedbackMutations';
import { moduleLabel, FEEDBACK_MODULES } from '@/lib/feedbackContext';
import {
  STATUS_LABELS, PRIORITY_LABELS, SEVERITY_LABELS, EFFORT_OPTIONS, BOARD_COLUMNS,
  type FeedbackStatus, type FeedbackPriority, type FeedbackSeverity, type FeedbackEffort, type FeedbackType,
} from '@/lib/feedbackConstants';
import { TypeBadge, StatusBadge, PriorityChip } from './FeedbackBadges';
import ImageLightbox from './ImageLightbox';
import LovablePromptDialog from './LovablePromptDialog';

interface Props {
  id: string | null;
  onClose: () => void;
  mode: 'admin' | 'reporter';
}

const videoEmbed = (url: string): string | null => {
  const loom = url.match(/loom\.com\/share\/([\w-]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const claap = url.match(/claap\.io\/[^/]+\/([\w-]+)/);
  if (claap) return url.replace('claap.io', 'claap.io/embed');
  return null;
};

const FeedbackDetailSheet = ({ id, onClose, mode }: Props) => {
  const { profile, hasRole } = useAuth();
  const { data, isLoading } = useFeedbackDetail(id);
  const { data: allItems = [] } = useFeedbackList();
  const { data: users = [] } = useInternalUsers();
  const update = useUpdateFeedback();
  const addComment = useAddFeedbackComment();
  const delAttachment = useDeleteFeedbackAttachment();
  const delFeedback = useDeleteFeedback();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(mode === 'admin');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveStatus, setResolveStatus] = useState<'done' | 'wont_fix'>('done');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  const item = data?.item ?? null;

  useEffect(() => {
    setTitle(item?.title ?? '');
    setDescription(item?.description ?? '');
  }, [item?.id, item?.title, item?.description]);

  if (!id) return null;

  const canEditContent = mode === 'admin' || item?.status === 'new';
  const isClosed = !!item && ['done', 'wont_fix', 'duplicate'].includes(item.status!);
  const images = (data?.attachments ?? []).map(a => ({
    url: data?.signedUrls[a.storage_path] ?? '',
    name: a.file_name,
    id: a.id,
    path: a.storage_path,
  })).filter(i => i.url);
  const visibleComments = (data?.comments ?? []);
  const duplicates = allItems.filter(f => f.duplicate_of === id);
  const original = item?.duplicate_of ? allItems.find(f => f.id === item.duplicate_of) : null;

  const patch = (p: Record<string, any>) => {
    if (!id) return;
    update.mutate({ id, patch: p }, {
      onError: e => toast.error(e.message),
      onSuccess: () => toast.success('Atualizado.'),
    });
  };

  const saveContent = () => {
    if (title.trim().length < 3) { toast.error('O título precisa de pelo menos 3 caracteres.'); return; }
    patch({ title: title.trim(), description: description.trim() });
  };

  const context: [string, string | null | undefined][] = item ? [
    ['Rota', item.page_route],
    ['URL', item.page_url],
    ['Título da página', item.page_title],
    ['Lead', item.lead_ref],
    ['Browser', item.browser],
    ['Sistema', item.os],
    ['Ecrã', item.screen],
    ['Viewport', item.viewport],
    ['Versão da app', item.app_version],
    ['Idioma', item.locale],
    ['Fuso', item.timezone],
    ['User agent', item.user_agent],
  ] : [];

  return (
    <Sheet open={!!id} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-4">
        {isLoading || !item ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(item.ref!); toast.success('Referência copiada.'); }}
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                  title="Copiar referência"
                >
                  {item.ref} <Copy className="h-3 w-3" />
                </button>
                <TypeBadge type={item.type as FeedbackType} />
                <StatusBadge status={item.status as FeedbackStatus} />
                <PriorityChip priority={item.priority as FeedbackPriority | null} />
                <span className="text-[11px] text-muted-foreground">{format(new Date(item.created_at!), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              <SheetTitle className="sr-only">Reporte {item.ref}</SheetTitle>
              {canEditContent ? (
                <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={140} className="h-9 text-sm font-medium" />
              ) : (
                <p className="text-sm font-medium">{item.title}</p>
              )}
            </SheetHeader>

            {mode === 'admin' && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Estado</Label>
                  <Select value={item.status!} onValueChange={v => patch({ status: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOARD_COLUMNS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Prioridade</Label>
                  <Select value={item.priority ?? 'none'} onValueChange={v => patch({ priority: v === 'none' ? null : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">—</SelectItem>
                      {(['p0', 'p1', 'p2', 'p3'] as FeedbackPriority[]).map(p => (
                        <SelectItem key={p} value={p} className="text-xs">{PRIORITY_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Responsável</Label>
                  <Select value={item.assignee_id ?? 'none'} onValueChange={v => patch({ assignee_id: v === 'none' ? null : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">—</SelectItem>
                      {users.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Release-alvo</Label>
                  <Input
                    className="h-8 text-xs"
                    defaultValue={item.target_release ?? ''}
                    onBlur={e => { if (e.target.value !== (item.target_release ?? '')) patch({ target_release: e.target.value || null }); }}
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Esforço</Label>
                  <Select value={item.effort ?? 'none'} onValueChange={v => patch({ effort: v === 'none' ? null : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">—</SelectItem>
                      {EFFORT_OPTIONS.map(e => <SelectItem key={e} value={e} className="text-xs">{e.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Etiquetas</Label>
                  <Input
                    className="h-8 text-xs"
                    defaultValue={(item.tags ?? []).join(', ')}
                    placeholder="separadas por vírgula"
                    onBlur={e => {
                      const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                      if (tags.join(',') !== (item.tags ?? []).join(',')) patch({ tags });
                    }}
                  />
                </div>
              </div>
            )}

            <Tabs defaultValue="detail" className="mt-4">
              <TabsList className="h-8">
                <TabsTrigger value="detail" className="text-xs">Detalhe</TabsTrigger>
                <TabsTrigger value="comments" className="text-xs">Comentários ({visibleComments.length})</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
                <TabsTrigger value="dupes" className="text-xs">Duplicados</TabsTrigger>
              </TabsList>

              <TabsContent value="detail" className="space-y-3 pt-3">
                {canEditContent ? (
                  <>
                    <Textarea rows={7} className="text-sm" value={description} onChange={e => setDescription(e.target.value)} />
                    <Button size="sm" variant="outline" onClick={saveContent}>
                      <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar alterações
                    </Button>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{item.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {item.severity && <span>Gravidade: {SEVERITY_LABELS[item.severity as FeedbackSeverity]}</span>}
                  {mode === 'admin' ? (
                    <span className="flex items-center gap-1">
                      Módulo:
                      <Select value={item.module!} onValueChange={v => patch({ module: v })}>
                        <SelectTrigger className="h-7 w-56 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FEEDBACK_MODULES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </span>
                  ) : <span>Módulo: {moduleLabel(item.module!)}</span>}
                </div>

                {images.length > 0 && (
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Imagens</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {images.map((img, i) => (
                        <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded border border-border">
                          <button onClick={() => setLightbox(i)} className="h-full w-full">
                            <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                          </button>
                          {(mode === 'admin' || item.status === 'new') && (
                            <button
                              aria-label={`Apagar ${img.name}`}
                              onClick={() => delAttachment.mutate({ id: img.id, storagePath: img.path, feedbackId: item.id! })}
                              className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.video_url && (
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Vídeo</Label>
                    {videoEmbed(item.video_url) ? (
                      <iframe
                        src={videoEmbed(item.video_url)!}
                        title="Vídeo do reporte"
                        className="mt-1 aspect-video w-full rounded border border-border"
                        allowFullScreen
                      />
                    ) : (
                      <a href={item.video_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <Video className="h-3.5 w-3.5" /> {item.video_url}
                      </a>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase text-muted-foreground">Contexto técnico</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                      onClick={() => {
                        navigator.clipboard.writeText(context.map(([k, v]) => `${k}: ${v ?? '—'}`).join('\n'));
                        toast.success('Contexto copiado.');
                      }}>
                      <Copy className="mr-1 h-3 w-3" /> copiar contexto
                    </Button>
                  </div>
                  <div className="mt-1 divide-y divide-border rounded border border-border text-[11px]">
                    {context.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-3 gap-2 px-2 py-1">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="col-span-2 break-all">{v ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  <a href={item.page_url!} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir a página onde foi reportado
                  </a>
                  {item.lead_ref && (
                    <Link to="/leads" className="text-primary hover:underline">Ver leads ({item.lead_ref})</Link>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="comments" className="space-y-3 pt-3">
                <div className="space-y-2">
                  {visibleComments.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários.</p>}
                  {visibleComments.map(c => (
                    <div key={c.id} className={`rounded-md border p-2 text-xs ${c.is_internal ? 'border-amber-200 bg-amber-50' : 'border-border bg-card'}`}>
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {c.is_internal && <Lock className="h-3 w-3" />}
                        <span className="font-medium">{c.author_name ?? 'Utilizador'}</span>
                        <span>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Textarea rows={3} className="text-sm" placeholder="Escrever comentário…" value={comment} onChange={e => setComment(e.target.value)} />
                  <div className="flex items-center justify-between">
                    {mode === 'admin' ? (
                      <label className="flex items-center gap-2 text-xs">
                        <Switch checked={internal} onCheckedChange={setInternal} />
                        Nota interna
                      </label>
                    ) : <span className="text-[11px] text-muted-foreground">Visível para a equipa.</span>}
                    <Button size="sm" disabled={!comment.trim() || addComment.isPending}
                      onClick={() => addComment.mutate(
                        { feedbackId: item.id!, body: comment.trim(), isInternal: mode === 'admin' ? internal : false },
                        { onSuccess: () => setComment(''), onError: e => toast.error(e.message) },
                      )}>
                      Comentar
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="pt-3">
                <ol className="space-y-2 text-xs">
                  {(data?.events ?? []).map(e => (
                    <li key={e.id} className="flex gap-2 border-l-2 border-border pl-2">
                      <span className="text-muted-foreground">{format(new Date(e.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      <span className="font-medium">{e.event_type}</span>
                      {(e.from_value || e.to_value) && <span className="text-muted-foreground">{e.from_value ?? '—'} → {e.to_value ?? '—'}</span>}
                      {e.actor_name && <span className="ml-auto text-muted-foreground">{e.actor_name}</span>}
                    </li>
                  ))}
                  {(data?.events ?? []).length === 0 && <li className="text-muted-foreground">Sem eventos.</li>}
                </ol>
              </TabsContent>

              <TabsContent value="dupes" className="space-y-3 pt-3 text-xs">
                {original && (
                  <p>Duplicado de <span className="font-mono">{original.ref}</span> — {original.title}</p>
                )}
                {duplicates.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium">Itens duplicados deste ({duplicates.length}):</p>
                    <ul className="space-y-1">
                      {duplicates.map(d => <li key={d.id}><span className="font-mono">{d.ref}</span> — {d.title} · 👍 {d.votes ?? 0}</li>)}
                    </ul>
                  </div>
                )}
                {mode === 'admin' && (
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Marcar como duplicado de</Label>
                    <Select value={item.duplicate_of ?? 'none'} onValueChange={v => patch(v === 'none' ? { duplicate_of: null } : { duplicate_of: v, status: 'duplicate' })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolher reporte" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">— nenhum</SelectItem>
                        {allItems.filter(f => f.id !== item.id).slice(0, 100).map(f => (
                          <SelectItem key={f.id} value={f.id!} className="text-xs">{f.ref} — {f.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {mode === 'admin' && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {!isClosed ? (
                  <Button size="sm" onClick={() => { setResolveNote(''); setResolveStatus('done'); setResolveOpen(true); }}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolver
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => patch({ status: 'in_progress' })}>
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Reabrir
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setPromptOpen(true)}>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Gerar prompt Lovable
                </Button>
                {hasRole('super_admin') && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setConfirmDelete(''); setDeleteOpen(true); }}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Apagar
                  </Button>
                )}
              </div>
            )}

            <ImageLightbox urls={images} index={lightbox} onClose={() => setLightbox(null)} />

            <LovablePromptDialog
              open={promptOpen}
              onOpenChange={setPromptOpen}
              item={item}
              comments={data?.comments ?? []}
              attachments={data?.attachments ?? []}
              onCopied={() => addComment.mutate({
                feedbackId: item.id!,
                body: `Prompt Lovable gerado por ${profile?.full_name ?? 'admin'}.`,
                isInternal: true,
              })}
            />

            <AlertDialog open={resolveOpen} onOpenChange={setResolveOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Resolver {item.ref}</AlertDialogTitle>
                  <AlertDialogDescription>A nota é enviada ao reporter na notificação.</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Textarea rows={3} className="text-sm" placeholder="Nota de resolução *" value={resolveNote} onChange={e => setResolveNote(e.target.value)} />
                  <Select value={resolveStatus} onValueChange={v => setResolveStatus(v as 'done' | 'wont_fix')}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="done" className="text-xs">Concluído</SelectItem>
                      <SelectItem value="wont_fix" className="text-xs">Não fazer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!resolveNote.trim()}
                    onClick={() => patch({ status: resolveStatus, resolution_note: resolveNote.trim() })}
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar {item.ref}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é permanente. Escreve <span className="font-mono">{item.ref}</span> para confirmar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input className="h-8 text-xs" value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmDelete !== item.ref}
                    onClick={() => delFeedback.mutate(item.id!, {
                      onSuccess: () => { toast.success('Reporte apagado.'); onClose(); },
                      onError: e => toast.error(e.message),
                    })}
                  >
                    Apagar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default FeedbackDetailSheet;
