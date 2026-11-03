/**
 * Single source of truth for the client-facing PDF.
 *
 * The document is the very same page the "Imprimir" button prints: the public
 * proposal rendered by the browser (`/proposal/:token?print=1`). It is rendered
 * off-screen in an iframe, rasterized at high resolution and paginated into A4,
 * so the file attached to emails is identical to the printed one.
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { buildRouteMapImage } from '@/lib/staticRouteMap';
import { optimizePdf } from '@/lib/pdfOptimization';

const DOC_WIDTH = 1024; // px — matches the desktop layout the print output uses
const A4 = { w: 210, h: 297 }; // mm

function wait(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

/**
 * Lazy images never fire `load` while off-screen, so force eager loading and
 * never block longer than `timeoutMs` on any single image.
 */
async function waitForImages(doc: Document, timeoutMs = 12000) {
  const images = Array.from(doc.images);
  images.forEach(img => {
    img.loading = 'eager';
    img.removeAttribute('loading');
  });
  await Promise.all(
    images.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            window.setTimeout(done, timeoutMs);
          }),
    ),
  );
}

/** Google Maps iframes never rasterize — swap them for the static route image. */
async function replaceMaps(doc: Document) {
  const nodes = Array.from(doc.querySelectorAll<HTMLElement>('[data-map-embed]'));
  for (const node of nodes) {
    const url = node.getAttribute('data-map-embed') || '';
    const frame = node.querySelector('iframe');
    if (!frame || !url) continue;
    let img: Awaited<ReturnType<typeof buildRouteMapImage>> = null;
    try {
      img = await buildRouteMapImage(url);
    } catch {
      img = null;
    }
    const box = frame.parentElement;
    if (!box) continue;
    if (!img) {
      box.remove();
      continue;
    }
    const el = doc.createElement('img');
    el.src = img.dataUrl;
    el.alt = 'Route map';
    el.style.cssText = 'display:block;width:100%;height:auto';
    box.replaceChildren(el);
    (box as HTMLElement).style.aspectRatio = 'auto';
  }
}

export interface PrintedPdfResult {
  base64: string;
  filename: string;
  blobUrl: string;
}

/**
 * Builds the PDF from the printable proposal page.
 * Throws when the page cannot be rendered, so callers can decide on a fallback.
 */
export async function buildPrintedProposalPdf(
  token: string,
  filename: string,
): Promise<PrintedPdfResult> {
  if (!token) throw new Error('Proposta sem link público (token) — não é possível gerar o PDF.');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    `position:fixed;top:0;left:-20000px;width:${DOC_WIDTH}px;height:1400px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.addEventListener('load', () => resolve(), { once: true });
      iframe.addEventListener('error', () => reject(new Error('Falha ao abrir a proposta')), { once: true });
      iframe.src = `/proposal/${encodeURIComponent(token)}?print=1`;
    });

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) throw new Error('Não foi possível ler a proposta para impressão.');

    // Wait for React to fetch + render the proposal document.
    const deadline = Date.now() + 25000;
    let root = doc.querySelector<HTMLElement>('[data-proposal-doc]');
    while (!root && Date.now() < deadline) {
      await wait(250);
      root = doc.querySelector<HTMLElement>('[data-proposal-doc]');
    }
    if (!root) throw new Error('A proposta não carregou em tempo útil.');

    await replaceMaps(doc);
    await waitForImages(doc);
    await (doc as any).fonts?.ready?.catch?.(() => undefined);
    await wait(600);

    // Grow the iframe so nothing is virtualized/clipped during capture.
    iframe.style.height = `${root.scrollHeight + 200}px`;
    await wait(300);

    return await buildPrintedRootPdf(root, filename);
  } finally {
    iframe.remove();
  }
}

/** Capture current Planner content, including unsaved edits, without publishing it. */
export async function buildPrintedRootPdf(root: HTMLElement, filename: string): Promise<PrintedPdfResult> {
    await replaceMaps(root.ownerDocument);
    await waitForImages(root.ownerDocument);
    await root.ownerDocument.fonts.ready;
    const width = DOC_WIDTH;
    const pageHeight = Math.floor(width * A4.h / A4.w);
    const height = root.scrollHeight;
    // Capture bounded A4 slices: a 15-day tour must not exceed browser canvas limits.
    const pages: HTMLCanvasElement[] = [];
    for (let y = 0; y < height; y += pageHeight) {
      pages.push(await html2canvas(root, {
        backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: false,
        imageTimeout: 8000, logging: false, windowWidth: width,
        width, height: Math.min(pageHeight, height - y), y,
        scrollX: 0, scrollY: 0,
      }));
    }
    const best = await optimizePdf(async (scale, quality) => {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      pages.forEach((canvas, index) => {
        const slice = document.createElement('canvas');
        slice.width = Math.round(canvas.width * scale);
        slice.height = Math.max(1, Math.round(canvas.height * scale));
        const ctx = slice.getContext('2d');
        if (!ctx) throw new Error('Canvas indisponível.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, slice.width, slice.height);
        if (index) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, A4.w, canvas.height / canvas.width * A4.w, undefined, 'FAST');
        slice.width = slice.height = 0;
      });
      // Preserve clickable links, including daily Google Maps routes.
      const box = root.getBoundingClientRect();
      root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
        for (const rect of Array.from(anchor.getClientRects())) {
          const top = rect.top - box.top;
          if (rect.width <= 0 || rect.height <= 0 || top < 0) continue;
          const page = Math.floor(top / pageHeight) + 1;
          if (page > pdf.getNumberOfPages()) continue;
          pdf.setPage(page);
          pdf.link((rect.left - box.left) / width * A4.w, (top % pageHeight) / width * A4.w,
            rect.width / width * A4.w, rect.height / width * A4.w, { url: anchor.href });
        }
      });
      const blob = pdf.output('blob');
      return { value: { pdf, blob }, size: blob.size };
    });
    pages.forEach(canvas => { canvas.width = canvas.height = 0; });
    const { pdf, blob } = best.value;
    const safeName = `${filename.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Travel Plan'}.pdf`;
    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
    const blobUrl = URL.createObjectURL(blob);
    return { base64, filename: safeName, blobUrl };
}

/** "YT#### - Client - Programme - Dates" (same convention as the print output). */
export function proposalPdfFilename(
  p: { booking_ref?: string | null; client_name?: string; title?: string; date_range?: string | null },
  idOverride?: string | null,
): string {
  return [idOverride || p.booking_ref || 'YT', p.client_name, p.title, p.date_range]
    .map(v => (v ? String(v).replace(/\s+/g, ' ').trim() : ''))
    .filter(Boolean)
    .join(' - ')
    .slice(0, 180);
}
