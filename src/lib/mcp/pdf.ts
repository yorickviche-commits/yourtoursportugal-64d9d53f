/**
 * Server-side Travel Plan PDF builder.
 *
 * The "Imprimir" button in the UI rasterizes the rendered page (html2canvas +
 * jsPDF). There is no headless browser in this stack, so this module rebuilds
 * the same document with the vector jsPDF builder: same structure (cover,
 * day-by-day with images and route maps, hotels, pricing, terms, reviews,
 * about) and searchable text. Fine spacing may differ slightly from the
 * browser print.
 */
import jsPDF from "jspdf";
import { getPdfDict } from "@/lib/proposalPdfI18n";
import { resolveClosingText } from "@/lib/closingTermsI18n";
import { getHotelsDict, resolveHotelsText, mergeProposalHotels } from "@/lib/proposalHotelsI18n";
import { stripBoldMarkers } from "@/lib/richText";
import { eur } from "@/lib/money";

const YT_BLUE: [number, number, number] = [10, 37, 64];
const TERMS_URL = "https://drive.google.com/file/d/12AkvW2Ob0LtcooaciWY4e-nEx7hlOnQC/view?usp=sharing";

export interface PdfDay {
  day_number?: number;
  title?: string;
  subtitle?: string;
  date?: string;
  date_label?: string;
  items?: string[];
  highlights?: string[];
  accommodation?: unknown;
  cover_image_url?: string;
  images?: { url?: string; caption?: string }[];
  map_url?: string;
}

export interface PdfProposal {
  title?: string | null;
  client_name?: string | null;
  booking_ref?: string | null;
  date_range?: string | null;
  participants?: string | null;
  summary_text?: string | null;
  total_value_eur?: number | null;
  hero_image_url?: string | null;
  brand_logo_url?: string | null;
  wetravel_checkout_url?: string | null;
  language?: string | null;
  closing_terms?: Record<string, any> | null;
  days?: unknown;
}

export interface BuiltPdf {
  bytes: Uint8Array;
  pages: number;
  warnings: string[];
}

const dayItems = (d: PdfDay): string[] => {
  if (Array.isArray(d.items) && d.items.length) return d.items.map(String);
  if (Array.isArray(d.highlights) && d.highlights.length) return d.highlights.map(String);
  return [];
};

const accommodationLabel = (d: PdfDay): string | null => {
  const a: any = d.accommodation;
  if (!a) return null;
  if (typeof a === "string") return a;
  return a.hotel_name || a.label || null;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchImage(url?: string | null): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    const format: "JPEG" | "PNG" = type.includes("png") ? "PNG" : "JPEG";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return null;
    return { dataUrl: `data:image/${format.toLowerCase()};base64,${toBase64(bytes)}`, format };
  } catch {
    return null;
  }
}

export async function buildTravelPlanPdf(
  p: PdfProposal,
  opts: { hideOptionals?: boolean } = {},
): Promise<BuiltPdf> {
  const t = getPdfDict(p.language);
  const hd = getHotelsDict(p.language);
  const closing: Record<string, any> = p.closing_terms || {};
  const showPricing = closing.showPricing !== false;
  const showTerms = closing.showTerms !== false;
  const showReviews = closing.showReviews !== false;
  const showAbout = closing.showAbout !== false;
  const showHotels = closing.showHotels !== false;
  const showHotelDetails = closing.showHotelDetails !== false;
  const days = (Array.isArray(p.days) ? p.days : []) as PdfDay[];
  const warnings: string[] = [];

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const text = (value: string, size: number, style: "normal" | "bold" = "normal", color = [60, 60, 60]) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(stripBoldMarkers(value), contentW) as string[];
    lines.forEach((line) => {
      ensureSpace(size + 6);
      doc.text(line, margin, y + size);
      y += size + 4;
    });
  };

  // ─── Cover ───────────────────────────────────────────────────────────────
  const hero = await fetchImage(p.hero_image_url);
  const logo = await fetchImage(p.brand_logo_url);
  doc.setFillColor(...YT_BLUE);
  doc.rect(0, 0, pageW, 92, "F");
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, margin, 22, 120, 48);
    } catch { /* ignore broken logo */ }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("YOUR TOURS PORTUGAL", margin, 56);
  }
  y = 112;

  if (hero) {
    try {
      const h = Math.round(contentW / (21 / 9));
      doc.addImage(hero.dataUrl, hero.format, margin, y, contentW, h);
      y += h + 18;
    } catch { /* ignore */ }
  } else {
    warnings.push("Capa sem imagem hero");
  }

  text(p.title || t.travelPlanFallback, 20, "bold", YT_BLUE as unknown as number[]);
  y += 4;
  const headerBits = [p.client_name, p.booking_ref ? `ID: ${p.booking_ref}` : "", p.date_range, p.participants]
    .filter(Boolean)
    .join("  ·  ");
  if (headerBits) text(headerBits, 10, "normal", [110, 110, 110]);
  y += 8;
  if (p.summary_text) text(p.summary_text, 11);

  if (showPricing && p.wetravel_checkout_url) {
    ensureSpace(60);
    const btnW = 160, btnH = 32;
    doc.setFillColor(...YT_BLUE);
    doc.roundedRect(margin, y + 8, btnW, btnH, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.textWithLink("BOOK NOW", margin + btnW / 2, y + 30, { align: "center", url: p.wetravel_checkout_url });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text("Refundable Deposit if plans change*", margin + btnW / 2, y + btnH + 18, { align: "center" });
    doc.setTextColor(0, 102, 204);
    doc.textWithLink("see terms and conditions", margin + btnW / 2, y + btnH + 27, { align: "center", url: TERMS_URL });
    y += btnH + 40;
  }

  // ─── Day by day ──────────────────────────────────────────────────────────
  if (days.length) {
    doc.addPage();
    y = margin;
    text(t.summaryDayByDay, 14, "bold", YT_BLUE as unknown as number[]);
    y += 6;
    days.forEach((d, i) => {
      text(`${t.day} ${d.day_number ?? i + 1} — ${d.title || ""}`, 10, "normal", [80, 80, 80]);
    });
  }

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const n = d.day_number ?? i + 1;
    doc.addPage();
    y = margin;

    doc.setFillColor(...YT_BLUE);
    doc.rect(margin, y, 4, 26, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...YT_BLUE);
    doc.text(stripBoldMarkers(`${t.day} ${n} — ${d.title || ""}`), margin + 12, y + 18);
    y += 34;

    const dateLabel = d.date_label || d.date || "";
    if (dateLabel) text(dateLabel, 9, "normal", [130, 130, 130]);
    if (d.subtitle) text(d.subtitle, 11, "bold", [70, 70, 70]);

    const cover = await fetchImage(d.cover_image_url);
    if (cover) {
      try {
        const h = Math.round(contentW / (16 / 9));
        ensureSpace(h + 10);
        doc.addImage(cover.dataUrl, cover.format, margin, y, contentW, h);
        y += h + 12;
      } catch { /* ignore */ }
    }

    const items = dayItems(d);
    if (items.length) {
      text(t.itineraryIncluded, 10, "bold", YT_BLUE as unknown as number[]);
      items.forEach((it) => text(`•  ${it}`, 10));
      y += 4;
    }
    const acc = accommodationLabel(d);
    if (acc) text(`${t.night}: ${acc}`, 10, "bold", [70, 70, 70]);

    // Route map — the Google Static Maps render is produced server-side.
    if (d.map_url) {
      const mapImg = await fetchImage(d.map_url.startsWith("http") && /static|googleusercontent|storage/.test(d.map_url) ? d.map_url : null);
      if (mapImg) {
        try {
          const h = Math.round(contentW / (21 / 9));
          ensureSpace(h + 24);
          doc.addImage(mapImg.dataUrl, mapImg.format, margin, y, contentW, h);
          y += h + 8;
        } catch { /* ignore */ }
      } else {
        warnings.push(`Dia ${n} sem mapa renderizado (apenas link Google Maps)`);
      }
      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 102, 204);
      doc.textWithLink(t.openRoute, margin, y + 10, { url: d.map_url });
      y += 22;
    } else {
      warnings.push(`Dia ${n} sem mapa`);
    }

    const dayImages = (Array.isArray(d.images) ? d.images : []).filter((im) => im?.url).slice(0, 2);
    if (!dayImages.length && !cover) warnings.push(`Dia ${n} sem imagens`);
    if (dayImages.length) {
      const gap = 12;
      const w = (contentW - gap) / 2;
      const h = Math.round(w / (4 / 3));
      ensureSpace(h + 10);
      for (let k = 0; k < dayImages.length; k++) {
        const img = await fetchImage(dayImages[k].url);
        if (!img) continue;
        try {
          doc.addImage(img.dataUrl, img.format, margin + k * (w + gap), y, w, h);
        } catch { /* ignore */ }
      }
      y += h + 12;
    }
  }

  // ─── Hotels, pricing, terms, reviews, about ──────────────────────────────
  doc.addPage();
  y = margin;

  const total = Number(p.total_value_eur) || 0;
  const accList: any[] = Array.isArray(closing.accommodation) ? closing.accommodation : [];
  const hotels = showHotels ? mergeProposalHotels(accList, Array.isArray(closing.hotels) ? closing.hotels : []) : [];
  const hotelsNights = hotels.reduce((s: number, x: any) => s + (Number(x.nights) || 0), 0);
  const hotelsRooms = hotels.reduce((s: number, x: any) => Math.max(s, Number(x.rooms) || 0), 0);
  const hotelsTotal = Math.round(hotels.reduce((s: number, x: any) => s + (Number(x.value) || 0), 0));

  if (hotels.length) {
    text(hd.hotelsIncluded, 14, "bold", YT_BLUE as unknown as number[]);
    hotels.forEach((h: any) => {
      text(`**${h.name}**${h.city ? ` — ${h.city}` : ""}`, 11, "bold", [70, 70, 70]);
      const meta = [
        showHotelDetails && h.checkIn ? `${hd.checkIn}: ${h.checkIn}` : "",
        showHotelDetails && h.checkOut ? `${hd.checkOut}: ${h.checkOut}` : "",
        showHotelDetails && h.nights ? `${h.nights} ${hd.nights}` : "",
        showHotelDetails && h.roomType ? String(h.roomType) : "",
      ].filter(Boolean).join("  ·  ");
      if (meta) text(meta, 9, "normal", [120, 120, 120]);
    });
    y += 8;
  } else if (showHotels) {
    warnings.push("Sem hotéis indicados");
  }

  if (showPricing && total > 0) {
    text(hd.total, 14, "bold", YT_BLUE as unknown as number[]);
    const programmeTotal = Math.max(0, total - hotelsTotal);
    const rows: [string, string][] = [[hd.programmePrice, eur(programmeTotal)]];
    if (hotels.length && hotelsTotal > 0) rows.push([hd.hotelsPrice(hotelsNights, hotelsRooms), eur(hotelsTotal)]);
    rows.push([closing.netPricing ? t.totalPriceNet : hd.total, eur(total)]);
    rows.forEach(([label, value], idx) => {
      const bold = idx === rows.length - 1;
      ensureSpace(20);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(bold ? 10 : 60, bold ? 37 : 60, bold ? 64 : 60);
      doc.text(label, margin, y + 11);
      doc.text(value, pageW - margin, y + 11, { align: "right" });
      doc.setDrawColor(228, 232, 238);
      doc.line(margin, y + 16, pageW - margin, y + 16);
      y += 18;
    });
    y += 10;

    const optionals: any[] = Array.isArray(closing.optionals) ? closing.optionals : [];
    const showOptionals = !opts.hideOptionals && closing.showOptionals !== false && optionals.length > 0;
    if (showOptionals) {
      text(hd.optionals, 12, "bold", YT_BLUE as unknown as number[]);
      optionals.forEach((o: any) => {
        const label = `${Number(o.day) > 0 ? `${t.day} ${o.day} — ` : ""}${String(o.description || "")}`;
        text(`•  ${label}: ${eur(Number(o.pvp) || 0)}`, 10);
      });
      text(hd.optionalsNote, 8, "normal", [130, 130, 130]);
      y += 6;
    }
  }

  if (showTerms) {
    for (const field of ["payment", "cancellation", "importantNotes", "closingMessage"] as const) {
      const value = resolveClosingText(field, closing?.[field], p.language);
      if (!value) continue;
      const heading: Record<string, string> = {
        payment: t.paymentConditions,
        cancellation: t.cancellationConditions,
        importantNotes: t.importantNotes,
        closingMessage: "",
      };
      if (heading[field]) text(heading[field], 12, "bold", YT_BLUE as unknown as number[]);
      value.split("\n").forEach((line) => line.trim() && text(line, 10));
      y += 8;
    }
  }

  if (showReviews) {
    ensureSpace(60);
    text(t.reviewsTitle, 14, "bold", YT_BLUE as unknown as number[]);
    doc.setTextColor(0, 102, 204);
    doc.setFontSize(10);
    ensureSpace(20);
    doc.textWithLink("yourtoursportugal.com/our-reviews", margin, y + 10, {
      url: "https://yourtoursportugal.com/our-reviews/",
    });
    y += 26;
  }

  if (showAbout) {
    ensureSpace(80);
    text("Your Tours Portugal", 13, "bold", YT_BLUE as unknown as number[]);
    text("info@yourtours.pt  ·  www.yourtoursportugal.com", 10, "normal", [90, 90, 90]);
  }

  const bytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
  return { bytes, pages: doc.getNumberOfPages(), warnings: Array.from(new Set(warnings)) };
}
