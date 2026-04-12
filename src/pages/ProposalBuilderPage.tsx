import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useProposalById, useUpdateProposal, useCreateProposal, ProposalDay, MapStop } from '@/hooks/useProposalsQuery';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save, ExternalLink, GripVertical, MapPin, Hotel } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const emptyDay: ProposalDay = {
  day_number: 1,
  date_label: '',
  title: '',
  subtitle: '',
  cover_image_url: '',
  items: [''],
  accommodation: null,
};

const ProposalBuilderPage = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const { data: existing } = useProposalById(isNew ? '' : id);
  const updateProposal = useUpdateProposal();
  const createProposal = useCreateProposal();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    booking_ref: '',
    language: 'fr',
    title: '',
    date_range: '',
    participants: '',
    hero_image_url: '',
    summary_text: '',
    public_token: '',
    status: 'draft',
  });

  const [days, setDays] = useState<ProposalDay[]>([{ ...emptyDay }]);
  const [mapStops, setMapStops] = useState<MapStop[]>([]);

  useEffect(() => {
    if (existing) {
      setForm({
        client_name: existing.client_name,
        client_email: existing.client_email || '',
        booking_ref: existing.booking_ref || '',
        language: existing.language,
        title: existing.title,
        date_range: existing.date_range || '',
        participants: existing.participants || '',
        hero_image_url: existing.hero_image_url || '',
        summary_text: existing.summary_text || '',
        public_token: existing.public_token,
        status: existing.status,
      });
      setDays(existing.days.length > 0 ? existing.days : [{ ...emptyDay }]);
      setMapStops(existing.map_stops);
    }
  }, [existing]);

  const updateDay = (idx: number, field: keyof ProposalDay, value: any) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addDay = () => {
    setDays(prev => [...prev, { ...emptyDay, day_number: prev.length + 1 }]);
  };

  const removeDay = (idx: number) => {
    setDays(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day_number: i + 1 })));
  };

  const updateDayItem = (dayIdx: number, itemIdx: number, val: string) => {
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, items: d.items.map((it, j) => j === itemIdx ? val : it) } : d));
  };

  const addDayItem = (dayIdx: number) => {
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, items: [...d.items, ''] } : d));
  };

  const removeDayItem = (dayIdx: number, itemIdx: number) => {
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, items: d.items.filter((_, j) => j !== itemIdx) } : d));
  };

  const handleSave = async () => {
    const token = form.public_token || form.booking_ref?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `ytp-${Date.now()}`;
    const payload = {
      ...form,
      public_token: token,
      days: days as any,
      map_stops: mapStops as any,
    };

    if (isNew) {
      const result = await createProposal.mutateAsync(payload);
      navigate(`/proposals/${result.id}`);
    } else {
      await updateProposal.mutateAsync({ id: id!, ...payload });
      toast.success('Proposta guardada');
    }
  };

  const handleMarkSent = async () => {
    if (!isNew && id) {
      await updateProposal.mutateAsync({ id, status: 'sent', sent_at: new Date().toISOString() });
      toast.success('Proposta marcada como enviada');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{isNew ? 'Nova Proposta' : 'Editar Proposta'}</h1>
          <div className="flex gap-2">
            {!isNew && form.public_token && (
              <a href={`/proposal/${form.public_token}`} target="_blank" rel="noopener">
                <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Preview</Button>
              </a>
            )}
            {!isNew && form.status === 'draft' && (
              <Button variant="outline" size="sm" onClick={handleMarkSent}>Marcar Enviada</Button>
            )}
            <Button onClick={handleSave} size="sm"><Save className="h-4 w-4 mr-1" /> Guardar</Button>
          </div>
        </div>

        {/* Basic fields */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-semibold text-sm">Informação geral</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome cliente</label>
              <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ref. booking</label>
              <Input value={form.booking_ref} onChange={e => setForm(f => ({ ...f, booking_ref: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Idioma</label>
              <select
                value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Título</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Datas</label>
              <Input value={form.date_range} onChange={e => setForm(f => ({ ...f, date_range: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Participantes</label>
              <Input value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">URL imagem hero</label>
              <Input value={form.hero_image_url} onChange={e => setForm(f => ({ ...f, hero_image_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Resumo</label>
              <Textarea value={form.summary_text} onChange={e => setForm(f => ({ ...f, summary_text: e.target.value }))} rows={3} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Token público</label>
              <Input value={form.public_token} onChange={e => setForm(f => ({ ...f, public_token: e.target.value }))} placeholder="ytp-..." />
            </div>
          </div>
        </div>

        {/* Days */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Dias ({days.length})</h2>
            <Button variant="outline" size="sm" onClick={addDay}><Plus className="h-4 w-4 mr-1" /> Dia</Button>
          </div>

          {days.map((day, idx) => (
            <div key={idx} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary">Dia {day.day_number}</span>
                <Button variant="ghost" size="sm" onClick={() => removeDay(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Label data</label>
                  <Input value={day.date_label} onChange={e => updateDay(idx, 'date_label', e.target.value)} placeholder="Jour 1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Título</label>
                  <Input value={day.title} onChange={e => updateDay(idx, 'title', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Subtítulo</label>
                  <Input value={day.subtitle} onChange={e => updateDay(idx, 'subtitle', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Imagem cover URL</label>
                  <Input value={day.cover_image_url} onChange={e => updateDay(idx, 'cover_image_url', e.target.value)} />
                </div>
              </div>

              {/* Items */}
              <div>
                <label className="text-xs text-muted-foreground">Itens do dia</label>
                <div className="space-y-1.5 mt-1">
                  {day.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex gap-2">
                      <Input value={item} onChange={e => updateDayItem(idx, iIdx, e.target.value)} className="flex-1" placeholder="Item..." />
                      <Button variant="ghost" size="sm" onClick={() => removeDayItem(idx, iIdx)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addDayItem(idx)}><Plus className="h-3 w-3 mr-1" /> Item</Button>
                </div>
              </div>

              {/* Accommodation */}
              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Hotel className="h-3 w-3" /> Alojamento</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    value={day.accommodation?.hotel_name || ''}
                    onChange={e => updateDay(idx, 'accommodation', { ...day.accommodation, label: e.target.value, hotel_name: e.target.value, note: day.accommodation?.note || '' })}
                    placeholder="Nome do hotel"
                  />
                  <Input
                    value={day.accommodation?.note || ''}
                    onChange={e => updateDay(idx, 'accommodation', { ...day.accommodation, label: day.accommodation?.label || '', hotel_name: day.accommodation?.hotel_name || '', note: e.target.value })}
                    placeholder="Nota"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Map Stops */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Paragens do mapa</h2>
            <Button variant="outline" size="sm" onClick={() => setMapStops(prev => [...prev, { label: '', address: '', lat: 0, lng: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Paragem
            </Button>
          </div>
          {mapStops.map((stop, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-end">
              <Input value={stop.label} onChange={e => setMapStops(prev => prev.map((s, j) => j === i ? { ...s, label: e.target.value } : s))} placeholder="Label" />
              <Input value={stop.address} onChange={e => setMapStops(prev => prev.map((s, j) => j === i ? { ...s, address: e.target.value } : s))} placeholder="Morada" />
              <Input type="number" value={stop.lat} onChange={e => setMapStops(prev => prev.map((s, j) => j === i ? { ...s, lat: parseFloat(e.target.value) || 0 } : s))} placeholder="Lat" />
              <div className="flex gap-1">
                <Input type="number" value={stop.lng} onChange={e => setMapStops(prev => prev.map((s, j) => j === i ? { ...s, lng: parseFloat(e.target.value) || 0 } : s))} placeholder="Lng" />
                <Button variant="ghost" size="sm" onClick={() => setMapStops(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default ProposalBuilderPage;
