import type { LeadCostItem } from '@/components/trip/LeadCostingEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { calculateProductRow } from '@/lib/productAddons';

export default function ProductAddonEditor({ items, onChange, onAdd }: {
  items: LeadCostItem[]; onChange: (items: LeadCostItem[]) => void; onAdd: () => void;
}) {
  const update = (id: string, patch: Partial<LeadCostItem>) => onChange(items.map(row => row.id === id ? calculateProductRow({ ...row, ...patch }) : row));
  return <div className="space-y-4">
    <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Adicionar opcional</Button>
    {items.filter(row => row.status === 'opcionais' || row.addonId).map(row => <section key={row.id} className="border-b border-border pb-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input aria-label="Nome do opcional" value={row.description} onChange={e => update(row.id, { description: e.target.value })} />
        <Button variant="ghost" size="icon" title="Remover opcional" aria-label="Remover opcional" onClick={() => onChange(items.filter(item => item.id !== row.id))}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1"><Label>Descrição para o cliente</Label><Textarea aria-label="Descrição do opcional" rows={3} value={row.commercialDescription || row.description} onChange={e => update(row.id, { commercialDescription: e.target.value })} /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {row.pricingType === 'total' ? <div className="space-y-1"><Label>PVP total (€)</Label><Input aria-label="PVP total opcional" type="number" min={0} step="0.01" value={row.retailTotal ?? row.pvpTotal} onChange={e => update(row.id, { retailTotal: Number(e.target.value) })} /></div> : <>
          <div className="space-y-1"><Label>PVP adulto / jovem (€)</Label><Input aria-label="PVP adulto opcional" type="number" min={0} step="0.01" value={row.retailAdult ?? ''} onChange={e => update(row.id, { retailAdult: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>PVP criança (€)</Label><Input aria-label="PVP criança opcional" type="number" min={0} step="0.01" value={row.retailChild ?? ''} onChange={e => update(row.id, { retailChild: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
        </>}
        <div className="space-y-1"><Label>Grupo de alternativas</Label><Input aria-label="Grupo de alternativas" value={row.addonGroup || ''} onChange={e => update(row.id, { addonGroup: e.target.value })} /></div>
        <div className="space-y-1"><Label>Estado</Label><Select value={row.status} onValueChange={value => update(row.id, { status: value as LeadCostItem['status'] })}><SelectTrigger aria-label="Estado do opcional"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="opcionais">Opcional</SelectItem><SelectItem value="aceite">Incluído / confirmado</SelectItem><SelectItem value="eliminar">Excluído</SelectItem></SelectContent></Select></div>
      </div>
      <p className="text-xs text-muted-foreground">{row.netPending ? 'NET por definir' : `NET €${row.netTotal.toFixed(2)}`} · PVP €{row.pvpTotal.toFixed(2)}</p>
    </section>)}
  </div>;
}