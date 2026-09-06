import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES, MAX_IMAGE_BYTES } from '@/lib/feedbackConstants';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  /** Ativa a captura de Ctrl+V no documento enquanto o dialog está aberto. */
  pasteEnabled?: boolean;
}

const ImageDropzone = ({ files, onChange, pasteEnabled = true }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const previews = useMemo(() => files.map(f => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews]);

  const addFiles = useCallback((incoming: File[]) => {
    const accepted: File[] = [];
    for (const f of incoming) {
      if (!ACCEPTED_IMAGE_TYPES.includes(f.type)) { toast.error(`${f.name || 'Ficheiro'}: só são aceites imagens PNG, JPG, WEBP ou GIF.`); continue; }
      if (f.size > MAX_IMAGE_BYTES) { toast.error(`${f.name || 'Imagem'}: excede 8 MB.`); continue; }
      accepted.push(f);
    }
    if (!accepted.length) return;
    const next = [...files, ...accepted].slice(0, MAX_IMAGES);
    if (files.length + accepted.length > MAX_IMAGES) toast.error(`Máximo de ${MAX_IMAGES} imagens.`);
    onChange(next);
  }, [files, onChange]);

  useEffect(() => {
    if (!pasteEnabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgs = items.filter(i => i.kind === 'file' && i.type.startsWith('image/'))
        .map(i => i.getAsFile()).filter((f): f is File => !!f);
      if (imgs.length) {
        e.preventDefault();
        addFiles(imgs);
        toast.success(imgs.length === 1 ? 'Imagem colada.' : `${imgs.length} imagens coladas.`);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [pasteEnabled, addFiles]);

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center transition-colors',
          dragging ? 'border-[#0a2540] bg-muted' : 'border-border hover:bg-muted/50'
        )}
      >
        <ImagePlus className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs font-medium">Arrasta, clica ou cola (Ctrl+V) imagens</p>
        <p className="text-[11px] text-muted-foreground">Máx. {MAX_IMAGES} imagens · 8 MB cada</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
      />
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative h-16 w-16 overflow-hidden rounded border border-border">
              <img src={p.url} alt={p.file.name} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remover ${p.file.name}`}
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageDropzone;
