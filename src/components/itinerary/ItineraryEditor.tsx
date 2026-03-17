import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, ImagePlus, X, MapPin, Loader2, Link2, Upload, Sparkles, Eye, Copy, RefreshCw, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ItineraryImage {
  url: string;
  caption: string;
}

interface ItineraryDayData {
  id?: string;
  day_number: number;
  title: string;
  narrative: string;
  description: string;
  highlights: string[];
  inclusions: string[];
  images: ItineraryImage[];
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface ItineraryData {
  id?: string;
  lead_id: string;
  title: string;
  subtitle: string;
  cover_image_url: string;
  status: string;
  travel_dates: string;
  client_name: string;
  days: ItineraryDayData[];
}

interface ItineraryEditorProps {
  leadId: string;
  clientName: string;
  destination: string;
  travelDates: string;
  travelPlannerDays?: any[];
}

const PORTUGAL_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'lisboa': { lat: 38.7223, lng: -9.1393 },
  'porto': { lat: 41.1579, lng: -8.6291 },
  'sintra': { lat: 38.7981, lng: -9.3880 },
  'cascais': { lat: 38.6979, lng: -9.4215 },
  'faro': { lat: 37.0194, lng: -7.9322 },
  'algarve': { lat: 37.0179, lng: -7.9304 },
  'douro': { lat: 41.1621, lng: -7.7886 },
  'douro valley': { lat: 41.1621, lng: -7.7886 },
  'madeira': { lat: 32.6669, lng: -16.9241 },
  'azores': { lat: 37.7412, lng: -25.6756 },
  'coimbra': { lat: 40.2033, lng: -8.4103 },
  'évora': { lat: 38.5711, lng: -7.9092 },
  'braga': { lat: 41.5518, lng: -8.4229 },
  'guimarães': { lat: 41.4425, lng: -8.2918 },
  'setúbal': { lat: 38.5244, lng: -8.8882 },
  'arrábida': { lat: 38.4809, lng: -8.9786 },
  'óbidos': { lat: 39.3607, lng: -9.1571 },
  'nazaré': { lat: 39.6014, lng: -9.0691 },
  'tomar': { lat: 39.6036, lng: -8.4093 },
  'aveiro': { lat: 40.6405, lng: -8.6538 },
  'viana do castelo': { lat: 41.6936, lng: -8.8327 },
  'minho': { lat: 41.7500, lng: -8.3000 },
  'alentejo': { lat: 38.5667, lng: -7.9000 },
  'bairrada': { lat: 40.3833, lng: -8.5167 },
  'dão': { lat: 40.5333, lng: -7.8833 },
  'galicia': { lat: 42.6000, lng: -7.8500 },
  'vigo': { lat: 42.2314, lng: -8.7124 },
  'rías baixas': { lat: 42.3833, lng: -8.7333 },
};

function guessCoordinates(text: string): { lat: number; lng: number } | null {
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(PORTUGAL_LOCATIONS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

type GeneratingField = `narrative-${number}` | `highlights-${number}` | `inclusions-${number}` | `all-${number}` | 'cover-image' | null;

const ItineraryEditor = ({ leadId, clientName, destination, travelDates, travelPlannerDays }: ItineraryEditorProps) => {
  const { toast } = useToast();
  const [itinerary, setItinerary] = useState<ItineraryData>({
    lead_id: leadId,
    title: '',
    subtitle: '',
    cover_image_url: '',
    status: 'draft',
    travel_dates: travelDates,
    client_name: clientName,
    days: [],
  });
  const [expandedDays, setExpandedDays] = useState<number[]>([1]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loadingImages, setLoadingImages] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState<GeneratingField>(null);

  // Load existing itinerary
  useEffect(() => {
    loadItinerary();
  }, [leadId]);

  const loadItinerary = async () => {
    const { data: existing } = await supabase
      .from('itineraries')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data: days } = await supabase
        .from('itinerary_days')
        .select('*')
        .eq('itinerary_id', existing.id)
        .order('day_number');

      setItinerary({
        id: existing.id,
        lead_id: existing.lead_id,
        title: existing.title || '',
        subtitle: existing.subtitle || '',
        cover_image_url: existing.cover_image_url || '',
        status: existing.status,
        travel_dates: existing.travel_dates || travelDates,
        client_name: existing.client_name || clientName,
        days: (days || []).map(d => ({
          id: d.id,
          day_number: d.day_number,
          title: d.title || '',
          narrative: d.narrative || '',
          description: d.description || '',
          highlights: d.highlights || [],
          inclusions: d.inclusions || [],
          images: (d.images as any[]) || [],
          location_name: d.location_name || '',
          latitude: d.latitude ? Number(d.latitude) : null,
          longitude: d.longitude ? Number(d.longitude) : null,
        })),
      });

      if (existing.status === 'published') {
        setPreviewUrl(`${window.location.origin}/preview/${existing.id}`);
      }
    }
    setLoaded(true);
  };

  // Populate from travel planner
  useEffect(() => {
    if (loaded && itinerary.days.length === 0 && travelPlannerDays && travelPlannerDays.length > 0) {
      const days: ItineraryDayData[] = travelPlannerDays.map((d: any, i: number) => {
        const title = d.title || `Dia ${i + 1}`;
        const coords = guessCoordinates(title + ' ' + (d.description || ''));
        return {
          day_number: d.day || i + 1,
          title,
          narrative: d.description || '',
          description: d.description || '',
          highlights: (d.activities || []).map((a: any) => a.activity).slice(0, 4),
          inclusions: (d.activities || []).map((a: any) => `${a.time ? a.time + ' - ' : ''}${a.activity}`),
          images: [],
          location_name: coords ? Object.entries(PORTUGAL_LOCATIONS).find(([_, c]) => c.lat === coords.lat)?.[0] || '' : '',
          latitude: coords?.lat || null,
          longitude: coords?.lng || null,
        };
      });
      setItinerary(prev => ({
        ...prev,
        title: `${clientName} | ${destination}`,
        subtitle: travelDates,
        days,
      }));
    }
  }, [loaded, travelPlannerDays]);

  const toggleDay = (day: number) => {
    setExpandedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const updateDay = (index: number, updates: Partial<ItineraryDayData>) => {
    setItinerary(prev => {
      const days = [...prev.days];
      days[index] = { ...days[index], ...updates };
      if (updates.location_name || updates.title) {
        const text = (updates.location_name || days[index].location_name) + ' ' + (updates.title || days[index].title);
        const coords = guessCoordinates(text);
        if (coords) {
          days[index].latitude = coords.lat;
          days[index].longitude = coords.lng;
        }
      }
      return { ...prev, days };
    });
  };

  const addDay = () => {
    const newDay: ItineraryDayData = {
      day_number: itinerary.days.length + 1,
      title: '',
      narrative: '',
      description: '',
      highlights: [],
      inclusions: [],
      images: [],
      location_name: '',
      latitude: null,
      longitude: null,
    };
    setItinerary(prev => ({ ...prev, days: [...prev.days, newDay] }));
    setExpandedDays(prev => [...prev, newDay.day_number]);
  };

  const removeDay = (index: number) => {
    setItinerary(prev => ({
      ...prev,
      days: prev.days.filter((_, i) => i !== index).map((d, i) => ({ ...d, day_number: i + 1 })),
    }));
  };

  const addHighlight = (dayIndex: number) => {
    updateDay(dayIndex, { highlights: [...itinerary.days[dayIndex].highlights, ''] });
  };

  const updateHighlight = (dayIndex: number, hIndex: number, value: string) => {
    const highlights = [...itinerary.days[dayIndex].highlights];
    highlights[hIndex] = value;
    updateDay(dayIndex, { highlights });
  };

  const removeHighlight = (dayIndex: number, hIndex: number) => {
    updateDay(dayIndex, { highlights: itinerary.days[dayIndex].highlights.filter((_, i) => i !== hIndex) });
  };

  const addInclusion = (dayIndex: number) => {
    updateDay(dayIndex, { inclusions: [...itinerary.days[dayIndex].inclusions, ''] });
  };

  const updateInclusion = (dayIndex: number, iIndex: number, value: string) => {
    const inclusions = [...itinerary.days[dayIndex].inclusions];
    inclusions[iIndex] = value;
    updateDay(dayIndex, { inclusions });
  };

  const removeInclusion = (dayIndex: number, iIndex: number) => {
    updateDay(dayIndex, { inclusions: itinerary.days[dayIndex].inclusions.filter((_, i) => i !== iIndex) });
  };

  const updateImage = (dayIndex: number, imgIndex: number, updates: Partial<ItineraryImage>) => {
    const images = [...itinerary.days[dayIndex].images];
    images[imgIndex] = { ...images[imgIndex], ...updates };
    updateDay(dayIndex, { images });
  };

  const removeImage = (dayIndex: number, imgIndex: number) => {
    updateDay(dayIndex, { images: itinerary.days[dayIndex].images.filter((_, i) => i !== imgIndex) });
  };

  const addImageSlot = (dayIndex: number) => {
    if (itinerary.days[dayIndex].images.length >= 3) return;
    updateDay(dayIndex, { images: [...itinerary.days[dayIndex].images, { url: '', caption: '' }] });
  };

  // ──── AI Content Generation ────

  const generateContent = async (dayIndex: number, type: 'narrative' | 'highlights' | 'inclusions' | 'all') => {
    const day = itinerary.days[dayIndex];
    const fieldKey = `${type}-${dayIndex}` as GeneratingField;
    setGenerating(fieldKey);
    try {
      const { data, error } = await supabase.functions.invoke('generate-itinerary-content', {
        body: {
          type,
          dayTitle: day.title,
          dayNumber: day.day_number,
          location: day.location_name,
          destination,
          existingHighlights: day.highlights.filter(Boolean),
          existingInclusions: day.inclusions.filter(Boolean),
          existingNarrative: day.narrative,
          clientName,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const updates: Partial<ItineraryDayData> = {};
      if (data.narrative) updates.narrative = data.narrative;
      if (data.highlights?.length) updates.highlights = data.highlights;
      if (data.inclusions?.length) updates.inclusions = data.inclusions;

      updateDay(dayIndex, updates);

      const labels = { narrative: 'Narrativa', highlights: 'Destaques', inclusions: 'Inclusões', all: 'Conteúdo completo' };
      toast({ title: `✨ ${labels[type]} gerado!`, description: `Dia ${day.day_number} atualizado com AI` });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar conteúdo', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  // ──── Smart Image Queries ────

  // Build unique, complementary search queries for each image slot
  const buildSmartImageQueries = (day: ItineraryDayData, count: number): string[] => {
    const queries: string[] = [];
    const location = day.location_name || destination;
    const allItems = [...day.highlights, ...day.inclusions].filter(Boolean);

    // First image: main location/title
    queries.push(`${day.title} ${location} Portugal landscape`);

    // Subsequent images: based on specific highlights/inclusions to avoid repetition
    for (let i = 1; i < count; i++) {
      if (allItems[i - 1]) {
        queries.push(`${allItems[i - 1]} ${location} Portugal`);
      } else if (allItems.length > 0) {
        queries.push(`${allItems[i % allItems.length]} ${location} Portugal detail`);
      } else {
        queries.push(`${location} Portugal ${i === 1 ? 'culture' : 'nature'} travel`);
      }
    }
    return queries.map(q => q.slice(0, 120));
  };

  // AI image auto-fill for a day (smart per-slot queries)
  const autoFillImages = async (dayIndex: number) => {
    const day = itinerary.days[dayIndex];
    setLoadingImages(dayIndex);
    try {
      const queries = buildSmartImageQueries(day, 3);
      const imageResults: ItineraryImage[] = [];

      // Fetch images with different queries for variety
      for (let i = 0; i < queries.length; i++) {
        const { data, error } = await supabase.functions.invoke('search-destination-images', {
          body: { query: queries[i], count: 1, mode: 'search' },
        });
        if (!error && data?.images?.[0]) {
          imageResults.push({
            url: data.images[0].url,
            caption: data.images[0].caption || day.title,
          });
        }
      }

      if (imageResults.length > 0) {
        updateDay(dayIndex, { images: imageResults });
        toast({ title: 'Imagens encontradas', description: `${imageResults.length} imagens adicionadas ao Dia ${day.day_number}` });
      } else {
        toast({ title: 'Sem imagens encontradas', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao buscar imagens', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingImages(null);
    }
  };

  // ──── Cover Image (always main destination) ────

  const autoFillCoverImage = async () => {
    setGenerating('cover-image');
    try {
      const query = `${destination} Portugal panoramic skyline landmark`;
      const { data, error } = await supabase.functions.invoke('search-destination-images', {
        body: { query, count: 1, mode: 'search' },
      });
      if (error) throw error;
      if (data?.images?.[0]) {
        setItinerary(prev => ({ ...prev, cover_image_url: data.images[0].url }));
        toast({ title: '🖼️ Imagem de capa gerada!', description: `Imagem de ${destination} adicionada` });
      } else {
        toast({ title: 'Sem imagens encontradas', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  // Regenerate a single image
  const [regenIdx, setRegenIdx] = useState<string | null>(null);
  const regenerateImage = async (dayIndex: number, imgIndex: number) => {
    const day = itinerary.days[dayIndex];
    const key = `${dayIndex}-${imgIndex}`;
    setRegenIdx(key);
    try {
      // Use specific highlight/inclusion for this slot to get a unique image
      const allItems = [...day.highlights, ...day.inclusions].filter(Boolean);
      const specificItem = allItems[imgIndex] || allItems[0] || '';
      const query = `${specificItem} ${day.location_name || destination} Portugal`;
      const { data, error } = await supabase.functions.invoke('search-destination-images', {
        body: { query, count: 1, mode: 'search' },
      });
      if (error) throw error;
      if (data?.images?.[0]) {
        updateImage(dayIndex, imgIndex, { url: data.images[0].url, caption: data.images[0].caption });
        toast({ title: 'Imagem regenerada' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setRegenIdx(null);
    }
  };

  // Handle file upload for an image slot
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ dayIdx: number; imgIdx: number } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `itinerary-images/${leadId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('supplier-files').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      
      const { data: urlData } = supabase.storage.from('supplier-files').getPublicUrl(path);
      updateImage(uploadTarget.dayIdx, uploadTarget.imgIdx, { url: urlData.publicUrl, caption: file.name.replace(/\.[^.]+$/, '') });
      toast({ title: 'Imagem carregada' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = (dayIdx: number, imgIdx: number) => {
    setUploadTarget({ dayIdx, imgIdx });
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  // Save itinerary to DB
  const saveItinerary = async (publish = false) => {
    setSaving(true);
    try {
      const status = publish ? 'published' : itinerary.status === 'published' ? 'published' : 'draft';
      let itineraryId = itinerary.id;

      if (itineraryId) {
        await supabase.from('itineraries').update({
          title: itinerary.title,
          subtitle: itinerary.subtitle,
          cover_image_url: itinerary.cover_image_url || itinerary.days[0]?.images?.[0]?.url || '',
          status,
          travel_dates: itinerary.travel_dates,
          client_name: itinerary.client_name,
          updated_at: new Date().toISOString(),
        }).eq('id', itineraryId);

        await supabase.from('itinerary_days').delete().eq('itinerary_id', itineraryId);
      } else {
        const { data: newIt, error } = await supabase.from('itineraries').insert({
          lead_id: itinerary.lead_id,
          title: itinerary.title,
          subtitle: itinerary.subtitle,
          cover_image_url: itinerary.cover_image_url || itinerary.days[0]?.images?.[0]?.url || '',
          status,
          travel_dates: itinerary.travel_dates,
          client_name: itinerary.client_name,
        }).select('id').single();
        if (error) throw error;
        itineraryId = newIt.id;
      }

      if (itinerary.days.length > 0) {
        const daysToInsert = itinerary.days.map(d => ({
          itinerary_id: itineraryId!,
          day_number: d.day_number,
          title: d.title,
          narrative: d.narrative,
          description: d.description,
          highlights: d.highlights,
          inclusions: d.inclusions,
          images: d.images as any,
          location_name: d.location_name,
          latitude: d.latitude,
          longitude: d.longitude,
        }));
        const { error: dErr } = await supabase.from('itinerary_days').insert(daysToInsert);
        if (dErr) throw dErr;
      }

      setItinerary(prev => ({ ...prev, id: itineraryId!, status }));

      if (publish) {
        const url = `${window.location.origin}/preview/${itineraryId}`;
        setPreviewUrl(url);
        toast({ title: 'Itinerário publicado!', description: 'Link de preview gerado com sucesso.' });
      } else {
        toast({ title: 'Guardado com sucesso' });
      }

      await loadItinerary();
    } catch (e: any) {
      toast({ title: 'Erro ao guardar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const copyPreviewLink = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl);
      toast({ title: 'Link copiado!' });
    }
  };

  const isGenerating = (field: string) => generating === field;

  return (
    <div className="space-y-4">
      {/* Hidden file input for uploads */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-foreground">Itinerário Digital (Customer-Facing)</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => saveItinerary(false)} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Guardar Rascunho
          </Button>
          <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--stable,152_60%_40%))] text-white"
            onClick={() => { setPublishing(true); saveItinerary(true); }} disabled={saving || itinerary.days.length === 0}>
            {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
            Gerar Preview Link
          </Button>
        </div>
      </div>

      {/* Preview URL */}
      {previewUrl && (
        <div className="flex items-center gap-2 bg-[hsl(var(--success-muted))] border border-[hsl(var(--success)/0.3)] rounded-lg px-3 py-2">
          <Link2 className="h-4 w-4 text-[hsl(var(--success))]" />
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(var(--success))] font-medium hover:underline flex-1 truncate">
            {previewUrl}
          </a>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={copyPreviewLink}>
            <Copy className="h-3 w-3" /> Copiar
          </Button>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Eye className="h-3 w-3" /> Abrir
            </Button>
          </a>
        </div>
      )}

      {/* Itinerary meta */}
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Título do Itinerário</label>
            <Input className="h-8 text-xs mt-1" value={itinerary.title}
              onChange={e => setItinerary(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Kolick Private Journey | Wines & Traditions" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Subtítulo</label>
            <Input className="h-8 text-xs mt-1" value={itinerary.subtitle}
              onChange={e => setItinerary(prev => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Ex: 24th May - 5th June 2026" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-muted-foreground uppercase">Imagem de Capa (Destino Principal)</label>
            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={autoFillCoverImage}
              disabled={generating === 'cover-image' || !destination}>
              {generating === 'cover-image' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Auto-gerar de {destination || 'destino'}
            </Button>
          </div>
          <Input className="h-8 text-xs" value={itinerary.cover_image_url}
            onChange={e => setItinerary(prev => ({ ...prev, cover_image_url: e.target.value }))}
            placeholder="https://..." />
          {itinerary.cover_image_url && (
            <div className="mt-2 aspect-[21/9] rounded-lg overflow-hidden bg-muted border max-h-32">
              <img src={itinerary.cover_image_url} alt="Cover" className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
            </div>
          )}
        </div>
      </div>

      {/* Days editor */}
      <div className="bg-card rounded-lg border">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{itinerary.days.length} Dias</span>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={addDay}>
            <Plus className="h-3 w-3" /> Adicionar Dia
          </Button>
        </div>

        <div className="divide-y divide-border">
          {itinerary.days.map((day, dayIndex) => {
            const expanded = expandedDays.includes(day.day_number);
            return (
              <div key={dayIndex}>
                <button onClick={() => toggleDay(day.day_number)}
                  className="w-full flex items-center gap-3 p-3 px-4 hover:bg-muted/30 transition-colors text-left">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--info))] text-white text-xs font-bold shrink-0">
                    {day.day_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {day.title || <span className="text-muted-foreground italic">Sem título</span>}
                    </p>
                    {day.location_name && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> {day.location_name}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{day.images.length}/3 imgs</span>
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Generate All button */}
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="text-[10px] gap-1 border-[hsl(var(--info)/0.3)] text-[hsl(var(--info))] hover:bg-[hsl(var(--info)/0.05)]"
                        onClick={() => generateContent(dayIndex, 'all')}
                        disabled={isGenerating(`all-${dayIndex}`) || !day.title}>
                        {isGenerating(`all-${dayIndex}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        Gerar tudo com AI
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Título do Dia</label>
                        <Input className="h-8 text-xs mt-1" value={day.title}
                          onChange={e => updateDay(dayIndex, { title: e.target.value })}
                          placeholder="Ex: Sintra & Cascais All-Inclusive" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Localização</label>
                        <Input className="h-8 text-xs mt-1" value={day.location_name}
                          onChange={e => updateDay(dayIndex, { location_name: e.target.value })}
                          placeholder="Ex: Sintra" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Latitude</label>
                        <Input className="h-8 text-xs mt-1" type="number" step="any"
                          value={day.latitude ?? ''} onChange={e => updateDay(dayIndex, { latitude: e.target.value ? parseFloat(e.target.value) : null })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Longitude</label>
                        <Input className="h-8 text-xs mt-1" type="number" step="any"
                          value={day.longitude ?? ''} onChange={e => updateDay(dayIndex, { longitude: e.target.value ? parseFloat(e.target.value) : null })} />
                      </div>
                    </div>

                    {/* Narrative with AI generate */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-muted-foreground uppercase">Narrativa (texto inspiracional)</label>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-[hsl(var(--info))]"
                          onClick={() => generateContent(dayIndex, 'narrative')}
                          disabled={isGenerating(`narrative-${dayIndex}`) || !day.title}>
                          {isGenerating(`narrative-${dayIndex}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Gerar com AI
                        </Button>
                      </div>
                      <Textarea className="text-xs min-h-[80px]" value={day.narrative}
                        onChange={e => updateDay(dayIndex, { narrative: e.target.value })}
                        placeholder="Texto inspiracional sobre o dia..." />
                    </div>

                    {/* Highlights with AI generate */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-muted-foreground uppercase">Destaques</label>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-[hsl(var(--info))]"
                            onClick={() => generateContent(dayIndex, 'highlights')}
                            disabled={isGenerating(`highlights-${dayIndex}`) || !day.title}>
                            {isGenerating(`highlights-${dayIndex}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Gerar com AI
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => addHighlight(dayIndex)}>
                            <Plus className="h-3 w-3" /> Adicionar
                          </Button>
                        </div>
                      </div>
                      {day.highlights.map((h, hIndex) => (
                        <div key={hIndex} className="flex items-center gap-1 mb-1">
                          <Input className="h-7 text-xs flex-1" value={h}
                            onChange={e => updateHighlight(dayIndex, hIndex, e.target.value)}
                            placeholder="Ex: Visita ao Palácio da Pena" />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeHighlight(dayIndex, hIndex)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Inclusions with AI generate */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-muted-foreground uppercase">Inclusões</label>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-[hsl(var(--info))]"
                            onClick={() => generateContent(dayIndex, 'inclusions')}
                            disabled={isGenerating(`inclusions-${dayIndex}`) || !day.title}>
                            {isGenerating(`inclusions-${dayIndex}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Gerar com AI
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => addInclusion(dayIndex)}>
                            <Plus className="h-3 w-3" /> Adicionar
                          </Button>
                        </div>
                      </div>
                      {day.inclusions.map((inc, iIndex) => (
                        <div key={iIndex} className="flex items-center gap-1 mb-1">
                          <Input className="h-7 text-xs flex-1" value={inc}
                            onChange={e => updateInclusion(dayIndex, iIndex, e.target.value)}
                            placeholder="Ex: Almoço incluído no restaurante..." />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeInclusion(dayIndex, iIndex)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Images */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] text-muted-foreground uppercase">Imagens ({day.images.length}/3)</label>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => autoFillImages(dayIndex)}
                          disabled={loadingImages === dayIndex}>
                          {loadingImages === dayIndex ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Auto-preencher com AI
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {day.images.map((img, imgIndex) => {
                          const isRegening = regenIdx === `${dayIndex}-${imgIndex}`;
                          return (
                            <div key={imgIndex} className="relative group">
                              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted border">
                                {img.url ? (
                                  <img src={img.url} alt={img.caption} className="w-full h-full object-cover"
                                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <ImagePlus className="h-6 w-6" />
                                  </div>
                                )}
                              </div>
                              {/* Overlay actions */}
                              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => regenerateImage(dayIndex, imgIndex)} disabled={isRegening}
                                  className="bg-background/90 backdrop-blur text-foreground rounded-full w-6 h-6 flex items-center justify-center border shadow-sm hover:bg-muted" title="Regenerar">
                                  {isRegening ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                </button>
                                <button onClick={() => triggerUpload(dayIndex, imgIndex)}
                                  className="bg-background/90 backdrop-blur text-foreground rounded-full w-6 h-6 flex items-center justify-center border shadow-sm hover:bg-muted" title="Upload">
                                  <Upload className="h-3 w-3" />
                                </button>
                                <button onClick={() => removeImage(dayIndex, imgIndex)}
                                  className="bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-sm" title="Remover">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                              <Input className="h-6 text-[10px] mt-1" value={img.caption}
                                onChange={e => updateImage(dayIndex, imgIndex, { caption: e.target.value })}
                                placeholder="Legenda..." />
                              <Input className="h-6 text-[10px] mt-0.5" value={img.url}
                                onChange={e => updateImage(dayIndex, imgIndex, { url: e.target.value })}
                                placeholder="URL da imagem..." />
                            </div>
                          );
                        })}
                        {day.images.length < 3 && (
                          <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2">
                            <button onClick={() => addImageSlot(dayIndex)}
                              className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors">
                              <ImagePlus className="h-5 w-5 mb-0.5" />
                              <span className="text-[10px]">URL / Cole link</span>
                            </button>
                            <button onClick={() => {
                              addImageSlot(dayIndex);
                              setTimeout(() => triggerUpload(dayIndex, day.images.length), 100);
                            }}
                              className="flex items-center gap-1 text-[10px] text-[hsl(var(--info))] hover:underline">
                              <Upload className="h-3 w-3" /> Upload ficheiro
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1" onClick={() => removeDay(dayIndex)}>
                        <Trash2 className="h-3 w-3" /> Remover Dia
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {itinerary.days.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum dia adicionado ainda</p>
            <p className="text-xs text-muted-foreground">Gere o Travel Planner primeiro para pré-preencher, ou adicione dias manualmente.</p>
            <Button variant="outline" size="sm" className="text-xs gap-1 mt-2" onClick={addDay}>
              <Plus className="h-3 w-3" /> Começar Itinerário
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItineraryEditor;
