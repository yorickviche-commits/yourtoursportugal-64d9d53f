import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { usePaymentLinks, usePublishPaymentLink, useSetPaymentLinkActive } from '@/hooks/usePaymentLinksQuery';
import { cn } from '@/lib/utils';

const statusLabel: Record<string, { label: string; cls: string }> = {
  published: { label: 'Publicado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  draft: { label: 'Publicação pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  failed: { label: 'Falhou', cls: 'bg-destructive/10 text-destructive' },
};

const fmtDate = (d?: string | null) =>
  d ? d.split('-').reverse().join('/') : '—';

interface Props {
  leadId: string;
}

const PaymentLinksList = ({ leadId }: Props) => {
  const { data: links = [], isLoading } = usePaymentLinks(leadId);
  const publish = usePublishPaymentLink();
  const setActive = useSetPaymentLinkActive();

  const toggleActive = (l: { id: string; url: string | null; is_active: boolean }, next: boolean) => {
    if (next && !l.url) {
      toast.error('Publica o link antes de o ativar.');
      return;
    }
    setActive.mutateAsync({ id: l.id, leadId, url: l.url, active: next })
      .then(() => toast.success(next ? 'Botão "Book Now" ativado na proposta e no PDF.' : 'Botão "Book Now" desativado.'))
      .catch((e: any) => toast.error(e.message || 'Erro ao atualizar.'));
  };


  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (isLoading) {
    return (
      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-3">
        <Loader2 className="h-3 w-3 animate-spin" /> A carregar links de pagamento…
      </p>
    );
  }

  if (links.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground">
        Links de pagamento ({links.length})
      </p>
      <div className="space-y-1.5">
        {links.map(l => {
          const st = statusLabel[l.status] ?? statusLabel.draft;
          return (
            <div key={l.id} className="rounded-md border bg-card px-2.5 py-2 text-xs">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{l.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(l.amount_cents / 100).toFixed(2)} {l.currency}
                    {' · '}{fmtDate(l.start_date)} → {fmtDate(l.end_date)}
                    {l.trip_ref ? ` · ${l.trip_ref}` : ''}
                    {' · '}{new Date(l.created_at).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold', st.cls)}>{st.label}</span>
                  {l.url ? (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copy(l.url!)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </>
                  ) : l.wetravel_uuid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={publish.isPending}
                      onClick={() =>
                        publish.mutateAsync(l.id)
                          .then(() => toast.success('Link publicado.'))
                          .catch((e: any) => toast.error(e.message || 'Erro ao publicar.'))
                      }
                    >
                      {publish.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Retomar publicação'}
                    </Button>
                  ) : null}
                </div>
              </div>
              {l.url && (
                <p className="text-[10px] font-mono text-muted-foreground break-all mt-1">{l.url}</p>
              )}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                <Switch
                  id={`active-${l.id}`}
                  checked={!!l.is_active}
                  disabled={setActive.isPending}
                  onCheckedChange={(v) => toggleActive(l, v)}
                />
                <label htmlFor={`active-${l.id}`} className="text-[10px] text-muted-foreground leading-tight">
                  {l.is_active
                    ? 'Ativo — botão "Book Now" visível na proposta digital e no PDF'
                    : 'Inativo — não aparece na proposta nem no PDF'}
                </label>
              </div>

              {l.last_error && (
                <p className="text-[10px] text-destructive flex items-start gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 mt-[1px] shrink-0" /> {l.last_error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentLinksList;
