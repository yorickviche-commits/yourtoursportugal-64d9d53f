/**
 * Rich-text (inline bold) support.
 *
 * Storage format: plain text with markdown-style bold markers `**like this**`.
 * Every text input/textarea in the app supports Ctrl/Cmd+B while the user has
 * a selection — the selected range is wrapped with `**` and the React state is
 * updated via the native setter so controlled inputs stay in sync.
 *
 * Rendering:
 *   <RichText value={...} />           → HTML with <strong>
 *   mdBoldToHtml(text)                 → escaped HTML string
 *   drawRichTextPdf(doc, ...)          → jsPDF renderer honoring bold segments
 */
import { useEffect } from 'react';

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ITALIC_OPEN = '\u0001';
const ITALIC_CLOSE = '\u0002';

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * Normalise any stored rich text (HTML from editors — b/strong/i/em/br — or
 * legacy markdown `**bold**`) into the canonical markdown-bold form.
 * All other HTML tags are stripped (sanitised). Italic becomes private markers.
 */
export function normalizeRichText(text: string | null | undefined): string {
  let s = String(text ?? '');
  if (!/[<&]/.test(s)) return s;
  if (/<\/?[a-z][^>]*>/i.test(s)) {
    s = s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<\s*(b|strong)(\s[^>]*)?>/gi, '**')
      .replace(/<\s*\/\s*(b|strong)\s*>/gi, '**')
      .replace(/<\s*(i|em)(\s[^>]*)?>/gi, ITALIC_OPEN)
      .replace(/<\s*\/\s*(i|em)\s*>/gi, ITALIC_CLOSE)
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*\*\*/g, ''); // adjacent bold runs: </b><b>
  }
  return decodeEntities(s);
}

/** Convert rich text (HTML or `**bold**`) into safe HTML with <strong>/<em>. */
export function mdBoldToHtml(text: string | null | undefined, opts?: { preserveNewlines?: boolean }): string {
  const escaped = escapeHtml(normalizeRichText(text));
  const withBold = escaped
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*\*/g, '') // never show a dangling marker
    .replace(new RegExp(`${ITALIC_OPEN}([\\s\\S]*?)${ITALIC_CLOSE}`, 'g'), '<em>$1</em>')
    .replace(new RegExp(`[${ITALIC_OPEN}${ITALIC_CLOSE}]`, 'g'), '');
  return opts?.preserveNewlines ? withBold.replace(/\n/g, '<br />') : withBold;
}

/** Strip bold/italic markers and HTML to plain text (for alt text, exports, etc). */
export function stripBoldMarkers(text: string | null | undefined): string {
  return normalizeRichText(text)
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(new RegExp(`[${ITALIC_OPEN}${ITALIC_CLOSE}]`, 'g'), '');
}

interface RichTextProps {
  value: string | null | undefined;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  preserveNewlines?: boolean;
}

export function RichText({ value, as: Tag = 'span', className, preserveNewlines }: RichTextProps) {
  const html = mdBoldToHtml(value, { preserveNewlines });
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Programmatic value setter that fires a real input event so React sees it. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Global Ctrl/Cmd+B → wrap selection with `**...**` inside any text field. */
export function useBoldShortcut() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b') return;
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      // Only handle plain text controls; skip password/number/etc.
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && ['text', 'search', 'url', 'email', ''].includes((el as HTMLInputElement).type))) {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        if (start === end) return; // nothing selected → let browser ignore
        e.preventDefault();
        const val = input.value;
        const selected = val.slice(start, end);
        // Toggle: if already wrapped, unwrap.
        const before = val.slice(0, start);
        const after = val.slice(end);
        let next: string;
        let selStart: number;
        let selEnd: number;
        const alreadyBold = /^\*\*[\s\S]+\*\*$/.test(selected);
        if (alreadyBold) {
          const inner = selected.slice(2, -2);
          next = before + inner + after;
          selStart = start;
          selEnd = start + inner.length;
        } else {
          next = before + '**' + selected + '**' + after;
          selStart = start + 2;
          selEnd = end + 2;
        }
        setNativeValue(input, next);
        // Restore selection after React re-renders.
        requestAnimationFrame(() => {
          try { input.setSelectionRange(selStart, selEnd); } catch { /* noop */ }
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

export function BoldShortcutProvider() {
  useBoldShortcut();
  return null;
}

// ─── jsPDF helper ───────────────────────────────────────────────────────────
// Splits a string on `**bold**` markers and lays it out with jsPDF, toggling
// the font weight per segment. Handles wrapping across `maxWidth`.
type JsPdfLike = {
  setFont: (family: string, style: string) => void;
  getTextWidth: (s: string) => number;
  text: (s: string, x: number, y: number) => void;
  splitTextToSize?: (s: string, w: number) => string[];
};

interface DrawRichOpts {
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  fontFamily?: string;
  baseStyle?: 'normal' | 'italic';
  boldStyle?: 'bold' | 'bolditalic';
}

interface Segment { text: string; bold: boolean }

function parseSegments(raw: string): Segment[] {
  const text = normalizeRichText(raw).replace(new RegExp(`[${ITALIC_OPEN}${ITALIC_CLOSE}]`, 'g'), '');
  const out: Segment[] = [];
  const re = /\*\*(.+?)\*\*/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last).replace(/\*\*/g, ''), bold: false });
  return out;
}

/** Draws rich text, returns the Y position after the block. */
export function drawRichTextPdf(doc: JsPdfLike, text: string, opts: DrawRichOpts): number {
  const family = opts.fontFamily || 'helvetica';
  const baseStyle = opts.baseStyle || 'normal';
  const boldStyle = opts.boldStyle || (baseStyle === 'italic' ? 'bolditalic' : 'bold');
  const segments = parseSegments(String(text ?? ''));

  let cursorX = opts.x;
  let cursorY = opts.y;
  const startX = opts.x;
  const rightEdge = opts.x + opts.maxWidth;

  const drawWord = (word: string, bold: boolean, isFirstOnLine: boolean) => {
    doc.setFont(family, bold ? boldStyle : baseStyle);
    const w = doc.getTextWidth(word);
    if (!isFirstOnLine && cursorX + w > rightEdge) {
      cursorY += opts.lineHeight;
      cursorX = startX;
    }
    doc.text(word, cursorX, cursorY);
    cursorX += w;
  };

  segments.forEach(seg => {
    // Split by whitespace but keep spaces so wrapping works naturally.
    const parts = seg.text.split(/(\s+)/);
    parts.forEach(p => {
      if (!p) return;
      if (p.includes('\n')) {
        const chunks = p.split('\n');
        chunks.forEach((chunk, i) => {
          if (i > 0) {
            cursorY += opts.lineHeight;
            cursorX = startX;
          }
          if (chunk) drawWord(chunk, seg.bold, cursorX === startX);
        });
        return;
      }
      drawWord(p, seg.bold, cursorX === startX);
    });
  });

  // Reset to base style for the caller.
  doc.setFont(family, baseStyle);
  return cursorY + opts.lineHeight;
}
