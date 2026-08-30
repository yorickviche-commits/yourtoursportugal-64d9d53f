import jsPDF from 'jspdf';
import reviewsCoverUrl from '@/assets/proposal-reviews-cover.png';
import foundersAsset from '@/assets/founders.png.asset.json';
import { parseGoogleMapsUrl } from '@/lib/mapEmbed';
import { buildRouteMapImage, type RouteMapImage } from '@/lib/staticRouteMap';
import { drawRichTextPdf, stripBoldMarkers } from '@/lib/richText';
import { getPdfDict } from '@/lib/proposalPdfI18n';
import { resolveClosingText } from '@/lib/closingTermsI18n';
import { getHotelsDict, resolveHotelsText, mergeProposalHotels } from '@/lib/proposalHotelsI18n';

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
  map_url?: string;
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
  closing_terms?: Record<string, any> | null;
  language?: string | null;
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
  const t = getPdfDict(p.language);
  const days = Array.isArray(p.days) ? (p.days as ProposalDay[]) : [];
  const headerBits = [
    p.client_name && `${p.client_name}`,
    (p.booking_ref || '') && `ID: ${p.booking_ref}`,
    p.date_range || '',
    p.participants || '',
  ].filter(Boolean);

  const lines: string[] = [];
  lines.push(stripBoldMarkers(p.title || t.travelPlanFallback));
  if (headerBits.length) lines.push(headerBits.join(' · '));
  lines.push('');
  if (p.summary_text) {
    lines.push(stripBoldMarkers(p.summary_text).trim());
    lines.push('');
  }

  if (days.length) {
    lines.push(t.summaryDayByDay);
    days.forEach((d, i) => {
      lines.push(`${t.day} ${d.day_number ?? i + 1} — ${stripBoldMarkers(d.title || '')}`.trim());
    });
    lines.push('');
    days.forEach((d, i) => {
      lines.push(`${t.day} ${d.day_number ?? i + 1} — ${stripBoldMarkers(d.title || '')}`.trim());
      const dl = dayDateLabel(d);
      if (dl) lines.push(dl);
      if (d.subtitle) lines.push(stripBoldMarkers(d.subtitle));
      const items = dayItems(d);
      if (items.length) {
        lines.push(t.itineraryIncluded);
        items.forEach(it => lines.push(`  • ${stripBoldMarkers(it)}`));
      }
      const acc = accommodationLabel(d);
      if (acc) lines.push(`${t.night}: ${stripBoldMarkers(acc)}`);
      lines.push('');
    });
  }

  if (weblink) {
    lines.push(t.interactiveLead);
    lines.push(weblink);
    lines.push('');
    lines.push(t.attachedNote);
  }
  return lines.join('\n');
}

/**
 * Single source of truth for the client-facing PDF.
 * Both the Travel Planner "PDF" button and the email attachment render through
 * this builder, so the attached document is byte-for-byte the same document.
 */
export async function buildProposalPdfDoc(
  p: ProposalLite,
  weblink: string,
  opts?: { idOverride?: string | null },
): Promise<{ doc: jsPDF; filename: string }> {
  const t = getPdfDict(p.language);
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

  // Pre-render one static route map per day that has a Google Maps route
  const routeMapCache = new Map<number, RouteMapImage | null>();
  await Promise.all(
    days.map(async (d, i) => {
      if (!d.map_url) return;
      try {
        routeMapCache.set(i, await buildRouteMapImage(d.map_url));
      } catch (e) {
        console.warn('route map render failed', e);
        routeMapCache.set(i, null);
      }
    }),
  );

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
  doc.text(t.headerSubtitle, margin, 60);
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
  const title = stripBoldMarkers(p.title || t.travelPlanFallback);
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

  // (Total price is rendered at the end of the programme, before "What's Included")


  // Book Now (WeTravel) CTA is rendered in the Total Price section at the end of the programme


  if (weblink) {
    ensureSpace(20);
    doc.setTextColor(10, 37, 64);
    doc.setFont('helvetica', 'bold');
    doc.text(t.interactiveVersion, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 102, 204);
    doc.textWithLink(weblink, margin + doc.getTextWidth(t.interactiveVersion) + 8, y, { url: weblink });
    y += 24;
  }

  if (p.summary_text) {
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    const estLines = doc.splitTextToSize(stripBoldMarkers(p.summary_text), pageW - margin * 2);
    ensureSpace(estLines.length * 14 + 10);
    y = drawRichTextPdf(doc as any, p.summary_text, {
      x: margin, y, maxWidth: pageW - margin * 2, lineHeight: 14, baseStyle: 'italic', boldStyle: 'bolditalic',
    });
    y += 10;
  }

  if (days.length) {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(10, 37, 64);
    doc.text(t.summaryDayByDay, margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    days.forEach((d, i) => {
      const line = `${t.day} ${d.day_number ?? i + 1} — ${d.title || ''}`;
      const est = doc.splitTextToSize(stripBoldMarkers(line), pageW - margin * 2);
      ensureSpace(est.length * 12 + 2);
      y = drawRichTextPdf(doc as any, line, {
        x: margin, y, maxWidth: pageW - margin * 2, lineHeight: 12, baseStyle: 'normal', boldStyle: 'bold',
      });
      y += 2;
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
    const dayTitle = `${t.day} ${d.day_number ?? idx + 1}${d.title ? ` — ${stripBoldMarkers(d.title)}` : ''}`;
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
      const est = doc.splitTextToSize(stripBoldMarkers(d.subtitle), pageW - margin * 2);
      ensureSpace(est.length * 12 + 6);
      y = drawRichTextPdf(doc as any, d.subtitle, {
        x: margin, y, maxWidth: pageW - margin * 2, lineHeight: 12, baseStyle: 'italic', boldStyle: 'bolditalic',
      });
      y += 6;
    }

    if (d.narrative) {
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const est = doc.splitTextToSize(stripBoldMarkers(d.narrative), pageW - margin * 2);
      ensureSpace(est.length * 12 + 6);
      y = drawRichTextPdf(doc as any, d.narrative, {
        x: margin, y, maxWidth: pageW - margin * 2, lineHeight: 12, baseStyle: 'normal', boldStyle: 'bold',
      });
      y += 6;
    }

    // Two images per day, right after the subtitle and before the itinerary
    const dayImgs = dayImageUrls[idx].filter(u => imgCache.get(u));
    if (dayImgs.length) {
      const gap = 10;
      const totalW = pageW - margin * 2;
      const imgW = dayImgs.length === 1 ? totalW : (totalW - gap) / 2;
      const imgH = Math.round((imgW * 2) / 3);
      ensureSpace(imgH + 10);
      dayImgs.forEach((u, i) => {
        const x = margin + i * (imgW + gap);
        drawImage(u, x, y, imgW, imgH);
      });
      y += imgH + 12;
    }

    const items = dayItems(d);
    if (items.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(10, 37, 64);
      ensureSpace(16);
      doc.text(t.itineraryIncluded, margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      items.forEach(h => {
        const est = doc.splitTextToSize(`• ${stripBoldMarkers(h)}`, pageW - margin * 2 - 10);
        ensureSpace(est.length * 12 + 2);
        y = drawRichTextPdf(doc as any, `• ${h}`, {
          x: margin + 6, y, maxWidth: pageW - margin * 2 - 10, lineHeight: 12, baseStyle: 'normal', boldStyle: 'bold',
        });
        y += 2;
      });
      y += 4;
    }

    const acc = accommodationLabel(d);
    if (acc) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      ensureSpace(14);
      doc.text(`${t.night}: ${stripBoldMarkers(acc)}`, margin, y);
      y += 16;
    }

    // Route map (static block linking to Google Maps)
    if (d.map_url) {
      const parsed = parseGoogleMapsUrl(d.map_url);
      const stops = parsed.waypoints;
      const routeImg = routeMapCache.get(idx);
      if (routeImg) {
        const imgW = pageW - margin * 2;
        const imgH = Math.round((imgW * routeImg.height) / routeImg.width);
        ensureSpace(imgH + 34);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(10, 37, 64);
        doc.text(`${t.routeMap} — ${t.day} ${d.day_number ?? idx + 1}`, margin, y + 10);
        y += 16;
        try {
          doc.addImage(routeImg.dataUrl, 'JPEG', margin, y, imgW, imgH, undefined, 'FAST');
          doc.setDrawColor(200, 215, 230);
          doc.roundedRect(margin, y, imgW, imgH, 4, 4, 'S');
          doc.link(margin, y, imgW, imgH, { url: d.map_url });
          y += imgH + 6;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 102, 204);
          doc.textWithLink(t.openRoute, margin, y + 8, { url: d.map_url });
          y += 20;
        } catch (e) {
          console.warn('route map addImage failed', e);
        }
      }
      if (!routeImg) {
      const boxPad = 10;
      const linesText = stops.length
        ? doc.splitTextToSize(stops.join('  →  '), pageW - margin * 2 - boxPad * 2)
        : [];
      const boxH = 22 + (linesText.length * 12) + 22 + boxPad;
      ensureSpace(boxH + 8);
      doc.setDrawColor(200, 215, 230);
      doc.setFillColor(240, 247, 255);
      doc.roundedRect(margin, y, pageW - margin * 2, boxH, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(10, 37, 64);
      doc.text(`${t.routeMap} — ${t.day} ${d.day_number ?? idx + 1}`, margin + boxPad, y + 16);
      if (linesText.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 80, 100);
        doc.text(linesText, margin + boxPad, y + 30);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 102, 204);
      const linkY = y + boxH - 8;
      doc.textWithLink(t.openRoute, margin + boxPad, linkY, { url: d.map_url });
      y += boxH + 10;
      }
    }

  });

  // ─── Pricing & Conditions (end of programme, total price before inclusions) ───
  {
    const closing: any = (p as any).closing_terms || {};
    const showPricing = closing.showPricing !== false;
    const total = Number(p.total_value_eur) || 0;

    if (showPricing) {
      ensureSpace(40);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 20;

      if (total > 0 || p.wetravel_checkout_url) {
        ensureSpace(80);
        const boxH = 64;
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y, pageW - margin * 2, boxH, 'F');

        if (total > 0) {
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(closing.netPricing ? t.totalPriceNet : t.totalPrice, margin + 14, y + 18);
          doc.setTextColor(10, 37, 64);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(18);
          doc.text(`€ ${total.toLocaleString('en-US')}`, margin + 14, y + 40);
          const sub = [p.participants, p.date_range].filter(Boolean).join('  ·  ');
          if (sub) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text(sub, margin + 14, y + 55);
          }
        }

        if (p.wetravel_checkout_url) {
          const btnW = 150;
          const btnH = 34;
          const btnX = pageW - margin - 14 - btnW;
          const btnY = y + (boxH - btnH) / 2;
          doc.setFillColor(10, 37, 64);
          doc.roundedRect(btnX, btnY, btnW, btnH, 6, 6, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.textWithLink(t.bookNow, btnX + btnW / 2, btnY + 22, {
            align: 'center',
            url: p.wetravel_checkout_url,
          });
          doc.link(btnX, btnY, btnW, btnH, { url: p.wetravel_checkout_url });
        }

        y += boxH + 18;
      }

      const autoIncluded = days
        .map((d, i) => `**${t.day} ${d.day_number ?? i + 1} — ${stripBoldMarkers(d.title || '')}**\n${dayItems(d).slice(0, 6).map(b => `• ${b}`).join('\n')}`)
        .join('\n\n');

      // Hotels Included block (from Costing + details edited in the planner)
      const hd = getHotelsDict(p.language);
      const acc: any[] = Array.isArray(closing.accommodation) ? closing.accommodation : [];
      const showHotels = closing.showHotels !== false;
      const showHotelDetails = closing.showHotelDetails !== false;
      const hotels = showHotels ? mergeProposalHotels(acc, Array.isArray(closing.hotels) ? closing.hotels : []) : [];
      const hotelsNights = hotels.reduce((s, x) => s + (Number(x.nights) || 0), 0);
      const hotelsRooms = hotels.reduce((s, x) => Math.max(s, Number(x.rooms) || 0), 0);
      const hotelsTotal = Math.round(hotels.reduce((s, x) => s + (Number(x.value) || 0), 0));
      const programmeTotal = Math.max(0, total - hotelsTotal);
      const eur = (n: number) => `€ ${Number(n || 0).toLocaleString('en-US')}`;

      if (total > 0) {
        const rows: Array<[string, string]> = [[hd.programmePrice, eur(programmeTotal)]];
        if (hotels.length && hotelsTotal > 0) rows.push([hd.hotelsPrice(hotelsNights, hotelsRooms), eur(hotelsTotal)]);
        rows.push([closing.netPricing ? t.totalPriceNet : hd.total, eur(total)]);
        ensureSpace(rows.length * 18 + 24);
        rows.forEach(([label, value], i) => {
          const bold = i === rows.length - 1;
          doc.setFont('helvetica', bold ? 'bold' : 'normal');
          doc.setFontSize(10);
          doc.setTextColor(bold ? 10 : 60, bold ? 37 : 60, bold ? 64 : 60);
          doc.text(label, margin + 4, y + 11);
          doc.text(value, pageW - margin - 4, y + 11, { align: 'right' });
          doc.setDrawColor(228, 232, 238);
          doc.line(margin, y + 16, pageW - margin, y + 16);
          y += 18;
        });
        y += 12;
      }

      // Optionals — extras outside the base programme price
      const optionals: any[] = Array.isArray(closing.optionals) ? closing.optionals : [];
      const optionalsText = (closing.showOptionals !== false && optionals.length)
        ? optionals.map((o: any) => {
            const label = `${Number(o.day) > 0 ? `${t.day} ${o.day} — ` : ''}${stripBoldMarkers(String(o.description || ''))}`;
            const price = `${eur(o.pvp)}${o.perPerson ? ` (${eur(o.perPerson)} / ${hd.perPerson.toLowerCase()})` : ''}`;
            return `• ${label}: ${price}`;
          }).join('\n') + `\n${hd.optionalsNote}`
        : '';



      const hotelsText = hotels
        .map(hotel => {
          const parts = [`**${hotel.name}**${hotel.city ? ` — ${hotel.city}` : ''}`];
          const meta = [
            showHotelDetails && hotel.checkIn ? `${hd.checkIn}: ${hotel.checkIn}` : '',
            showHotelDetails && hotel.checkOut ? `${hd.checkOut}: ${hotel.checkOut}` : '',
            showHotelDetails && hotel.nights ? `${hotel.nights} ${hd.nights.toLowerCase()}` : '',
            showHotelDetails && hotel.rooms ? `${hotel.rooms} ${hd.rooms.toLowerCase()}` : '',
            showHotelDetails && hotel.value ? eur(hotel.value) : '',
          ].filter(Boolean).join('  ·  ');
          if (meta) parts.push(meta);
          if (hotel.description) parts.push(stripBoldMarkers(hotel.description));
          if (hotel.mapUrl) parts.push(hotel.mapUrl);
          return parts.join('\n');
        })
        .join('\n\n');

      const blocks: Array<{ heading: string; text: string }> = [
        ...(hotelsText ? [{ heading: hd.hotelsIncluded, text: hotelsText }] : []),
        { heading: t.included, text: (closing.inclusionsOverride?.trim() || autoIncluded) },
        { heading: hd.notIncluded, text: resolveHotelsText('notIncludedDefault', closing.notIncluded, p.language) },
        { heading: t.paymentConditions, text: resolveClosingText('payment', closing.payment, p.language) },
        { heading: t.cancellationConditions, text: resolveClosingText('cancellation', closing.cancellation, p.language) },
        { heading: t.importantNotes, text: resolveClosingText('importantNotes', closing.importantNotes, p.language) },
        { heading: hd.nextSteps, text: resolveHotelsText('nextStepsDefault', closing.nextSteps, p.language) },
      ];


      blocks.forEach(({ heading, text }) => {
        if (!text || !String(text).trim()) return;
        ensureSpace(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(10, 37, 64);
        doc.text(heading, margin, y);
        y += 16;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        String(text).split('\n').forEach(line => {
          if (!line.trim()) { y += 6; return; }
          const est = doc.splitTextToSize(stripBoldMarkers(line), pageW - margin * 2 - 6);
          ensureSpace(est.length * 12 + 2);
          y = drawRichTextPdf(doc as any, line, {
            x: margin + 4, y, maxWidth: pageW - margin * 2 - 6, lineHeight: 12, baseStyle: 'normal', boldStyle: 'bold',
          });
          y += 2;
        });
        y += 10;
      });
    }
  }



  // ─── Final page: What Our Clients Say ───
  // Loads the bundled reviews screenshot via <img> + canvas so the image is
  // GUARANTEED to embed (no CORS/fetch dependency). Falls back to text page.
  const loadImg = (url: string): Promise<{ dataUrl: string; w: number; h: number } | null> =>
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
        img.src = url;
      } catch { resolve(null); }
    });

  try {
    doc.addPage();
    const reviewsImg = await loadImg(reviewsCoverUrl);


    doc.setTextColor(10, 37, 64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(t.reviewsTitle, pageW / 2, 60, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(t.reviewsSubtitle, pageW / 2, 82, { align: 'center' });

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
    doc.textWithLink(t.seeAllReviews, pageW / 2, btnY + 26, {
      align: 'center',
      url: ALL_REVIEWS_URL,
    });
    doc.link(btnX, btnY, btnW, btnH, { url: ALL_REVIEWS_URL });

    // ─── About Your Tours Portugal (own page, with founders photo) ───
    doc.addPage();
    const foundersImg = await loadImg(foundersAsset.url);

    let ay = 62;
    doc.setTextColor(10, 37, 64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(t.aboutTitle, pageW / 2, ay, { align: 'center' });
    ay += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const aboutLines = doc.splitTextToSize(t.aboutBody, pageW - 110);
    doc.text(aboutLines, pageW / 2, ay, { align: 'center' });
    ay += aboutLines.length * 13 + 16;

    if (foundersImg) {
      const aspect = foundersImg.h / foundersImg.w;
      let iw = pageW - 150;
      let ih = iw * aspect;
      const maxH = pageH - ay - 170;
      if (ih > maxH) { ih = maxH; iw = ih / aspect; }
      const ix = (pageW - iw) / 2;
      try {
        doc.addImage(foundersImg.dataUrl, 'JPEG', ix, ay, iw, ih, undefined, 'FAST');
        ay += ih + 18;
      } catch (e) { console.warn('founders addImage failed', e); }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 80);
    const foundersLines = doc.splitTextToSize(t.foundersBody, pageW - 110);
    doc.text(foundersLines, pageW / 2, ay, { align: 'center' });
    ay += foundersLines.length * 12 + 22;

    // Contact buttons: Email · Website · Phone/WhatsApp
    const labels: { text: string; url: string }[] = [
      { text: 'reservas@yourtours.pt', url: 'mailto:reservas@yourtours.pt' },
      { text: 'yourtoursportugal.com', url: 'https://yourtoursportugal.com' },
      { text: '+351 919 473 029', url: 'https://wa.me/351919473029' },
    ];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const bH = 26;
    const gap = 12;
    const widths = labels.map((l) => doc.getTextWidth(l.text) + 26);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
    let bx = (pageW - totalW) / 2;
    labels.forEach((l, i) => {
      const w = widths[i];
      doc.setFillColor(10, 37, 64);
      doc.roundedRect(bx, ay, w, bH, 13, 13, 'F');
      doc.setTextColor(255, 255, 255);
      doc.textWithLink(l.text, bx + w / 2, ay + 17, { align: 'center', url: l.url });
      doc.link(bx, ay, w, bH, { url: l.url });
      bx += w + gap;
    });
    doc.setTextColor(0, 0, 0);

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

  const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const ytCode = sanitize(opts?.idOverride || p.booking_ref || (p.id ? `YT-${String(p.id).slice(0, 4).toUpperCase()}` : 'YT'));
  const client = sanitize(p.client_name || 'Client');
  const dates = sanitize(p.date_range || '');
  const program = sanitize(p.title || 'Travel Plan');
  const parts = [ytCode, client, program, dates].filter(Boolean);
  const filename = `${parts.join(' - ').slice(0, 180)}.pdf`;
  return { doc, filename };
}

/** Email attachment flavour — same document, encoded as base64. */
export async function buildProposalPdfBase64(
  p: ProposalLite,
  weblink: string,
  opts?: { idOverride?: string | null },
): Promise<{ base64: string; filename: string }> {
  const { doc, filename } = await buildProposalPdfDoc(p, weblink, opts);
  const dataUri = doc.output('datauristring');
  return { base64: dataUri.split(',')[1] || '', filename };
}

/** Travel Planner download flavour — identical document, saved to disk. */
export async function downloadProposalPdf(
  p: ProposalLite,
  weblink: string,
  opts?: { idOverride?: string | null; filenameOverride?: string | null },
): Promise<string> {
  const { doc, filename } = await buildProposalPdfDoc(p, weblink, opts);
  const finalName = opts?.filenameOverride
    ? `${opts.filenameOverride.replace(/\.pdf$/i, '')}.pdf`
    : filename;
  doc.save(finalName);
  return finalName;
}


