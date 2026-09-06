import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useCreateFeedback } from '@/hooks/useFeedbackMutations';
import { useFeedbackHint } from './FeedbackProvider';
import FeedbackTypeCards from './FeedbackTypeCards';
import ImageDropzone from './ImageDropzone';
import ContextBar from './ContextBar';
import { TypeBadge } from './FeedbackBadges';
import {
  captureContext, resolveModule, FEEDBACK_MODULES, type FeedbackModule, type CapturedContext,
} from '@/lib/feedbackContext';
import {
  DESCRIPTION_PLACEHOLDERS, DRAFT_STORAGE_KEY, SEVERITY_LABELS,
  type FeedbackSeverity, type FeedbackType,
} from '@/lib/feedbackConstants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Draft {
  type: FeedbackType | null;
  title: string;
  description: string;
  severity: FeedbackSeverity;
  module: FeedbackModule;
  videoUrl: string;
}

const emptyDraft = (module: FeedbackModule): Draft => ({
  type: null, title: '', description: '', severity: 'medium', module, videoUrl: '',
});

const FeedbackDialog = ({ open, onOpenChange }: Props) => {
  const location = useLocation();
  const { user, profile, roleCodes } = useAuth();
  const hint = useFeedbackHint();
  const create = useCreateFeedback();

  const autoModule = hint.module ?? resolveModule(location.pathname);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(autoModule));
  const [files, setFiles] = useState<File[]>([]);
  const [ctx, setCtx] = useState<CapturedContext | null>(null);
  const [askRestore, setAskRestore] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  const dirty = !!(draft.title.trim() || draft.description.trim() || files.length || draft.videoUrl.trim());

  useEffect(() => {
    if (!open) {
      setAskDiscard(false);
      setAskRestore(false);
      return;
    }
    setCtx(captureContext(hint.leadRef));
    const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    setDraft(emptyDraft(autoModule));
    setAskRestore(!!stored);
    setAskDiscard(false);
    setFiles([]);
    // garante que nenhum modal anterior deixou a página sem cliques
    document.body.style.pointerEvents = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !dirty) return;
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [open, dirty, draft]);

  const valid = useMemo(
    () => !!draft.type && draft.title.trim().length >= 3 && draft.title.length <= 140
      && draft.description.trim().length >= 10
      && (!draft.videoUrl.trim() || /^https?:\/\//i.test(draft.videoUrl.trim())),
    [draft],
  );

  const close = (force = false) => {
    if (!force && dirty) { setAskDiscard(true); return; }
    onOpenChange(false);
  };

  const submit = async () => {
    if (!valid || !ctx || !user) return;
    try {
      const res = await create.mutateAsync({
        payload: {
          type: draft.type!,
          title: draft.title.trim(),
          description: draft.description.trim(),
          severity: draft.type === 'bug' ? draft.severity : null,
          module: draft.module,
          video_url: draft.videoUrl.trim() || null,
          page_url: ctx.page_url,
          page_route: ctx.page_route,
          page_title: ctx.page_title,
          lead_ref: ctx.lead_ref,
          user_agent: ctx.user_agent,
          browser: ctx.browser,
          os: ctx.os,
          screen: ctx.screen,
          viewport: ctx.viewport,
          app_version: ctx.app_version,
          locale: ctx.locale,
          timezone: ctx.timezone,
          reported_by: user.id,
          reporter_name: profile?.full_name ?? null,
          reporter_email: profile?.email ?? null,
          reporter_roles: roleCodes,
        },
        files,
      });

      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      onOpenChange(false);
      if (res.failed.length) {
        toast.warning(`Reporte ${res.ref} criado, mas falhou o envio de: ${res.failed.join(', ')}`);
      }
      toast.success(`Reporte ${res.ref} enviado. Obrigado!`, {
        action: { label: 'Ver', onClick: () => { window.location.href = `/my-feedback?open=${res.id}`; } },
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível enviar o reporte.');
    }
  };

  const reporterName = profile?.full_name || profile?.email || 'Utilizador';

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) close(); else onOpenChange(true); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" onEscapeKeyDown={e => { if (dirty) { e.preventDefault(); setAskDiscard(true); } }}>
          <DialogHeader>
            <DialogTitle className="text-base">
              {draft.type ? 'Descreve o que se passa' : 'O que queres reportar?'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {draft.type
                ? 'O contexto técnico da página é enviado automaticamente.'
                : 'Escolhe o tipo de reporte para continuar.'}
            </DialogDescription>
          </DialogHeader>

          {!draft.type ? (
            <FeedbackTypeCards onSelect={t => setDraft(d => ({ ...d, type: t }))} />
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setDraft(d => ({ ...d, type: null }))}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                <TypeBadge type={draft.type} />
                <span>mudar tipo</span>
              </button>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="fb-title" className="text-xs">Título *</Label>
                  <span className="text-[10px] text-muted-foreground">{draft.title.length}/140</span>
                </div>
                <Input
                  id="fb-title"
                  className="h-9 text-sm"
                  maxLength={140}
                  value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="Resume o problema numa frase"
                />
              </div>

              <div>
                <Label htmlFor="fb-desc" className="text-xs">Descrição *</Label>
                <Textarea
                  id="fb-desc"
                  rows={6}
                  className="text-sm"
                  value={draft.description}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder={DESCRIPTION_PLACEHOLDERS[draft.type]}
                />
              </div>

              {draft.type === 'bug' && (
                <div>
                  <Label className="text-xs">Gravidade</Label>
                  <RadioGroup
                    value={draft.severity}
                    onValueChange={v => setDraft(d => ({ ...d, severity: v as FeedbackSeverity }))}
                    className="mt-1 flex flex-wrap gap-3"
                  >
                    {(['blocker', 'high', 'medium', 'low'] as FeedbackSeverity[]).map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-xs">
                        <RadioGroupItem value={s} id={`sev-${s}`} />
                        {SEVERITY_LABELS[s]}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <div>
                <Label className="text-xs">Módulo *</Label>
                <Select value={draft.module} onValueChange={v => setDraft(d => ({ ...d, module: v as FeedbackModule }))}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_MODULES.map(m => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Imagens</Label>
                <ImageDropzone files={files} onChange={setFiles} pasteEnabled={open} />
              </div>

              <div>
                <Label htmlFor="fb-video" className="text-xs">Link de vídeo (opcional)</Label>
                <div className="relative mt-1">
                  <Input
                    id="fb-video"
                    className="h-9 text-sm pr-8"
                    value={draft.videoUrl}
                    onChange={e => setDraft(d => ({ ...d, videoUrl: e.target.value }))}
                    placeholder="Claap, Loom, Google Drive…"
                  />
                  {/claap|loom/i.test(draft.videoUrl) && (
                    <Video className="absolute right-2 top-2.5 h-4 w-4 text-emerald-600" />
                  )}
                </div>
              </div>

              {ctx && <ContextBar ctx={ctx} reporterName={reporterName} roles={roleCodes} />}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => close()}>Cancelar</Button>
                <Button size="sm" disabled={!valid || create.isPending} onClick={submit}>
                  {create.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Enviar reporte
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={askRestore} onOpenChange={setAskRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recuperar rascunho?</AlertDialogTitle>
            <AlertDialogDescription>Encontrámos um reporte que começaste e não enviaste.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { sessionStorage.removeItem(DRAFT_STORAGE_KEY); setDraft(emptyDraft(autoModule)); }}>
              Começar de novo
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
              if (stored) { try { setDraft({ ...emptyDraft(autoModule), ...JSON.parse(stored) }); } catch { /* ignora */ } }
            }}>
              Recuperar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askDiscard} onOpenChange={setAskDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar sem enviar?</AlertDialogTitle>
            <AlertDialogDescription>O rascunho fica guardado nesta sessão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar a escrever</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setAskDiscard(false); onOpenChange(false); }}>Fechar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FeedbackDialog;
