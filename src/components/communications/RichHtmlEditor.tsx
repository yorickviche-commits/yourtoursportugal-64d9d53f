/**
 * Rich HTML block editor used by the email composer.
 *
 * Stores raw HTML (inline styles) so it can be dropped straight into the
 * email body. Visible toolbar: bold, italic, underline, bullet/numbered list,
 * font size, font colour. Base font is always Trebuchet MS.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Type, Palette, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EMAIL_FONT } from '@/lib/emailHtml';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SIZES = [
  { label: 'Pequeno', px: '12px' },
  { label: 'Normal', px: '14px' },
  { label: 'Médio', px: '16px' },
  { label: 'Grande', px: '19px' },
];

const COLORS = [
  { label: 'Preto', hex: '#1f2937' },
  { label: 'YT Blue', hex: '#0a2540' },
  { label: 'Azul link', hex: '#1155cc' },
  { label: 'Cinza', hex: '#64748b' },
  { label: 'Vermelho', hex: '#b91c1c' },
  { label: 'Verde', hex: '#15803d' },
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  toolbar?: boolean;
}

export function RichHtmlEditor({ value, onChange, placeholder, minHeight = 90, className, toolbar = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ((value ?? '') === last.current) return;
    last.current = value ?? '';
    el.innerHTML = value ?? '';
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    last.current = el.innerHTML;
    onChange(el.innerHTML);
  }, [onChange]);

  const run = useCallback((cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    setTimeout(emit, 0);
  }, [emit]);

  const applyStyle = useCallback((style: string, val: string) => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const span = document.createElement('span');
    span.setAttribute('style', `${style}:${val}`);
    try {
      span.appendChild(sel.getRangeAt(0).extractContents());
      sel.getRangeAt(0).insertNode(span);
      sel.removeAllRanges();
    } catch { /* ignore */ }
    setTimeout(emit, 0);
  }, [emit]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'i' || k === 'u') {
      e.preventDefault();
      run(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline');
    }
  };

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Negrito (Ctrl+B)" onMouseDown={e => e.preventDefault()} onClick={() => run('bold')}><Bold className="h-3.5 w-3.5" /></Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Itálico (Ctrl+I)" onMouseDown={e => e.preventDefault()} onClick={() => run('italic')}><Italic className="h-3.5 w-3.5" /></Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Sublinhado (Ctrl+U)" onMouseDown={e => e.preventDefault()} onClick={() => run('underline')}><Underline className="h-3.5 w-3.5" /></Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Lista" onMouseDown={e => e.preventDefault()} onClick={() => run('insertUnorderedList')}><List className="h-3.5 w-3.5" /></Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Lista numerada" onMouseDown={e => e.preventDefault()} onClick={() => run('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs" title="Tamanho"><Type className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SIZES.map(s => (
                <DropdownMenuItem key={s.px} onSelect={() => applyStyle('font-size', s.px)}>
                  <span style={{ fontSize: s.px }}>{s.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs" title="Cor"><Palette className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {COLORS.map(c => (
                <DropdownMenuItem key={c.hex} onSelect={() => run('foreColor', c.hex)}>
                  <span className="mr-2 inline-block h-3 w-3 rounded-sm border" style={{ background: c.hex }} />
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Anular" onMouseDown={e => e.preventDefault()} onClick={() => run('undo')}><Undo2 className="h-3.5 w-3.5" /></Button>
        </div>
      )}
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onKeyDown={onKeyDown}
        onBlur={emit}
        style={{ minHeight, fontFamily: EMAIL_FONT }}
        className="rich-editable px-3 py-2 text-sm leading-relaxed outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}
