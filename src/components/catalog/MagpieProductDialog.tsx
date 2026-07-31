import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Download, ExternalLink } from 'lucide-react';
import { MagpieHtml } from '@/lib/sanitizeMagpie';
import type { MagpieCatalogProduct } from '@/hooks/useMagpie';

const asList = (v: unknown): string[] => {
  if (typeof v === 'string') return v.trim() ? [v] : [];
  if (!Array.isArray(v)) return [];
  return v
    .map((i) => {
      if (typeof i === 'string') return i;
      const o = i as Record<string, unknown>;
      return (o?.text ?? o?.name ?? o?.title ?? o?.question ?? o?.description ?? JSON.stringify(o)) as string;
    })
    .filter(Boolean);
};

const galleryUrls = (p: Record<string, unknown>): string[] => {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) out.push(v);
    else if (v && typeof v === 'object') {
      const o = v as { url?: string; ttd_url?: string };
      const u = o.url ?? o.ttd_url;
      if (u) out.push(u);
    }
  };
  const sources = [p.gallery, p.images, p.photos];
  sources.forEach((s) => { if (Array.isArray(s)) s.forEach(push); });
  push(p.image_url);
  return [...new Set(out)];
};

const text = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return asList(v).join(' · ') || '—';
  const o = v as Record<string, unknown>;
  return (o.text ?? o.name ?? o.title ?? JSON.stringify(o)) as string;
};

const Row = ({ label, value }: { label: string; value: unknown }) => (
  <div className="flex gap-2 text-xs py-1 border-b border-border/50 last:border-0">
    <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words">{text(value)}</span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    {children}
  </div>
);

const Bullets = ({ items }: { items: string[] }) =>
  items.length ? (
    <ul className="list-disc pl-5 space-y-1 text-xs">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>
  ) : <p className="text-xs text-muted-foreground">—</p>;

interface Props {
  product: MagpieCatalogProduct | null;
  open: boolean;
  onClose: () => void;
  onImport?: (id: string) => void;
  importing?: boolean;
}

const HIDDEN_KEYS = new Set([
  'magpie_id', 'id', 'name', 'gallery', 'images', 'photos', 'image_url',
  'already_imported', 'description', 'summary', 'additional_info',
  'terms_and_conditions', 'highlights', 'included', 'inclusions',
  'excluded', 'exclusions', 'itinerary', 'faqs',
]);

const MagpieProductDialog = ({ product, open, onClose, onImport, importing }: Props) => {
  if (!product) return null;
  const p = product as unknown as Record<string, unknown>;
  const imgs = galleryUrls(p);
  const account = p.account as { name?: string } | null;
  const rest = Object.entries(p)
    .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base pr-6">{product.name}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Lock className="h-3 w-3" /> Somente leitura — editar em Magpie
            </Badge>
            {product.already_imported ? (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Importado</Badge>
            ) : onImport ? (
              <Button size="sm" variant="outline" className="h-7 text-xs"
                disabled={importing}
                onClick={() => onImport(product.magpie_id)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Importar para YourTours
              </Button>
            ) : null}
            {typeof p.url === 'string' && (
              <a href={p.url as string} target="_blank" rel="noopener"
                className="text-xs text-primary inline-flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir
              </a>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {imgs.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imgs.slice(0, 12).map((u) => (
                <img key={u} src={u} alt={product.name ?? ''} loading="lazy"
                  className="h-20 w-full object-cover rounded-md bg-muted" />
              ))}
            </div>
          )}

          <Section title="Identificação">
            <div className="rounded-lg border border-border p-3">
              <Row label="Magpie ID" value={product.magpie_id} />
              <Row label="Conta" value={account?.name ?? '—'} />
              <Row label="Categoria" value={p.category} />
              <Row label="Localização" value={p.location} />
              <Row label="Duração" value={p.duration} />
              <Row label="Moeda" value={p.currency} />
              <Row label="ID interno" value={p.internal_id} />
            </div>
          </Section>

          {(p.summary || p.description) && (
            <Section title="Descrição">
              <MagpieHtml html={(p.summary as string) || ''} className="prose prose-sm max-w-none text-xs" />
              <MagpieHtml html={(p.description as string) || ''} className="prose prose-sm max-w-none text-xs" />
            </Section>
          )}

          {asList(p.highlights).length > 0 && (
            <Section title="Destaques"><Bullets items={asList(p.highlights)} /></Section>
          )}
          {(asList(p.included).length > 0 || asList(p.inclusions).length > 0) && (
            <Section title="Incluído">
              <Bullets items={[...asList(p.included), ...asList(p.inclusions)]} />
            </Section>
          )}
          {(asList(p.excluded).length > 0 || asList(p.exclusions).length > 0) && (
            <Section title="Não incluído">
              <Bullets items={[...asList(p.excluded), ...asList(p.exclusions)]} />
            </Section>
          )}
          {asList(p.itinerary).length > 0 && (
            <Section title="Itinerário"><Bullets items={asList(p.itinerary)} /></Section>
          )}
          {asList(p.faqs).length > 0 && (
            <Section title="FAQs"><Bullets items={asList(p.faqs)} /></Section>
          )}
          {(p.additional_info || p.terms_and_conditions) && (
            <Section title="Info adicional & condições">
              <MagpieHtml html={(p.additional_info as string) || ''} className="prose prose-sm max-w-none text-xs" />
              <MagpieHtml html={(p.terms_and_conditions as string) || ''} className="prose prose-sm max-w-none text-xs" />
            </Section>
          )}

          {rest.length > 0 && (
            <Section title="Todos os campos Magpie">
              <div className="rounded-lg border border-border p-3">
                {rest.map(([k, v]) => <Row key={k} label={k} value={v} />)}
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MagpieProductDialog;
