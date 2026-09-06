import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { moduleLabel } from '@/lib/feedbackContext';
import { TYPE_LABELS, SEVERITY_LABELS, PRIORITY_LABELS, type FeedbackType, type FeedbackSeverity, type FeedbackPriority } from '@/lib/feedbackConstants';
import type { FeedbackOverviewRow, FeedbackComment, FeedbackAttachment } from '@/hooks/useFeedbackQuery';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: FeedbackOverviewRow;
  comments: FeedbackComment[];
  attachments: FeedbackAttachment[];
  onCopied?: () => void;
}

const LovablePromptDialog = ({ open, onOpenChange, item, comments, attachments, onCopied }: Props) => {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const internal = comments.filter(c => c.is_internal).map(c => `- ${c.author_name ?? 'admin'}: ${c.body}`).join('\n');
    return `## Correção / implementação — ${item.ref} · ${TYPE_LABELS[item.type as FeedbackType]} · ${moduleLabel(item.module!)}
**Título:** ${item.title}
**Reportado por:** ${item.reporter_name ?? '—'} em ${format(new Date(item.created_at!), 'dd/MM/yyyy HH:mm')} · gravidade ${item.severity ? SEVERITY_LABELS[item.severity as FeedbackSeverity] : '—'} · prioridade ${item.priority ? PRIORITY_LABELS[item.priority as FeedbackPriority] : '—'}
**Página:** ${item.page_route}  (URL: ${item.page_url})${item.lead_ref ? ` · Lead ${item.lead_ref}` : ''}
**Ambiente:** ${item.browser ?? '—'} · ${item.os ?? '—'} · viewport ${item.viewport ?? '—'} · app ${item.app_version ?? '—'}

### Descrição do reporter
${item.description}

### Anexos
${attachments.map(a => a.file_name).join(', ') || 'nenhum'} · Vídeo: ${item.video_url ?? 'nenhum'}

### Notas internas de triagem
${internal || 'nenhuma'}

### Instruções
- Reproduzir na página indicada antes de alterar código.
- Corrigir a causa, não o sintoma. Não alterar comportamento de outras páginas.
- Depois de corrigir, descrever em 3 linhas o que mudou para eu responder ao reporter.`;
  }, [item, comments, attachments]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Prompt copiado.');
    onCopied?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Prompt Lovable — {item.ref}</DialogTitle>
        </DialogHeader>
        <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-[11px] leading-relaxed">{text}</pre>
        <div className="flex justify-end">
          <Button size="sm" onClick={copy}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            Copiar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LovablePromptDialog;
