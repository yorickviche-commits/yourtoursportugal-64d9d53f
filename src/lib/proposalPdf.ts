import jsPDF from 'jspdf';

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
  days?: ProposalDay[] | unknown;
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

export function buildProposalPdfBase64(p: ProposalLite, weblink: string): { base64: string; filename: string } {
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
  y = 120;

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  const title = p.title || 'Travel Plan';
  doc.text(doc.splitTextToSize(title, pageW - margin * 2), margin, y);
  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const meta: string[] = [];
  if (p.client_name) meta.push(p.client_name);
  if (p.booking_ref) meta.push(`ID: ${p.booking_ref}`);
  if (p.date_range) meta.push(p.date_range);
  if (p.participants) meta.push(p.participants);
  doc.text(meta.join('  ·  '), margin, y);
  y += 22;

  if (weblink) {
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

  const days = Array.isArray(p.days) ? (p.days as ProposalDay[]) : [];

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
  });

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
  const safeTitle = (p.title || 'travel-plan').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
  return { base64, filename: `${safeTitle}.pdf` };
}
