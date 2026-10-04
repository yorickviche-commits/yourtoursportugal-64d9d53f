import { supabase } from '@/integrations/supabase/client';

export interface FSECreateData {
  supplier_name: string;
  category: string;
  sub_category?: string;
  destinations?: string[];
  website?: string;
  tripadvisor_url?: string;
  gmaps_url?: string;
  gmb_url?: string;
  extra_links?: Array<{ name: string; url: string }>;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  net_conditions?: string;
  notes?: string;
  services?: Array<Record<string, unknown>>;
}

export interface FSECreateResult {
  supplier: { id: string; name: string; category: string };
  existed: boolean;
}

const clean = (value?: string) => value?.trim() || null;

export async function createOrFindFSE(input: FSECreateData): Promise<FSECreateResult> {
  const name = input.supplier_name.trim();
  if (!name) throw new Error('O nome do fornecedor é obrigatório.');

  const { data: matches, error: lookupError } = await supabase
    .from('suppliers')
    .select('id, name, category')
    .ilike('name', name);
  if (lookupError) throw lookupError;

  const existing = matches?.find(row => row.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return { supplier: existing, existed: true };

  const notes = [
    clean(input.notes),
    input.sub_category ? `Subcategoria: ${input.sub_category}` : null,
    input.destinations?.length ? `Destinos: ${input.destinations.join(', ')}` : null,
    input.net_conditions ? `Condições NET: ${input.net_conditions.trim()}` : null,
  ].filter(Boolean).join('\n');

  const { data: supplier, error: supplierError } = await supabase
    .from('suppliers')
    .insert({
      name,
      category: input.category || 'anim',
      contact_name: clean(input.contact_name),
      contact_email: clean(input.contact_email),
      contact_phone: clean(input.contact_phone),
      notes: notes || null,
      status: 'active',
    })
    .select('id, name, category')
    .single();
  if (supplierError) {
    if (supplierError.code === '23505') {
      const { data: concurrentMatch, error: retryError } = await supabase
        .from('suppliers')
        .select('id, name, category')
        .ilike('name', name)
        .limit(1)
        .maybeSingle();
      if (retryError) throw retryError;
      if (concurrentMatch) return { supplier: concurrentMatch, existed: true };
    }
    throw supplierError;
  }

  const services = (input.services || [])
    .filter(service => String(service.name || '').trim())
    .map(service => ({
      supplier_id: supplier.id,
      name: String(service.name).trim(),
      description: clean(String(service.description || '')),
      category: String(service.category || input.category || 'activity'),
      duration: clean(String(service.duration || '')),
      price: Number(service.price) || 0,
      price_child: Number(service.price_child) || 0,
      price_unit: String(service.price_unit || 'per_person'),
      currency: String(service.currency || 'EUR'),
      payment_conditions: clean(String(service.payment_conditions || input.net_conditions || '')),
      cancellation_policy: clean(String(service.cancellation_policy || '')),
      refund_policy: clean(String(service.refund_policy || '')),
      booking_conditions: clean(String(service.booking_conditions || '')),
      notes: clean(String(service.notes || '')),
    }));

  if (services.length) {
    const { error } = await supabase.from('supplier_services').insert(services);
    if (error) throw error;
  }

  const links = [
    input.website ? { name: 'Website', url: input.website } : null,
    input.tripadvisor_url ? { name: 'TripAdvisor', url: input.tripadvisor_url } : null,
    input.gmaps_url ? { name: 'Google Maps', url: input.gmaps_url } : null,
    input.gmb_url ? { name: 'Google Business', url: input.gmb_url } : null,
    ...(input.extra_links || []),
  ].filter((link): link is { name: string; url: string } => Boolean(link?.name.trim() && link.url.trim()))
    .map(link => ({ supplier_id: supplier.id, name: link.name.trim(), url: link.url.trim() }));

  if (links.length) {
    const { error } = await supabase.from('supplier_links').insert(links);
    if (error) throw error;
  }

  return { supplier, existed: false };
}