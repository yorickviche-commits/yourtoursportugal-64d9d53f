import { useState, useRef, useEffect } from 'react';
import { Image, Upload, Search, Sparkles, X, Loader2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUsedPhotos, extractPhotoId, type PhotoScope } from '@/hooks/useUsedPhotos';
import { uploadDataUrlImage } from '@/lib/uploadDataUrlImage';


interface ProposalImagePickerProps {
  currentUrl?: string;
  onSelect: (url: string) => void;
  onRemove: () => void;
  searchContext: string;
  className?: string;
  aspectRatio?: 'landscape' | 'square';
  dedupScope?: PhotoScope;
  basePrompt?: string;
  programContext?: string;
}

type UnsplashResult = { url: string; caption: string; photo_id?: string };


export default function ProposalImagePicker({
  currentUrl,
  onSelect,
  onRemove,
  searchContext,
  className = '',
  aspectRatio = 'landscape',
  dedupScope,
  basePrompt,
  programContext,
}: ProposalImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>('unsplash');
  const [query, setQuery] = useState(searchContext);
  const [results, setResults] = useState<UnsplashResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [excludePhotoIds, setExcludePhotoIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const defaultPrompt = basePrompt
    || `Beautiful, photorealistic travel photograph of: ${searchContext}. Professional travel magazine quality, warm cinematic lighting, vivid colors, strong sense of place. Landscape orientation, no text, no watermark.`;
  const [aiPrompt, setAiPrompt] = useState(defaultPrompt);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => { setAiPrompt(defaultPrompt); }, [defaultPrompt]);


  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PER_PAGE = 20;

  const { getUsedPhotoIds, registerPhotos } = useUsedPhotos(
    dedupScope || { type: 'lead', id: '' }
  );

  useEffect(() => {
    if (open && dedupScope?.id) {
      getUsedPhotoIds().then(setExcludePhotoIds);
    }
  }, [open, dedupScope?.id, getUsedPhotoIds]);

  const handleUnsplashSearch = async (q?: string, append = false) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    const currentPage = append ? page + 1 : 1;
    append ? setLoadingMore(true) : setSearching(true);
    try {
      const excludeIds = dedupScope?.id ? await getUsedPhotoIds() : [];
      setExcludePhotoIds(excludeIds);
      const { data, error } = await supabase.functions.invoke('search-destination-images', {
        body: {
          query: searchQuery,
          count: PER_PAGE,
          page: currentPage,
          mode: 'search',
          excludePhotoIds: excludeIds,
        },
      });
      if (error) throw error;
      const newImages: UnsplashResult[] = data?.images || [];
      if (append) {
        setResults(prev => [...prev, ...newImages]);
      } else {
        setResults(newImages);
      }
      setPage(currentPage);
      setHasMore(newImages.length >= PER_PAGE);
    } catch (e: any) {
      toast({ title: 'Erro na pesquisa', description: e.message, variant: 'destructive' });
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  };

  const handleSelectImage = async (img: UnsplashResult) => {
    // Base64 (AI/upload) → storage, para não inflar a base de dados nem o gravar
    const url = await uploadDataUrlImage(img.url);
    onSelect(url);
    setOpen(false);
    if (dedupScope?.id) {
      const pid = img.photo_id || extractPhotoId(url);
      await registerPhotos([{ photo_id: pid, photo_url: url, used_in: searchContext }]);
    }
  };


  const handleAIGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-destination-images', {
        body: {
          query: searchContext,
          count: 1,
          mode: 'generate',
          prompt: aiPrompt,
          programContext,
        },
      });

      if (error) {
        let contextMessage = (error as any)?.context?.error || (error as any)?.context?.message;
        if (!contextMessage && typeof (error as any)?.context?.clone === 'function') {
          try {
            const payload = await (error as any).context.clone().json();
            contextMessage = payload?.error || payload?.message;
          } catch {
            contextMessage = undefined;
          }
        }
        throw new Error(contextMessage || error.message);
      }
      const img = data?.images?.[0];
      if (img) {
        await handleSelectImage(img);
        toast({ title: '🎨 Imagem AI gerada!' });
      } else {
        toast({ title: 'Erro', description: data?.error || 'Não foi possível gerar imagem', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro na geração AI', description: e.message || 'Não foi possível gerar imagem', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const url = await uploadDataUrlImage(dataUrl, 'uploads');
      onSelect(url);
      setOpen(false);
      toast({ title: '📷 Imagem carregada!' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };


  const arCls = aspectRatio === 'landscape' ? 'aspect-[16/9]' : 'aspect-square';

  return (
    <>
      <div
        className={`relative group cursor-pointer rounded-lg overflow-hidden border border-dashed border-slate-300 hover:border-[hsl(var(--info))] transition-colors ${arCls} ${className}`}
        onClick={() => setOpen(true)}
      >
        {currentUrl ? (
          <>
            <img src={currentUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <span className="text-white text-xs font-medium flex items-center gap-1">
                <Image className="h-3.5 w-3.5" /> Alterar imagem
              </span>
            </div>
            <button
              className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <Image className="h-6 w-6 mb-1 opacity-50" />
            <span className="text-[10px]">Clica para adicionar imagem</span>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Selecionar Imagem</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start h-9">
              <TabsTrigger value="upload" className="text-xs gap-1.5">
                <Monitor className="h-3 w-3" /> Upload
              </TabsTrigger>
              <TabsTrigger value="unsplash" className="text-xs gap-1.5">
                <Search className="h-3 w-3" /> Unsplash
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1.5">
                <Sparkles className="h-3 w-3" /> AI Generate
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="flex-1 flex flex-col items-center justify-center py-8">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              <div
                className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-[hsl(var(--info))] transition-colors w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Select Files to Upload</p>
                <p className="text-xs text-muted-foreground mt-1">or Drag and Drop, Copy and Paste Files</p>
              </div>
            </TabsContent>

            <TabsContent value="unsplash" className="flex-1 flex flex-col overflow-hidden gap-3">
              <div className="flex gap-2">
                <Input
                  className="text-xs flex-1 h-8"
                  placeholder="Pesquisar imagens..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUnsplashSearch()}
                />
                <Button size="sm" className="h-8 text-xs gap-1" onClick={() => handleUnsplashSearch()} disabled={searching}>
                  {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  Pesquisar
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {results.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {results.map((img, i) => {
                        const pid = img.photo_id || extractPhotoId(img.url);
                        const isAlreadyUsed = excludePhotoIds.includes(pid);
                        return (
                          <button
                            key={i}
                            className="relative rounded-md overflow-hidden border-2 border-transparent hover:border-[hsl(var(--info))] transition-colors aspect-[16/10]"
                            onClick={() => handleSelectImage(img)}
                          >
                            <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                            {isAlreadyUsed && (
                              <div className="absolute top-1 left-1 bg-amber-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                JÁ USADA
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {hasMore && (
                      <div className="flex justify-center pb-2">
                        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleUnsplashSearch(undefined, true)} disabled={loadingMore}>
                          {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                          Carregar mais imagens
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Search className="h-6 w-6 mb-2 opacity-40" />
                    <p className="text-xs">Pesquisa por destinos, experiências...</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="flex-1 flex flex-col overflow-y-auto gap-3 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[hsl(var(--info))]" />
                <p className="text-sm font-medium">Gerar com AI (ChatGPT)</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Prompt (editável)</p>
                  <button className="text-[10px] text-[hsl(var(--info))] hover:underline" onClick={() => setAiPrompt(defaultPrompt)}>
                    Restaurar prompt base
                  </button>
                </div>
                <Textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  rows={7}
                  className="text-xs leading-relaxed"
                  placeholder="Descreve a imagem pretendida..."
                />
                <p className="text-[10px] text-muted-foreground">
                  Escreve aqui instruções extra antes de gerar — a AI considera este texto e o day-by-day do programa.
                </p>
              </div>

              {programContext && (
                <div className="rounded-md border bg-muted/30 p-2">
                  <button
                    className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground"
                    onClick={() => setShowContext(v => !v)}
                  >
                    {showContext ? '▾' : '▸'} Contexto do programa enviado à AI
                  </button>
                  {showContext && (
                    <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                      {programContext}
                    </pre>
                  )}
                </div>
              )}

              <Button
                onClick={handleAIGenerate}
                disabled={generating || !aiPrompt.trim()}
                className="gap-2 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white self-center"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'A gerar imagem...' : 'Gerar Imagem AI'}
              </Button>
            </TabsContent>

          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
