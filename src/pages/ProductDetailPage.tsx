import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ExternalLink, Loader2, MapPin, RefreshCw, Save } from 'lucide-react';
import {
  useImportedProduct, useMagpieRefresh, useSaveProductLocal, local,
} from '@/hooks/useMagpie';
import { MagpieHtml } from '@/lib/sanitizeMagpie';

const asList = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .map((i) => {
      if (typeof i === 'string') return i;
      const o = i as Record<string, unknown>;
      return (o?.text ?? o?.name ?? o?.title ?? o?.question ?? JSON.stringify(o)) as string;
    })
    .filter(Boolean);
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl border border-border p-4 space-y-2">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
    {children}
  </div>
);

const Bullets = ({ items }: { items: string[] }) =>
  items.length ? (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {items.map((i, idx) => <li key={idx}>{i}</li>)}
    </ul>
  ) : <p className="text-sm text-muted-foreground">—</p>;

const ProductDetailPage = () => {
  const { magpieId } = useParams<{ magpieId: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useImportedProduct(magpieId);
  const refresh = useMagpieRefresh();
  const save = useSaveProductLocal(magpieId ?? '');

  const l = product ? local(product) : null;
  const [form, setForm] = useState({
    workflow_status: 'draft',
    is_visible: false,
    internal_tags: '',
    commercial_notes: '',
    custom_title: '',
    custom_summary: '',
    sort_weight: 0,
  });

  useEffect(() => {
    if (!l) return;
    setForm({
      workflow_status: l.workflow_status ?? 'draft',
      is_visible: l.is_visible ?? false,
      internal_tags: (l.internal_tags ?? []).join(', '),
      commercial_notes: l.commercial_notes ?? '',
      custom_title: l.custom_title ?? '',
      custom_summary: l.custom_summary ?? '',
      sort_weight: l.sort_weight ?? 0,
    });
  }, [l?.id]);

  if (isLoading) {
    return <AppLayout><div className="py-10 text-center text-sm text-muted-foreground">A carregar...</div></AppLayout>;
  }
  if (!product) {
    return (
      <AppLayout>
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Produto não encontrado na biblioteca.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/products')}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  const images = Array.isArray(product.images) ? product.images : [];
  const addresses = Array.isArray(product.addresses) ? product.addresses as Record<string, unknown>[] : [];
  const openingHours = (product.opening_hours ?? {}) as Record<string, string>;

  const rates: [string, unknown][] = [
    ['Adulto', product.retail_rate_adult],
    ['Jovem', product.retail_rate_youth],
    ['Criança', product.retail_rate_child],
    ['Bebé', product.retail_rate_infant],
    ['Sénior', product.retail_rate_senior],
  ].filter(([, v]) => v !== null && v !== undefined) as [string, unknown][];

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 min-w-0">
            <Button size="icon" variant="ghost" onClick={() => navigate('/products')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{product.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                {product.category && <span>{product.category}</span>}
                {product.location && <span>• {product.location}</span>}
                {product.account_name && <span>• {product.account_name}</span>}
                <span className="font-mono">• {product.magpie_id.slice(0, 8)}</span>
                {product.availability_status === 'unavailable' && (
                  <Badge variant="destructive" className="text-[10px]">Indisponível</Badge>
                )}
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={refresh.isPending}
            onClick={() => refresh.mutate([product.magpie_id])}>
            {refresh.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh de Magpie
          </Button>
        </div>

        {product.sync_error && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            {product.sync_error}
          </div>
        )}

        {/* Our data */}
        <div className="bg-card rounded-xl border-2 border-primary/30 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold">Os nossos dados (não sincronizados)</h2>
            <p className="text-xs text-muted-foreground">
              Nada nesta secção é alterado pelo sync com Magpie.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Estado do workflow</Label>
              <Select value={form.workflow_status}
                onValueChange={(v) => setForm((f) => ({ ...f, workflow_status: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="review">Revisão</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Peso de ordenação</Label>
              <Input type="number" className="h-9" value={form.sort_weight}
                onChange={(e) => setForm((f) => ({ ...f, sort_weight: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch checked={form.is_visible}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_visible: v }))} />
              <Label className="text-xs">Visível no nosso frontend</Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título personalizado</Label>
              <Input className="h-9" value={form.custom_title}
                onChange={(e) => setForm((f) => ({ ...f, custom_title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tags internas (separadas por vírgula)</Label>
              <Input className="h-9" value={form.internal_tags}
                onChange={(e) => setForm((f) => ({ ...f, internal_tags: e.target.value }))} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Resumo personalizado</Label>
              <Textarea rows={3} value={form.custom_summary}
                onChange={(e) => setForm((f) => ({ ...f, custom_summary: e.target.value }))} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Notas comerciais</Label>
              <Textarea rows={3} value={form.commercial_notes}
                onChange={(e) => setForm((f) => ({ ...f, commercial_notes: e.target.value }))} />
            </div>
          </div>
          <Button size="sm" disabled={save.isPending}
            onClick={() => save.mutate({
              workflow_status: form.workflow_status,
              is_visible: form.is_visible,
              internal_tags: form.internal_tags.split(',').map((t) => t.trim()).filter(Boolean),
              commercial_notes: form.commercial_notes || null,
              custom_title: form.custom_title || null,
              custom_summary: form.custom_summary || null,
              sort_weight: form.sort_weight,
            })}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Guardar
          </Button>
        </div>

        {/* Magpie content (read-only) */}
        {images.length > 0 && (
          <Section title="Galeria (alojada em Magpie)">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {images.map((img, i) => {
                const url = typeof img === 'string' ? img : (img as { url?: string })?.url;
                if (!url) return null;
                return (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`${product.name} ${i + 1}`} loading="lazy"
                      className="h-28 w-full object-cover rounded-md bg-muted" />
                  </a>
                );
              })}
            </div>
          </Section>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Section title="Ficha técnica">
            <dl className="text-sm space-y-1">
              {[
                ['Duração', product.duration_text],
                ['Moeda', product.currency],
                ['Idioma', product.language],
                ['Fuso horário', product.timezone],
                ['Pax mín / máx', [product.min_pax, product.max_pax].filter((v) => v != null).join(' – ')],
                ['Grupo máx', product.max_group_size],
                ['Multi-dia', product.multiday === null ? null : product.multiday ? 'Sim' : 'Não'],
                ['Privado', product.private === null ? null : product.private ? 'Sim' : 'Não'],
                ['Confirmação necessária', product.confirmation_required === null ? null : product.confirmation_required ? 'Sim' : 'Não'],
                ['Tipo de guia', product.guide_type],
                ['Dificuldade', product.trip_difficulty],
                ['Cutoff de reserva', product.booking_cutoff],
                ['Válido para', product.valid_for],
                ['ID interno', product.internal_id],
              ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                <div key={String(k)} className="flex gap-2">
                  <dt className="text-muted-foreground w-40 shrink-0">{String(k)}</dt>
                  <dd className="min-w-0">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Tarifas retail">
            {rates.length ? (
              <dl className="text-sm space-y-1">
                {rates.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-muted-foreground w-40 shrink-0">{k}</dt>
                    <dd>{String(v)} {product.currency ?? ''}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Magpie não devolve tarifas para este produto.</p>
            )}
          </Section>
        </div>

        {product.summary && (
          <Section title="Resumo">
            <MagpieHtml html={String(product.summary)} className="prose prose-sm max-w-none text-sm" />
          </Section>
        )}
        {product.description && (
          <Section title="Descrição">
            <MagpieHtml html={String(product.description)} className="prose prose-sm max-w-none text-sm" />
          </Section>
        )}
        {product.long_description && (
          <Section title="Descrição completa">
            <MagpieHtml html={String(product.long_description)} className="prose prose-sm max-w-none text-sm" />
          </Section>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Section title="Destaques"><Bullets items={asList(product.highlights)} /></Section>
          <Section title="Comentários"><Bullets items={asList(product.commentaries)} /></Section>
          <Section title="Incluído"><Bullets items={asList(product.included)} /></Section>
          <Section title="Não incluído"><Bullets items={asList(product.excluded)} /></Section>
          <Section title="Antes de reservar"><Bullets items={asList(product.before_booking)} /></Section>
          <Section title="Antes da chegada"><Bullets items={asList(product.before_arrival)} /></Section>
          <Section title="Restrições"><Bullets items={asList(product.restrictions)} /></Section>
          <Section title="Saúde e segurança"><Bullets items={asList(product.health_items)} /></Section>
        </div>

        {addresses.length > 0 && (
          <Section title="Endereços">
            <div className="space-y-2 text-sm">
              {addresses.map((a, i) => {
                const address = String(a.full_street_address ?? a.address ?? '');
                const coords = String(a.coordinates ?? '');
                const mapQuery = coords || address;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{String(a.location_type ?? 'Endereço')}</p>
                      <p className="text-muted-foreground">{address || '—'}</p>
                      {a.notes ? <p className="text-xs text-muted-foreground">{String(a.notes)}</p> : null}
                      {mapQuery && (
                        <a className="text-xs text-primary inline-flex items-center gap-1"
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                          target="_blank" rel="noopener noreferrer">
                          Abrir no mapa <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {Object.keys(openingHours).length > 0 && (
          <Section title="Horários">
            <dl className="text-sm grid grid-cols-2 md:grid-cols-4 gap-1">
              {Object.entries(openingHours).map(([day, hours]) => (
                <div key={day}>
                  <dt className="text-muted-foreground text-xs">{day}</dt>
                  <dd>{String(hours)}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {(product.cancellation_policy || product.cancellation_cutoff || product.cancellation_notes) && (
          <Section title="Política de cancelamento">
            <p className="text-sm">
              {[product.cancellation_policy, product.cancellation_cutoff].filter(Boolean).join(' · ')}
            </p>
            {product.cancellation_notes && (
              <p className="text-sm text-muted-foreground">{String(product.cancellation_notes)}</p>
            )}
          </Section>
        )}

        {product.additional_info && (
          <Section title="Informação adicional">
            <MagpieHtml html={String(product.additional_info)} className="prose prose-sm max-w-none text-sm" />
          </Section>
        )}
        {product.terms_and_conditions && (
          <Section title="Termos e condições">
            <MagpieHtml html={String(product.terms_and_conditions)} className="prose prose-sm max-w-none text-sm whitespace-pre-line" />
          </Section>
        )}
        {product.voucher_info && (
          <Section title="Voucher">
            <MagpieHtml html={String(product.voucher_info)} className="prose prose-sm max-w-none text-sm" />
          </Section>
        )}
      </div>
    </AppLayout>
  );
};

export default ProductDetailPage;
