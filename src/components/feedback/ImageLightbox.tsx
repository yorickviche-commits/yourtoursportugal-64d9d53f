import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  urls: { url: string; name: string }[];
  index: number | null;
  onClose: () => void;
}

const ImageLightbox = ({ urls, index, onClose }: Props) => {
  const [current, setCurrent] = useState(index ?? 0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => { setCurrent(index ?? 0); setZoom(1); }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, urls.length - 1));
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(c - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, urls.length, onClose]);

  if (index === null || !urls.length) return null;
  const item = urls[current];
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white" onClick={e => e.stopPropagation()}>
        <span className="truncate text-xs">{item.name} · {current + 1}/{urls.length}</span>
        <div className="flex items-center gap-2">
          <button aria-label="Reduzir" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-white/10 rounded"><ZoomOut className="h-4 w-4" /></button>
          <button aria-label="Ampliar" onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1.5 hover:bg-white/10 rounded"><ZoomIn className="h-4 w-4" /></button>
          <a href={item.url} target="_blank" rel="noreferrer" aria-label="Abrir original" className="p-1.5 hover:bg-white/10 rounded"><ExternalLink className="h-4 w-4" /></a>
          <button aria-label="Fechar" onClick={onClose} className="p-1.5 hover:bg-white/10 rounded"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-auto p-4" onClick={e => e.stopPropagation()}>
        {current > 0 && (
          <button aria-label="Anterior" onClick={() => setCurrent(c => c - 1)} className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5" /></button>
        )}
        <img src={item.url} alt={item.name} style={{ transform: `scale(${zoom})` }} className="max-h-full max-w-full object-contain transition-transform" />
        {current < urls.length - 1 && (
          <button aria-label="Seguinte" onClick={() => setCurrent(c => c + 1)} className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5" /></button>
        )}
      </div>
    </div>
  );
};

export default ImageLightbox;
