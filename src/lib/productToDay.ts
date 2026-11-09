import type { ImportedProduct } from '@/hooks/useMagpie';
import { local } from '@/hooks/useMagpie';
import type { ProposalBullet, ProposalDay, ProposalImage } from '@/components/trip/TravelPlanProposal';

import type { ProductExecution } from './productExecution';
import { catalogAddonRows } from './productAddons';
export function selectedExecution(p: ImportedProduct): ProductExecution | undefined {
  const versions = local(p)?.execution_versions || [];
  return versions.find(v => v.id === p.selected_execution_id) || versions.find(v => v.id === local(p)?.default_execution_id) || versions[0];
}
export function productToProposalDays(p: ImportedProduct, opts: { dayNumber: number; date?: string }): ProposalDay[] {
  const execution = selectedExecution(p);
  if (!execution) return [productToProposalDay(p, opts)];
  return execution.plan.days.map((day, i) => ({
    ...structuredClone(day), day_number: opts.dayNumber + i, date: i === 0 ? opts.date || '' : '',
    product_ref: { magpie_id: p.magpie_id, name: productTitle(p), pricing: execution.pricing,
      execution: { id: execution.id, label: execution.label, items: structuredClone(execution.costingDays.find(d => d.day === day.day_number)?.items || []) } },
  }));
}

/** Normalizes a jsonb list (strings or objects) into plain text lines. */
export function textList(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    let text = '';
    if (typeof raw === 'string') text = raw;
    else if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      text = String(o.text ?? o.title ?? o.name ?? o.description ?? o.value ?? '');
    }
    text = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/** Extracts up to `max` image URLs from the normalized images jsonb. */
export function imageList(value: unknown, max = 2): ProposalImage[] {
  if (!Array.isArray(value)) return [];
  const out: ProposalImage[] = [];
  for (const raw of value) {
    let url = '';
    let caption = '';
    if (typeof raw === 'string') url = raw;
    else if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      url = String(o.url ?? o.ttd_url ?? o.src ?? '');
      caption = String(o.caption ?? o.title ?? o.alt ?? '');
    }
    if (url) out.push({ url, caption });
    if (out.length >= max) break;
  }
  return out;
}

/** Parses "8.0 hours" / "3 days" into a bullet duration. */
export function parseDuration(text?: string | null): Pick<ProposalBullet, 'durationValue' | 'durationUnit'> {
  if (!text) return {};
  const m = String(text).match(/([\d.,]+)\s*(hour|hr|h|minute|min|day|night)/i);
  if (!m) return {};
  const value = Number(m[1].replace(',', '.'));
  if (!isFinite(value) || value <= 0) return {};
  const u = m[2].toLowerCase();
  const unit: ProposalBullet['durationUnit'] =
    u.startsWith('min') ? 'minutes' : u.startsWith('day') ? 'days' : u.startsWith('night') ? 'night' : 'hours';
  return { durationValue: value, durationUnit: unit };
}

export function productTitle(p: ImportedProduct): string {
  return local(p)?.custom_title || p.name || 'Produto';
}

export function productSummary(p: ImportedProduct): string {
  const l = local(p);
  const raw = l?.custom_summary || (p.summary as string | null) || '';
  return String(raw).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Bullets derived from a product: highlights first, inclusions as fallback. */
export function productBullets(p: ImportedProduct): ProposalBullet[] {
  const saved = selectedExecution(p)?.plan.days[0]?.bullets;
  if (saved) return structuredClone(saved).map(b => typeof b === 'string' ? { text: b } : b);
  const highlights = textList(p.highlights);
  const lines = highlights.length ? highlights : textList(p.included);
  const duration = parseDuration(p.duration_text as string | null);
  return lines.map((text, i) => (i === 0 ? { text, ...duration } : { text }));
}

/** Builds a ProposalDay pre-filled from a catalog product. */
export function productToProposalDay(
  p: ImportedProduct,
  opts: { dayNumber: number; date?: string },
): ProposalDay {
  return {
    day_number: opts.dayNumber,
    title: productTitle(p),
    date: opts.date || '',
    subtitle: productSummary(p),
    bullets: productBullets(p),
    overnight: (p.location as string | null) || '',
    images: imageList(p.images, 2),
    ...productRef(p),
  };
}

/** Pricing reference stored on the day so Costing can apply the tier table. */
export function productRef(p: ImportedProduct): Pick<ProposalDay, 'product_ref'> {
  const execution = selectedExecution(p);
  if (execution) return { product_ref: { magpie_id: p.magpie_id, name: productTitle(p), pricing: execution.pricing,
    execution: { id: execution.id, label: execution.label, items: structuredClone(execution.costingDays[0]?.items || []) } } };
  const pricing = (p.raw_payload as any)?.pricing;
  const addons = catalogAddonRows(p, 1, 0);
  if (!pricing?.adult_per_person_by_group_size && !addons.length) return {};
  return { product_ref: { magpie_id: p.magpie_id, name: productTitle(p), pricing, addons } };
}
