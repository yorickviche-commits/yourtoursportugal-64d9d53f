import { useState } from 'react';
import { Copy, Loader2, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { local, useSaveProductLocal, type ImportedProduct } from '@/hooks/useMagpie';
import TravelPlanProposal, { type TravelPlanData } from '@/components/trip/TravelPlanProposal';
import LeadCostingEditor, { type LeadCostingDay } from '@/components/trip/LeadCostingEditor';
import { productToProposalDay, productTitle, productSummary } from '@/lib/productToDay';
import { cloneExecution, type ProductExecution } from '@/lib/productExecution';
import type { ProductPricing } from '@/lib/productPricing';
import { catalogAddonRows, mergeCatalogAddons, calculateProductRow } from '@/lib/productAddons';
import ProductAddonEditor from './ProductAddonEditor';

function initialExecution(product: ImportedProduct): ProductExecution {
  const day = productToProposalDay(product, { dayNumber: 1 });
  delete day.product_ref;
  const payload = product.raw_payload as { pricing?: ProductPricing } | null;
  return {
    id: crypto.randomUUID(), label: 'A', adults: 2, children: 0, updatedAt: new Date().toISOString(),
    plan: { trip_title: productTitle(product), narrative: productSummary(product), cover_image: day.images?.[0], days: [day] },
    pricing: payload?.pricing, costingDays: [{ day: 1, title: day.title, items: catalogAddonRows(product, 2, 0) }],
  };
}

export default function ProductExecutionWorkspace({ product }: { product: ImportedProduct }) {
  const saved = local(product);
  const [versions, setVersions] = useState<ProductExecution[]>(() => structuredClone(saved?.execution_versions || []));
  const [selected, setSelected] = useState(saved?.default_execution_id || saved?.execution_versions?.[0]?.id || '');
  const [defaultId, setDefaultId] = useState(saved?.default_execution_id || saved?.execution_versions?.[0]?.id || '');
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('plan');
  const save = useSaveProductLocal(product.magpie_id);
  const active = versions.find(v => v.id === selected);

  const update = (patch: Partial<ProductExecution>) => {
    setVersions(prev => prev.map(v => v.id === selected ? { ...v, ...patch } : v));
    setDirty(true);
  };
  const persist = async (rows = versions, preferred = defaultId) => {
    await save.mutateAsync({ execution_versions: rows, default_execution_id: preferred || rows[0]?.id || null });
    setDirty(false);
  };
  const changeVersion = async (id: string) => {
    try { if (dirty) await persist(); setSelected(id); } catch { /* Stay on current version when saving fails. */ }
  };
  const addVersion = async () => {
    try {
      const next = active ? cloneExecution(active, versions.length) : initialExecution(product);
      const rows = [...versions, next];
      await persist(rows, defaultId || next.id);
      setVersions(rows); setSelected(next.id); if (!defaultId) setDefaultId(next.id);
    } catch { /* Mutation displays error. */ }
  };
  const savePlan = async (plan: TravelPlanData, metadata: string) => {
    const rows = versions.map(v => v.id === selected ? { ...v, plan, metadata, updatedAt: new Date().toISOString() } : v);
    await persist(rows); setVersions(rows);
  };
  const saveCosts = async (costingDays: LeadCostingDay[]) => {
    const rows = versions.map(v => v.id === selected ? { ...v, costingDays, updatedAt: new Date().toISOString() } : v);
    await persist(rows); setVersions(rows);
  };
  const syncDays = () => {
    if (!active) return;
    const rows = active.plan.days.map(d => {
      const previous = active.costingDays.find(c => c.day === d.day_number);
      return { ...previous, day: d.day_number, title: d.title, items: previous?.items || [] };
    });
    update({ costingDays: [...active.costingDays.filter(d => d.day === 0), ...rows] });
  };
  const addonDays = active?.costingDays || [];
  const importAddons = () => {
    if (!active) return;
    const first = active.plan.days[0];
    if (!first) return;
    const existing = addonDays.find(day => day.day === first.day_number);
    const merged = { day: first.day_number, title: first.title, ...existing, items: mergeCatalogAddons(existing?.items || [], catalogAddonRows(product, active.adults, active.children)) };
    update({ costingDays: existing ? addonDays.map(day => day.day === first.day_number ? merged : day) : [...addonDays, merged] });
  };

  return <section className="border-t border-border py-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-bold">Versões de execução</h2>
      <div className="flex flex-wrap items-center gap-2">
        {active && <Select value={selected} onValueChange={id => void changeVersion(id)} disabled={save.isPending}>
          <SelectTrigger aria-label="Versão do produto" className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{versions.map(v => <SelectItem key={v.id} value={v.id}>Versão {v.label}</SelectItem>)}</SelectContent>
        </Select>}
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => void addVersion()}>
          {active ? <Copy className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {active ? 'Duplicar versão' : 'Criar versão A'}
        </Button>
        {active && <Button size="sm" disabled={save.isPending || !dirty} onClick={() => void persist().catch(() => undefined)}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Guardar versão
        </Button>}
      </div>
    </div>
    {!active ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Sem versões de execução.</p>
      {catalogAddonRows(product, 1, 0).length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Opcionais / Add-ons</h3>{catalogAddonRows(product, 1, 0).map(row => <div key={row.addonId} className="border-b border-border pb-3"><p className="text-sm font-medium">{row.description}</p><p className="text-sm text-muted-foreground">{row.commercialDescription}</p><p className="text-xs text-primary mt-1">{row.retailTotal != null ? `€${row.retailTotal.toFixed(2)} / total` : `€${(row.retailAdult || 0).toFixed(2)} / adulto · €${(row.retailChild ?? row.retailAdult ?? 0).toFixed(2)} / criança`} · NET por definir</p></div>)}</div>}
    </div> : <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1"><Label>Nome da versão</Label><Input aria-label="Nome da versão" value={active.label} onChange={e => update({ label: e.target.value })} /></div>
        <div className="space-y-1"><Label>Versão predefinida</Label><Select value={defaultId} onValueChange={id => { setDefaultId(id); setDirty(true); }}><SelectTrigger aria-label="Versão predefinida"><SelectValue /></SelectTrigger><SelectContent>{versions.map(v => <SelectItem key={v.id} value={v.id}>Versão {v.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Adultos / jovens</Label><Input aria-label="Adultos de referência" type="number" min={0} value={active.adults} onChange={e => update({ adults: Math.max(0, Number(e.target.value)) })} /></div>
        <div className="space-y-1"><Label>Crianças</Label><Input aria-label="Crianças de referência" type="number" min={0} value={active.children} onChange={e => update({ children: Math.max(0, Number(e.target.value)) })} /></div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto justify-start"><TabsTrigger value="plan">Travel Plan</TabsTrigger><TabsTrigger value="ops">Operações & Custos NET</TabsTrigger><TabsTrigger value="addons">Opcionais / Add-ons</TabsTrigger></TabsList>
        <TabsContent value="addons" className="space-y-4">
          <Button size="sm" variant="outline" onClick={importAddons}><Plus className="h-4 w-4 mr-1" />Trazer opcionais do produto</Button>
          {active.plan.days.map(day => {
            const costs = addonDays.find(d => d.day === day.day_number);
            const setItems = (items: LeadCostingDay['items']) => update({ costingDays: costs ? addonDays.map(d => d.day === day.day_number ? { ...d, items } : d) : [...addonDays, { day: day.day_number, title: day.title, items }] });
            return <div key={day.day_number} className="space-y-3"><h3 className="text-sm font-semibold">Dia {day.day_number} — {day.title}</h3>
              <ProductAddonEditor items={costs?.items || []} onChange={setItems} onAdd={() => setItems([...(costs?.items || []), calculateProductRow({ id: crypto.randomUUID(), addonId: crypto.randomUUID(), description: '', commercialDescription: '', supplier: '', pricingType: 'per_person', numAdults: active.adults, numChildren: active.children, priceAdults: 0, priceChildren: 0, netTotal: 0, pvpTotal: 0, marginPercent: 0, profit: 0, retailAdult: 0, retailChild: 0, netPending: true, status: 'opcionais', notes: [], costLayer: 'experience' })])} />
            </div>;
          })}
        </TabsContent>
        <TabsContent value="plan" forceMount className={tab !== 'plan' ? 'hidden' : ''}>
          <TravelPlanProposal key={active.id} leadId="" leadCode={product.magpie_id} clientName="" destination={String(product.location || '')} travelDates="" numberOfDays={active.plan.days.length} pax={active.adults} paxChildren={active.children} travelStyles={[]} comfortLevel="" budgetLevel="" defaultLanguage={String(product.language || 'EN')} onGoToCosting={() => setTab('ops')}
            template={{ plan: active.plan, metadata: active.metadata, costingDays: active.costingDays, onChange: (plan, metadata) => update({ plan, metadata }), onSave: savePlan }} />
        </TabsContent>
        <TabsContent value="ops" forceMount className={tab !== 'ops' ? 'hidden' : ''}>
          <div className="space-y-3">
            <Button size="sm" variant="outline" onClick={syncDays}><Plus className="h-4 w-4 mr-1" />Sincronizar dias do Travel Plan</Button>
            <LeadCostingEditor key={`cost-${active.id}`} templateMode costingDays={active.costingDays} onChange={costingDays => update({ costingDays })} onSave={saveCosts} saving={save.isPending} plannerDays={[]} pax={active.adults} paxChildren={active.children} destination={String(product.location || '')} />
          </div>
        </TabsContent>
      </Tabs>
    </>}
  </section>;
}
