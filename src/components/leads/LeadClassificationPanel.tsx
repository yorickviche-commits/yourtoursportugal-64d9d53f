import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChevronDown, Loader2, Save } from 'lucide-react';

/**
 * Classificação estruturada da File (produto, regiões, vendedor, parceiro, níveis).
 * Componente isolado: carrega e grava os seus próprios campos, sem tocar na
 * lógica de gravação dos campos legado da página.
 */

const NONE = '__none__';
const BUDGET_TIERS = ['€', '€€', '€€€', '€€€€'];
const COMFORT_TIERS = [
  { v: 'standard', l: 'Standard' },
  { v: 'superior', l: 'Superior' },
  { v: 'premium', l: 'Premium' },
  { v: 'luxury', l: 'Luxury' },
];

interface Props {
  leadId: string;
  /** Campos legado apenas para leitura no bloco "Legado". */
  legacy?: {
    destination?: string | null;
    sales_owner?: string | null;
    budget_level?: string | null;
    comfort_level?: string | null;
  };
}

export default function LeadClassificationPanel({ leadId, legacy }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const { data: lead } = useQuery({
    queryKey: ['lead_classification', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, client_type, product_type_id, owner_id, partner_id, budget_tier, comfort_tier')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: regionsList } = useQuery({
    queryKey: ['regions_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regions').select('id, name, sort_order').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: productTypes } = useQuery({
    queryKey: ['product_types_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_types').select('id, name, sort_order').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: owners } = useQuery({
    queryKey: ['owners_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').order('full_name');
      if (error) throw error;
      return (data || []) as { id: string; full_name: string | null }[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: partners } = useQuery({
    queryKey: ['partners_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('partners').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: leadRegions } = useQuery({
    queryKey: ['lead_regions', leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_regions').select('region_id').eq('lead_id', leadId);
      if (error) throw error;
      return ((data || []) as any[]).map(r => r.region_id as string);
    },
  });

  const [productTypeId, setProductTypeId] = useState<string>(NONE);
  const [ownerId, setOwnerId] = useState<string>(NONE);
  const [partnerId, setPartnerId] = useState<string>(NONE);
  const [budgetTier, setBudgetTier] = useState<string>(NONE);
  const [comfortTier, setComfortTier] = useState<string>(NONE);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  useEffect(() => {
    if (!lead) return;
    setProductTypeId(lead.product_type_id || NONE);
    setOwnerId(lead.owner_id || NONE);
    setPartnerId(lead.partner_id || NONE);
    setBudgetTier(lead.budget_tier || NONE);
    setComfortTier(lead.comfort_tier || NONE);
  }, [lead]);

  useEffect(() => {
    if (leadRegions) setSelectedRegions(leadRegions);
  }, [leadRegions]);

  const isB2B = (lead?.client_type || '').toUpperCase() === 'B2B';

  const dirty = useMemo(() => {
    if (!lead) return false;
    const same =
      (lead.product_type_id || NONE) === productTypeId &&
      (lead.owner_id || NONE) === ownerId &&
      (lead.partner_id || NONE) === partnerId &&
      (lead.budget_tier || NONE) === budgetTier &&
      (lead.comfort_tier || NONE) === comfortTier &&
      (leadRegions || []).slice().sort().join('|') === selectedRegions.slice().sort().join('|');
    return !same;
  }, [lead, leadRegions, productTypeId, ownerId, partnerId, budgetTier, comfortTier, selectedRegions]);

  const toggleRegion = (id: string) => {
    setSelectedRegions(prev => (prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const val = (v: string) => (v === NONE ? null : v);
      const { error } = await supabase
        .from('leads')
        .update({
          product_type_id: val(productTypeId),
          owner_id: val(ownerId),
          partner_id: isB2B ? val(partnerId) : null,
          budget_tier: val(budgetTier),
          comfort_tier: val(comfortTier),
        } as any)
        .eq('id', leadId);
      if (error) throw error;

      const current = leadRegions || [];
      const toAdd = selectedRegions.filter(r => !current.includes(r));
      const toRemove = current.filter(r => !selectedRegions.includes(r));
      if (toRemove.length) {
        const { error: delErr } = await supabase
          .from('lead_regions')
          .delete()
          .eq('lead_id', leadId)
          .in('region_id', toRemove);
        if (delErr) throw delErr;
      }
      if (toAdd.length) {
        const { error: insErr } = await supabase
          .from('lead_regions')
          .insert(toAdd.map(region_id => ({ lead_id: leadId, region_id })));
        if (insErr) throw insErr;
      }

      await qc.invalidateQueries({ queryKey: ['lead_classification', leadId] });
      await qc.invalidateQueries({ queryKey: ['lead_regions', leadId] });
      toast.success('Classificação guardada');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground">Classificação (relatórios)</h3>
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Guardar classificação
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Produto</label>
          <Select value={productTypeId} onValueChange={setProductTypeId}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Sem produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem produto</SelectItem>
              {(productTypes || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Vendedor</label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Sem vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem vendedor</SelectItem>
              {(owners || []).map(o => <SelectItem key={o.id} value={o.id}>{o.full_name || 'Sem nome'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isB2B && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Parceiro</label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Sem parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem parceiro</SelectItem>
                {(partners || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Nível de orçamento</label>
          <Select value={budgetTier} onValueChange={setBudgetTier}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Sem nível" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem nível</SelectItem>
              {BUDGET_TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Nível de conforto</label>
          <Select value={comfortTier} onValueChange={setComfortTier}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Sem nível" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem nível</SelectItem>
              {COMFORT_TIERS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[10px] text-muted-foreground uppercase">Regiões</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {(regionsList || []).map(r => {
            const active = selectedRegions.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRegion(r.id)}
                className={cn(
                  'px-2.5 py-1 text-[10px] rounded border transition-colors',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {r.name}
              </button>
            );
          })}
          {!regionsList?.length && <span className="text-[10px] text-muted-foreground">Sem regiões configuradas</span>}
        </div>
      </div>

      {legacy && (
        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setLegacyOpen(o => !o)}
            className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', legacyOpen && 'rotate-180')} />
            Legado
          </button>
          {legacyOpen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {[
                ['Destino (texto)', legacy.destination],
                ['Vendedor (texto)', legacy.sales_owner],
                ['Budget (texto)', legacy.budget_level],
                ['Conforto (texto)', legacy.comfort_level],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
                  <Badge variant="secondary" className="mt-1 text-[10px] font-normal">{value || '—'}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
