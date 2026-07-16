import { useRef, useState } from 'react';
import { Loader2, MapPin, FileText, Upload, X, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  leadId: string;
  routeMapPath?: string | null;
  exactItineraryPdfPath?: string | null;
}

const BUCKET = 'lead-context';

export function LeadContextAttachments({ leadId, routeMapPath, exactItineraryPdfPath }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const mapInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [mapUploading, setMapUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['lead', leadId] });
  };

  // fetch signed thumbnail for map preview
  const loadMapThumb = async (path: string) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) setMapUrl(data.signedUrl);
  };
  if (routeMapPath && !mapUrl) loadMapThumb(routeMapPath);

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
    setPdfUploading(true);
    try {
      await uploadFile(file, 'pdf');
      toast({ title: '📄 Exact Itinerary carregado', description: 'O planner vai seguir este PDF literalmente.' });
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
      toast({ title: 'Removido' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-muted-foreground uppercase">Contexto extra para o Travel Planner</label>
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
          <span><strong>Modo Exact ativo</strong> — o planner vai seguir literalmente a estrutura deste PDF.</span>
        </div>
      )}
    </div>
  );
}
