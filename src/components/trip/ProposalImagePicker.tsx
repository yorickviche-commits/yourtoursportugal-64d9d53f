import { useState, useRef } from 'react';
import { Image, Upload, Search, Sparkles, X, Loader2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProposalImagePickerProps {
  currentUrl?: string;
  onSelect: (url: string) => void;
  onRemove: () => void;
  searchContext: string; // e.g. "Porto historical center" for smart Unsplash queries
  className?: string;
  aspectRatio?: 'landscape' | 'square';
}

export default function ProposalImagePicker({
  currentUrl,
  onSelect,
  onRemove,
  searchContext,
  className = '',
  aspectRatio = 'landscape',
}: ProposalImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>('unsplash');
  const [query, setQuery] = useState(searchContext);
  const [results, setResults] = useState<{ url: string; caption: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PER_PAGE = 20;

  const handleUnsplashSearch = async (q?: string, append = false) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    const currentPage = append ? page + 1 : 1;
    append ? setLoadingMore(true) : setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-destination-images', {
        body: { query: searchQuery, count: PER_PAGE, page: currentPage, mode: 'search' },
      });
      if (error) throw error;
      const newImages = data?.images || [];
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

  const handleAIGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-destination-images', {
        body: { query: `Beautiful travel photograph: ${searchContext}`, count: 1, mode: 'generate' },
      });
      if (error) throw error;
      const img = data?.images?.[0];
      if (img) {
        onSelect(img.url);
        setOpen(false);
        toast({ title: '🎨 Imagem AI gerada!' });
      } else {
        toast({ title: 'Erro', description: 'Não foi possível gerar imagem', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro na geração AI', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Convert to base64 data URL for simplicity
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onSelect(dataUrl);
      setOpen(false);
      toast({ title: '📷 Imagem carregada!' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const arCls = aspectRatio === 'landscape' ? 'aspect-[16/9]' : 'aspect-square';

  return (
    <>
      {/* Image Display / Placeholder */}
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

      {/* Picker Dialog */}
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

            {/* Upload */}
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

            {/* Unsplash */}
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
                      {results.map((img, i) => (
                        <button
                          key={i}
                          className="rounded-md overflow-hidden border-2 border-transparent hover:border-[hsl(var(--info))] transition-colors aspect-[16/10]"
                          onClick={() => { onSelect(img.url); setOpen(false); }}
                        >
                          <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                        </button>
                      ))}
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

            {/* AI Generate */}
            <TabsContent value="ai" className="flex-1 flex flex-col items-center justify-center py-8 gap-4">
              <Sparkles className="h-10 w-10 text-[hsl(var(--info))] opacity-60" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Gerar com AI</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Cria uma imagem única baseada no contexto: <span className="italic">"{searchContext}"</span>
                </p>
              </div>
              <Button
                onClick={handleAIGenerate}
                disabled={generating}
                className="gap-2 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white"
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
