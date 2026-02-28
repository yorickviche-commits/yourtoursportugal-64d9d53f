import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagSelectProps {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
}

const TagSelect = ({ label, value, options, onChange, multiple = false, placeholder = 'Selecionar...' }: TagSelectProps) => {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt: string) => {
    if (multiple) {
      onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
    } else {
      onChange([opt]);
      setOpen(false);
    }
  };

  const addNew = () => {
    const trimmed = newTag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setNewTag('');
    setShowAdd(false);
  };

  const remove = (opt: string) => {
    onChange(value.filter(v => v !== opt));
  };

  return (
    <div ref={ref} className="relative">
      <label className="text-[10px] text-muted-foreground uppercase">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between w-full h-8 mt-1 px-2 border rounded-md bg-background text-xs",
          "hover:border-foreground/30 transition-colors",
          open && "border-[hsl(var(--info))]"
        )}
      >
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          {value.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
          {value.map(v => (
            <span key={v} className="inline-flex items-center gap-0.5 bg-[hsl(var(--info-muted))] text-[hsl(var(--info))] px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0">
              {v}
              <X className="h-2.5 w-2.5 cursor-pointer hover:text-foreground" onClick={(e) => { e.stopPropagation(); remove(v); }} />
            </span>
          ))}
        </div>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors",
                value.includes(opt) && "bg-[hsl(var(--info-muted))] text-[hsl(var(--info))] font-medium"
              )}>
              {opt}
            </button>
          ))}
          {!showAdd ? (
            <button type="button" onClick={() => setShowAdd(true)}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 flex items-center gap-1 border-t">
              <Plus className="h-3 w-3" /> Adicionar novo
            </button>
          ) : (
            <div className="flex items-center gap-1 p-1.5 border-t">
              <input
                autoFocus
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNew()}
                placeholder="Novo..."
                className="flex-1 h-6 px-2 text-xs border rounded bg-background"
              />
              <button type="button" onClick={addNew} className="text-[10px] text-[hsl(var(--info))] font-medium px-1.5">OK</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelect;
