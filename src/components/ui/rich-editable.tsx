/**
 * WYSIWYG rich-text inputs with inline bold.
 *
 * These components look and feel like a normal `<Input>` / `<Textarea>` but
 * render bold segments visually while the user types. Bold is stored in the
 * value as markdown-style `**...**` markers, so the same string works with
 * `<RichText />`, PDF export helpers, and every existing DB column.
 *
 *   <RichInput value={val} onChange={setVal} />
 *   <RichTextarea value={val} onChange={setVal} />
 *
 * Ctrl/Cmd+B toggles bold on the current selection (via execCommand).
 */
import { forwardRef, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { escapeHtml } from '@/lib/richText';

// ─── Conversion ─────────────────────────────────────────────────────────────
function mdToHtml(md: string, singleLine = false): string {
  const escaped = escapeHtml(md ?? '');
  const withBold = escaped.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
  return singleLine ? withBold : withBold.replace(/\n/g, '<br />');
}

function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BR') return '\n';
  const isBold =
    tag === 'STRONG' ||
    tag === 'B' ||
    (el.style?.fontWeight ? (el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight, 10) >= 600) : false);
  let inner = '';
  el.childNodes.forEach(c => (inner += serialize(c)));
  if (!inner) return '';
  if (tag === 'DIV' || tag === 'P') {
    // Block elements introduced by the browser (e.g. Enter key in contenteditable)
    return '\n' + inner;
  }
  return isBold ? `**${inner}**` : inner;
}

function htmlToMd(root: HTMLElement, singleLine = false): string {
  let out = '';
  root.childNodes.forEach(c => (out += serialize(c)));
  // Collapse leading newline that block-serialization can add.
  out = out.replace(/^\n+/, '');
  if (singleLine) out = out.replace(/\n+/g, ' ');
  return out;
}

// ─── Common props ───────────────────────────────────────────────────────────
interface BaseProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

function useRichEditable(
  value: string,
  onChange: (v: string) => void,
  singleLine: boolean,
) {
  const ref = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const lastValueRef = useRef<string | null>(null);

  // Sync external value → DOM (only when it doesn't match what user just typed)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ((value ?? '') === lastValueRef.current) return;
    lastValueRef.current = value ?? '';
    el.innerHTML = mdToHtml(value ?? '', singleLine);
  }, [value, singleLine]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const md = htmlToMd(el, singleLine);
    lastValueRef.current = md;
    onChange(md);
  }, [onChange, singleLine]);

  const onInput = useCallback(() => {
    if (composingRef.current) return;
    emit();
  }, [emit]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl/Cmd+B → toggle bold on selection
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      document.execCommand('bold');
      // execCommand does not always fire input; force a sync
      setTimeout(emit, 0);
      return;
    }
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
    }
  }, [emit, singleLine]);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const clean = singleLine ? text.replace(/\r?\n+/g, ' ') : text;
    document.execCommand('insertText', false, clean);
  }, [singleLine]);

  return { ref, onInput, onKeyDown, onPaste, composingRef };
}

// ─── Styles matching shadcn Input / Textarea ───────────────────────────────
const inputBase =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm overflow-hidden whitespace-nowrap';

const textareaBase =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm whitespace-pre-wrap break-words';

// ─── Components ─────────────────────────────────────────────────────────────
export const RichInput = forwardRef<HTMLDivElement, BaseProps>(function RichInput(
  { value, onChange, placeholder, className, disabled, onBlur, onFocus },
  _forwardedRef,
) {
  const { ref, onInput, onKeyDown, onPaste, composingRef } = useRichEditable(value, onChange, true);
  return (
    <div
      ref={ref}
      role="textbox"
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={onBlur}
      onFocus={onFocus}
      onCompositionStart={() => (composingRef.current = true)}
      onCompositionEnd={() => { composingRef.current = false; onInput(); }}
      className={cn(inputBase, 'rich-editable', className)}
    />
  );
});

export const RichTextarea = forwardRef<HTMLDivElement, BaseProps>(function RichTextarea(
  { value, onChange, placeholder, className, disabled, onBlur, onFocus },
  _forwardedRef,
) {
  const { ref, onInput, onKeyDown, onPaste, composingRef } = useRichEditable(value, onChange, false);
  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={onBlur}
      onFocus={onFocus}
      onCompositionStart={() => (composingRef.current = true)}
      onCompositionEnd={() => { composingRef.current = false; onInput(); }}
      className={cn(textareaBase, 'rich-editable', className)}
    />
  );
});
