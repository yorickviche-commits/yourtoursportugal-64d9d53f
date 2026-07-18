import jsPDF from 'jspdf';
import reviewsCoverUrl from '@/assets/proposal-reviews-cover.png';

const ALL_REVIEWS_URL = 'https://yourtoursportugal.com/our-reviews/';

interface ProposalDayImage { url?: string; caption?: string }
interface ProposalDay {
  day_number?: number;
  title?: string;
  subtitle?: string;
  date?: string;
  date_label?: string;
  narrative?: string;
  // legacy
  highlights?: string[];
  // current shape
  items?: string[];
  accommodation?: string | { label?: string; hotel_name?: string; note?: string } | null;
  cover_image_url?: string;
  images?: ProposalDayImage[];
}

export interface ProposalLite {
  id?: string;
  title?: string;
  client_name?: string;
  date_range?: string | null;
  participants?: string | null;
  summary_text?: string | null;
  total_value_eur?: number | null;
  public_token?: string;
  booking_ref?: string | null;
  hero_image_url?: string | null;
  wetravel_checkout_url?: string | null;
  days?: ProposalDay[] | unknown;
}

async function fetchImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const format: 'JPEG' | 'PNG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch (e) {
    console.warn('fetchImageAsDataUrl failed', url, e);
    return null;
  }
}

const dayItems = (d: ProposalDay): string[] => {
  if (Array.isArray(d.items) && d.items.length) return d.items.map(String);
  if (Array.isArray(d.highlights) && d.highlights.length) return d.highlights.map(String);
  return [];
};

const dayDateLabel = (d: ProposalDay) => d.date_label || d.date || '';

const accommodationLabel = (d: ProposalDay): string | null => {
  const a = d.accommodation;
  if (!a) return null;
  if (typeof a === 'string') return a;
  return a.hotel_name || a.label || null;
};

export function buildProposalEmailText(p: ProposalLite, weblink: string): string {
  const days = Array.isArray(p.days) ? (p.days as ProposalDay[]) : [];
  const headerBits = [
    p.client_name && `${p.client_name}`,
    (p.booking_ref || '') && `ID: ${p.booking_ref}`,
    p.date_range || '',
    p.participants || '',
  ].filter(Boolean);

  const lines: string[] = [];
  lines.push(p.title || 'Your Travel Plan');
  if (headerBits.length) lines.push(headerBits.join(' · '));
  lines.push('');
  if (p.summary_text) {
    lines.push(p.summary_text.trim());
    lines.push('');
  }

  if (days.length) {
    lines.push('Summary & Day-by-Day');
    days.forEach((d, i) => {
      lines.push(`Day ${d.day_number ?? i + 1} — ${d.title || ''}`.trim());
    });
    lines.push('');
    days.forEach((d, i) => {
      lines.push(`Day ${d.day_number ?? i + 1} — ${d.title || ''}`.trim());
      const dl = dayDateLabel(d);
      if (dl) lines.push(dl);
      if (d.subtitle) lines.push(d.subtitle);
      const items = dayItems(d);
      if (items.length) {
        lines.push('ITINERARY & INCLUDED:');
        items.forEach(it => lines.push(`  • ${it}`));
      }
      const acc = accommodationLabel(d);
      if (acc) lines.push(`Night: ${acc}`);
      lines.push('');
    });
  }

  if (weblink) {
    lines.push('— Interactive Travel Plan (mobile-friendly):');
    lines.push(weblink);
    lines.push('');
    lines.push('The full PDF version is attached for your records.');
  }
  return lines.join('\n');
}

export async function buildProposalPdfBase64(p: ProposalLite, weblink: string): Promise<{ base64: string; filename: string }> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const days = Array.isArray(p.days) ? (p.days as ProposalDay[]) : [];

  // Pre-fetch all images in parallel
  const heroUrl = p.hero_image_url || days[0]?.cover_image_url || days[0]?.images?.[0]?.url || '';
  const dayImageUrls: string[][] = days.map(d => {
    const urls = (d.images || []).map(i => i?.url).filter(Boolean) as string[];
    if (d.cover_image_url && !urls.includes(d.cover_image_url)) urls.unshift(d.cover_image_url);
    return urls.slice(0, 2);
  });
  const allUrls = [heroUrl, ...dayImageUrls.flat()].filter(Boolean);
  const fetched = await Promise.all(allUrls.map(u => fetchImageAsDataUrl(u)));
  const imgCache = new Map<string, { dataUrl: string; format: 'JPEG' | 'PNG' } | null>();
  allUrls.forEach((u, i) => imgCache.set(u, fetched[i]));

  const drawImage = (url: string, x: number, yy: number, w: number, h: number) => {
    const img = imgCache.get(url);
    if (!img) return false;
    try {
      doc.addImage(img.dataUrl, img.format, x, yy, w, h, undefined, 'FAST');
      return true;
    } catch (e) {
      console.warn('addImage failed', e);
      return false;
    }
  };

  // Header band
  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, pageW, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Your Tours Portugal', margin, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Tailored Travel Plan', margin, 60);
  doc.text('reservas@yourtours.pt', pageW - margin, 60, { align: 'right' });
  y = 110;

  // Hero cover image (21:9 like the planner)
  if (heroUrl && imgCache.get(heroUrl)) {
    const w = pageW - margin * 2;
    const h = Math.round((w * 9) / 21);
    ensureSpace(h + 12);
    drawImage(heroUrl, margin, y, w, h);
    y += h + 14;
  }

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  const title = p.title || 'Travel Plan';
  const titleLines = doc.splitTextToSize(title, pageW - margin * 2);
  ensureSpace(titleLines.length * 24 + 6);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 24 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const meta: string[] = [];
  if (p.client_name) meta.push(p.client_name);
  if (p.booking_ref) meta.push(`ID: ${p.booking_ref}`);
  if (p.date_range) meta.push(p.date_range);
  if (p.participants) meta.push(p.participants);
  if (meta.length) {
    ensureSpace(20);
    doc.text(meta.join('  ·  '), margin, y);
    y += 22;
  }

  // Total price banner
  if (p.total_value_eur && Number(p.total_value_eur) > 0) {
    ensureSpace(56);
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y, pageW - margin * 2, 48, 'F');
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('TOTAL PRICE', pageW / 2, y + 16, { align: 'center' });
    doc.setTextColor(10, 37, 64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`€ ${Number(p.total_value_eur).toLocaleString('en-US')}`, pageW / 2, y + 38, { align: 'center' });
    y += 56;
  }

  // Book Now (WeTravel) CTA button
  if (p.wetravel_checkout_url) {
    ensureSpace(56);
    const btnW = 220;
    const btnH = 40;
    const btnX = (pageW - btnW) / 2;
    doc.setFillColor(10, 37, 64);
    doc.roundedRect(btnX, y, btnW, btnH, 20, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.textWithLink('Book Now  \u2192', pageW / 2, y + 26, {
      align: 'center',
      url: p.wetravel_checkout_url,
    });
    y += btnH + 16;
  }

  if (weblink) {
    ensureSpace(20);
    doc.setTextColor(10, 37, 64);
    doc.setFont('helvetica', 'bold');
    doc.text('Interactive version:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 102, 204);
    doc.textWithLink(weblink, margin + 110, y, { url: weblink });
    y += 24;
  }

  if (p.summary_text) {
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(p.summary_text, pageW - margin * 2);
    ensureSpace(lines.length * 14 + 10);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 10;
  }

  if (days.length) {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(10, 37, 64);
    doc.text('Summary & Day-by-Day', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    days.forEach((d, i) => {
      const line = `Day ${d.day_number ?? i + 1} — ${d.title || ''}`;
      const wrapped = doc.splitTextToSize(line, pageW - margin * 2);
      ensureSpace(wrapped.length * 12 + 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 12 + 2;
    });
    y += 10;
  }

  days.forEach((d, idx) => {
    ensureSpace(60);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    doc.setTextColor(10, 37, 64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const dayTitle = `Day ${d.day_number ?? idx + 1}${d.title ? ` — ${d.title}` : ''}`;
    doc.text(dayTitle, margin, y);
    const dl = dayDateLabel(d);
    if (dl) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(String(dl), pageW - margin, y, { align: 'right' });
    }
    y += 18;

    if (d.subtitle) {
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(d.subtitle, pageW - margin * 2);
      ensureSpace(lines.length * 12 + 6);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 6;
    }

    if (d.narrative) {
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(d.narrative, pageW - margin * 2);
      ensureSpace(lines.length * 12 + 6);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 6;
    }

    const items = dayItems(d);
    if (items.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(10, 37, 64);
      ensureSpace(16);
      doc.text('ITINERARY & INCLUDED:', margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      items.forEach(h => {
        const lines = doc.splitTextToSize(`• ${h}`, pageW - margin * 2 - 10);
        ensureSpace(lines.length * 12 + 2);
        doc.text(lines, margin + 6, y);
        y += lines.length * 12 + 2;
      });
      y += 4;
    }

    const acc = accommodationLabel(d);
    if (acc) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      ensureSpace(14);
      doc.text(`Night: ${acc}`, margin, y);
      y += 16;
    }

    // Two images per day at the bottom (matching planner layout)
    const imgs = dayImageUrls[idx].filter(u => imgCache.get(u));
    if (imgs.length) {
      const gap = 10;
      const totalW = pageW - margin * 2;
      const imgW = imgs.length === 1 ? totalW : (totalW - gap) / 2;
      const imgH = Math.round((imgW * 2) / 3);
      ensureSpace(imgH + 10);
      imgs.forEach((u, i) => {
        const x = margin + i * (imgW + gap);
        drawImage(u, x, y, imgW, imgH);
      });
      y += imgH + 12;
    }
  });

  // ─── Final page: What Our Clients Say ───
  // Loads the bundled reviews screenshot via <img> + canvas so the image is
  // GUARANTEED to embed (no CORS/fetch dependency). Falls back to text page.
  const loadReviewsImage = (): Promise<{ dataUrl: string; w: number; h: number } | null> =>
    new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), w: img.naturalWidth, h: img.naturalHeight });
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = reviewsCoverUrl;
      } catch { resolve(null); }
    });

  try {
    doc.addPage();
    const reviewsImg = await loadReviewsImage();

    doc.setTextColor(10, 37, 64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('What Our Clients Say', pageW / 2, 60, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text('Trusted by hundreds of travellers exploring Portugal.', pageW / 2, 82, { align: 'center' });

    const imageTop = 100;
    const buttonReservedH = 90;
    const maxImgH = pageH - imageTop - buttonReservedH;
    const availableW = pageW - 60;
    let imgBottom = imageTop;
    if (reviewsImg) {
      const aspect = reviewsImg.h / reviewsImg.w;
      let imgW = availableW;
      let imgH = imgW * aspect;
      if (imgH > maxImgH) {
        imgH = maxImgH;
        imgW = imgH / aspect;
      }
      const imgX = (pageW - imgW) / 2;
      try {
        doc.addImage(reviewsImg.dataUrl, 'JPEG', imgX, imageTop, imgW, imgH, undefined, 'FAST');
        doc.link(imgX, imageTop, imgW, imgH, { url: ALL_REVIEWS_URL });
        imgBottom = imageTop + imgH;
      } catch (e) { console.warn('reviews addImage failed', e); }
    }

    const btnW = 260;
    const btnH = 42;
    const btnX = (pageW - btnW) / 2;
    const btnY = Math.min(imgBottom + 24, pageH - 60);
    doc.setFillColor(10, 37, 64);
    doc.roundedRect(btnX, btnY, btnW, btnH, 21, 21, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.textWithLink('See All Reviews  \u2192', pageW / 2, btnY + 26, {
      align: 'center',
      url: ALL_REVIEWS_URL,
    });
  } catch (e) {
    console.warn('reviews page failed', e);
  }




  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Your Tours Portugal · reservas@yourtours.pt · ${i}/${pageCount}`,
      pageW / 2,
      pageH - 18,
      { align: 'center' },
    );
  }

  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1] || '';

  const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const ytCode = sanitize(p.booking_ref || (p.id ? `YT-${String(p.id).slice(0, 4).toUpperCase()}` : 'YT'));
  const client = sanitize(p.client_name || 'Client');
  const dates = sanitize(p.date_range || '');
  const program = sanitize(p.title || 'Travel Plan');
  const parts = [ytCode, client, dates, program].filter(Boolean);
  const filename = `${parts.join(' - ').slice(0, 180)}.pdf`;
  return { base64, filename };
}

