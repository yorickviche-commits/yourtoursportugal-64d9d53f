import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, FileText, Upload, X, Sparkles, Link2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { parseGoogleMapsUrl } from '@/lib/mapEmbed';

export interface RouteDayMap { day: number; url: string }

interface Props {
  leadId: string;
  routeMapPath?: string | null;
  exactItineraryPdfPath?: string | null;
  routeMapUrl?: string | null;
  routeDayMaps?: RouteDayMap[] | null;
  numberOfDays?: number | null;
}


const BUCKET = 'lead-context';
const MAX_PDF_BYTES = 7 * 1024 * 1024;
const WARN_PDF_BYTES = 4 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function filenameFromPath(path?: string | null) {
  return path?.split('/').pop() || 'exact-itinerary.pdf';
}

const MAPS_RE = /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

export function LeadContextAttachments({ leadId, routeMapPath, exactItineraryPdfPath, routeMapUrl, routeDayMaps, numberOfDays }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const mapInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [mapUploading, setMapUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [pdfSizeLabel, setPdfSizeLabel] = useState<string>('');
  const [linkDraft, setLinkDraft] = useState<string>(routeMapUrl || '');
  const [linkSaving, setLinkSaving] = useState(false);

  const savedDayMaps: RouteDayMap[] = Array.isArray(routeDayMaps) ? routeDayMaps : [];
  const initialDayDrafts = () => {
    const base = Math.max(savedDayMaps.length, numberOfDays && numberOfDays > 1 ? numberOfDays : 0, 1);
    return Array.from({ length: base }, (_, i) => savedDayMaps.find(d => d.day === i + 1)?.url || '');
  };
  const [dayDrafts, setDayDrafts] = useState<string[]>(initialDayDrafts);
  const [daysSaving, setDaysSaving] = useState(false);

  useEffect(() => { setDayDrafts(initialDayDrafts()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(savedDayMaps), numberOfDays]);

  const dayDirty = JSON.stringify(dayDrafts.map((url, i) => ({ day: i + 1, url: url.trim() })).filter(d => d.url))
    !== JSON.stringify(savedDayMaps.filter(d => d.url).map(d => ({ day: d.day, url: d.url.trim() })));

  const saveDayMaps = async () => {
    const payload = dayDrafts.map((url, i) => ({ day: i + 1, url: url.trim() })).filter(d => d.url);
    const invalid = payload.find(d => !MAPS_RE.test(d.url));
    if (invalid) {
      toast({ title: `Link inválido no Dia ${invalid.day}`, description: 'Cola um link do Google Maps.', variant: 'destructive' });
      return;
    }
    setDaysSaving(true);
    try {
      const { error } = await supabase.from('leads').update({ route_day_maps: payload } as any).eq('id', leadId);
      if (error) throw error;
      toast({ title: '🧭 Rotas por dia guardadas', description: `${payload.length} dia(s) com rota — o Travel Planner vai seguir cada rota no dia respetivo.` });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setDaysSaving(false); }
  };

  useEffect(() => { setLinkDraft(routeMapUrl || ''); }, [routeMapUrl]);


  const parsedLink = parseGoogleMapsUrl(routeMapUrl || '');

  const saveLink = async (value: string | null) => {
    const clean = value?.trim() || null;
    if (clean && !/^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(clean)) {
      toast({ title: 'Link inválido', description: 'Cola um link do Google Maps (google.com/maps/... ou maps.app.goo.gl/...).', variant: 'destructive' });
      return;
    }
    setLinkSaving(true);
    try {
      const { error } = await supabase.from('leads').update({ route_map_url: clean } as any).eq('id', leadId);
      if (error) throw error;
      toast({
        title: clean ? '🧭 Rota Google Maps guardada' : 'Rota removida',
        description: clean ? 'O Travel Planner vai seguir esta rota como base do programa.' : undefined,
      });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setLinkSaving(false); }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['lead', leadId] });
  };

  // fetch signed thumbnail for map preview
  const loadMapThumb = async (path: string) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) setMapUrl(data.signedUrl);
  };
  useEffect(() => {
    if (routeMapPath) loadMapThumb(routeMapPath);
    else setMapUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMapPath]);

  const uploadFile = async (file: File, kind: 'map' | 'pdf') => {
    const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'pdf' ? 'pdf' : 'png');
    const path = `${leadId}/${kind === 'map' ? 'route-map' : 'exact-itinerary'}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true, contentType: file.type,
    });
    if (upErr) throw upErr;
    const column = kind === 'map' ? 'route_map_path' : 'exact_itinerary_pdf_path';
    const { error: updErr } = await supabase.from('leads').update({ [column]: path }).eq('id', leadId);
    if (updErr) throw updErr;
    return path;
  };

  const handleMap = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Formato inválido', description: 'Anexa um PNG/JPG/WEBP.', variant: 'destructive' });
      return;
    }
    setMapUploading(true);
    try {
      const path = await uploadFile(file, 'map');
      setMapUrl(null);
      await loadMapThumb(path);
      toast({ title: '🗺️ Mapa anexado', description: 'Vai ser usado como contexto no Travel Planner.' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally { setMapUploading(false); }
  };

  const handlePdf = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Formato inválido', description: 'Anexa um PDF.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast({
        title: 'PDF demasiado pesado',
        description: `Este ficheiro tem ${formatFileSize(file.size)}. Limite seguro: ${formatFileSize(MAX_PDF_BYTES)}. Exporta/compacta o PDF e volta a carregar.`,
        variant: 'destructive',
      });
      return;
    }
    setPdfUploading(true);
    try {
      await uploadFile(file, 'pdf');
      setPdfSizeLabel(formatFileSize(file.size));
      toast({
        title: file.size > WARN_PDF_BYTES ? '📄 Exact Itinerary carregado — ficheiro pesado' : '📄 Exact Itinerary carregado',
        description: file.size > WARN_PDF_BYTES
          ? 'Vai ser usado em modo seguro. Se falhar, exporta uma versão mais leve/textual.'
          : 'O planner vai seguir este PDF literalmente.',
      });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally { setPdfUploading(false); }
  };

  const removeAttachment = async (kind: 'map' | 'pdf') => {
    const path = kind === 'map' ? routeMapPath : exactItineraryPdfPath;
    if (!path) return;
    try {
      await supabase.storage.from(BUCKET).remove([path]);
      const column = kind === 'map' ? 'route_map_path' : 'exact_itinerary_pdf_path';
      await supabase.from('leads').update({ [column]: null }).eq('id', leadId);
      if (kind === 'map') setMapUrl(null);
      if (kind === 'pdf') setPdfSizeLabel('');
      toast({ title: 'Removido' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-muted-foreground uppercase">Contexto extra para o Travel Planner</label>

      {/* Google Maps route link */}
      <div className="border rounded-md p-2 bg-muted/30 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1"><Link2 className="h-3 w-3 text-blue-600" /> Link Google Maps da rota exata <span className="text-muted-foreground/70 font-normal">(opcional)</span></p>
        <div className="flex gap-2">
          <input
            value={linkDraft}
            onChange={e => setLinkDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveLink(linkDraft); } }}
            placeholder="https://www.google.com/maps/dir/Porto/Douro/Lisboa"
            className="flex-1 h-8 rounded border bg-background px-2 text-xs"
          />
          <button
            type="button"
            onClick={() => saveLink(linkDraft)}
            disabled={linkSaving || linkDraft.trim() === (routeMapUrl || '').trim()}
            className="h-8 px-2 rounded bg-primary text-primary-foreground text-[11px] flex items-center gap-1 disabled:opacity-40"
          >
            {linkSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
          </button>
          {routeMapUrl && (
            <button
              type="button"
              onClick={() => { setLinkDraft(''); saveLink(null); }}
              className="h-8 px-2 rounded border text-[11px] text-red-600 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Remover
            </button>
          )}
        </div>

        {routeMapUrl && (
          <>
            {parsedLink.waypoints.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Pontos detetados: <span className="text-foreground">{parsedLink.waypoints.join(' → ')}</span>
              </p>
            )}
            {parsedLink.embedSrc ? (
              <iframe
                src={parsedLink.embedSrc}
                title="Rota Google Maps"
                className="w-full h-40 rounded border"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Link curto guardado (sem pré-visualização). <a href={routeMapUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Abrir no Google Maps</a>
              </p>
            )}
            <div className="flex items-center gap-1.5 text-[11px] bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-1">
              <Sparkles className="h-3 w-3" />
              <span><strong>Rota ativa</strong> — o Travel Planner vai usar esta sequência geográfica como base do programa.</span>
            </div>
          </>
        )}
      </div>

      {/* Per-day Google Maps routes (multi-day programmes) */}
      <div className="border rounded-md p-2 bg-muted/30 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium flex items-center gap-1">
            <Link2 className="h-3 w-3 text-blue-600" /> Rota Google Maps por dia <span className="text-muted-foreground/70 font-normal">(multi-dia, opcional)</span>
          </p>
          <button
            type="button"
            onClick={saveDayMaps}
            disabled={daysSaving || !dayDirty}
            className="h-7 px-2 rounded bg-primary text-primary-foreground text-[11px] flex items-center gap-1 disabled:opacity-40"
          >
            {daysSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar rotas
          </button>
        </div>

        <div className="space-y-1.5">
          {dayDrafts.map((url, i) => {
            const parsed = parseGoogleMapsUrl(url);
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0 text-[10px] font-semibold text-muted-foreground uppercase">Dia {i + 1}</span>
                  <input
                    value={url}
                    onChange={e => setDayDrafts(prev => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveDayMaps(); } }}
                    placeholder="https://www.google.com/maps/dir/..."
                    className="flex-1 h-8 rounded border bg-background px-2 text-xs"
                  />
                  <button
                    type="button"
                    title="Remover dia"
                    onClick={() => setDayDrafts(prev => prev.filter((_, idx) => idx !== i))}
                    className="h-8 w-8 rounded border text-red-600 flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {url.trim() && parsed.waypoints.length > 0 && (
                  <p className="pl-[3.6rem] text-[10px] text-muted-foreground">{parsed.waypoints.join(' → ')}</p>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setDayDrafts(prev => [...prev, ''])}
          className="h-7 px-2 rounded border text-[11px] flex items-center gap-1"
        >
          + Adicionar dia
        </button>

        {savedDayMaps.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-1">
            <Sparkles className="h-3 w-3" />
            <span><strong>{savedDayMaps.length} rota(s) por dia ativas</strong> — cada dia do programa é gerado a seguir a sua própria rota e o mapa fica no dia correspondente.</span>
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Route Map slot */}
        <div className="border rounded-md p-2 bg-muted/30">
          <input ref={mapInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleMap(e.target.files[0])} />
          {routeMapPath ? (
            <div className="flex items-center gap-2">
              {mapUrl ? (
                <img src={mapUrl} alt="Route map" className="h-14 w-20 object-cover rounded border" />
              ) : (
                <div className="h-14 w-20 bg-muted rounded flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-600" /> Rota Google Maps</p>
                <div className="flex gap-2 mt-1">
                  <button className="text-[10px] text-blue-600 hover:underline" onClick={() => mapInputRef.current?.click()}>Substituir</button>
                  <button className="text-[10px] text-red-600 hover:underline" onClick={() => removeAttachment('map')}>Remover</button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => mapInputRef.current?.click()}
              disabled={mapUploading}
              className="w-full flex items-center gap-2 py-2 px-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition"
            >
              {mapUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-blue-600" />}
              <span className="flex-1 text-left">🗺️ Rota Google Maps <span className="text-muted-foreground/70">(opcional)</span></span>
              <Upload className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Exact Itinerary PDF slot */}
        <div className="border rounded-md p-2 bg-muted/30">
          <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handlePdf(e.target.files[0])} />
          {exactItineraryPdfPath ? (
            <div className="flex items-center gap-2">
              <div className="h-14 w-20 bg-amber-50 border border-amber-200 rounded flex items-center justify-center">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium flex items-center gap-1"><FileText className="h-3 w-3 text-amber-600" /> Exact Itinerary PDF</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {filenameFromPath(exactItineraryPdfPath)}{pdfSizeLabel ? ` · ${pdfSizeLabel}` : ''}
                </p>
                <div className="flex gap-2 mt-1">
                  <button className="text-[10px] text-blue-600 hover:underline" onClick={() => pdfInputRef.current?.click()}>Substituir</button>
                  <button className="text-[10px] text-red-600 hover:underline" onClick={() => removeAttachment('pdf')}>Remover</button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfUploading}
              className="w-full flex items-center gap-2 py-2 px-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition"
            >
              {pdfUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-amber-600" />}
              <span className="flex-1 text-left">📄 Exact Itinerary PDF <span className="text-muted-foreground/70">(opcional)</span></span>
              <Upload className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {exactItineraryPdfPath && (
        <div className="flex items-center gap-1.5 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1">
          <Sparkles className="h-3 w-3" />
          <span><strong>Modo Exact ativo</strong> — o planner vai seguir literalmente a estrutura deste PDF em modo seguro.</span>
        </div>
      )}
    </div>
  );
}
