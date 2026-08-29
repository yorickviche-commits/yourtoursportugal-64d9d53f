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

const DOC_WIDTH = 1024; // px — matches the desktop layout the print output uses
const A4 = { w: 210, h: 297 }; // mm

function wait(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

async function waitForImages(doc: Document) {
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
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

    console.log('[pdf] root ready', root.scrollHeight);
    await replaceMaps(doc);
    console.log('[pdf] maps done');
    await waitForImages(doc);
    await (doc as any).fonts?.ready?.catch?.(() => undefined);
    await wait(600);

    // Grow the iframe so nothing is virtualized/clipped during capture.
    iframe.style.height = `${root.scrollHeight + 200}px`;
    await wait(300);

    console.log('[pdf] capturing', root.scrollHeight);
    const canvas = await html2canvas(root, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 8000,
      logging: false,
      windowWidth: DOC_WIDTH,
      width: DOC_WIDTH,
      height: root.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    console.log('[pdf] captured', canvas.width, canvas.height);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pxPerMm = canvas.width / A4.w;
    const pageHeightPx = Math.floor(A4.h * pxPerMm);
    let offset = 0;
    let first = true;

    while (offset < canvas.height) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(
        slice.toDataURL('image/jpeg', 0.92),
        'JPEG',
        0,
        0,
        A4.w,
        sliceHeight / pxPerMm,
      );
      offset += sliceHeight;
    }

    const safeName = `${filename.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Travel Plan'}.pdf`;
    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
    const blobUrl = URL.createObjectURL(pdf.output('blob'));
    return { base64, filename: safeName, blobUrl };
  } finally {
    iframe.remove();
  }
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
