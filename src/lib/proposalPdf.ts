import jsPDF from 'jspdf';

interface ProposalDay {
  day_number?: number;
  title?: string;
  date?: string;
  narrative?: string;
  highlights?: string[];
  accommodation?: string;
}

export interface ProposalLite {
  title?: string;
  client_name?: string;
  date_range?: string | null;
  participants?: string | null;
  summary_text?: string | null;
  total_value_eur?: number | null;
  public_token?: string;
  days?: ProposalDay[] | unknown;
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
  doc.setFillColor(10, 37, 64); // YT Blue
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
  if (p.client_name) meta.push(`Guest: ${p.client_name}`);
  if (p.date_range) meta.push(`Dates: ${p.date_range}`);
  if (p.participants) meta.push(`Travellers: ${p.participants}`);
  if (p.total_value_eur != null) meta.push(`Total: €${Number(p.total_value_eur).toLocaleString('en-GB')}`);
  doc.text(meta.join('   ·   '), margin, y);
  y += 22;

  // Weblink
  doc.setTextColor(10, 37, 64);
  doc.setFont('helvetica', 'bold');
  doc.text('Interactive version:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 102, 204);
  doc.textWithLink(weblink, margin + 110, y, { url: weblink });
  y += 24;

  // Summary
  if (p.summary_text) {
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(p.summary_text, pageW - margin * 2);
    ensureSpace(lines.length * 14 + 10);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 10;
  }

  // Days
  const days = Array.isArray(p.days) ? (p.days as ProposalDay[]) : [];
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
    if (d.date) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(String(d.date), pageW - margin, y, { align: 'right' });
    }
    y += 18;

    if (d.narrative) {
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(d.narrative, pageW - margin * 2);
      ensureSpace(lines.length * 12 + 6);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 6;
    }

    if (Array.isArray(d.highlights) && d.highlights.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(10, 37, 64);
      ensureSpace(16);
      doc.text('Highlights', margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      d.highlights.forEach((h) => {
        const lines = doc.splitTextToSize(`• ${h}`, pageW - margin * 2 - 10);
        ensureSpace(lines.length * 12 + 2);
        doc.text(lines, margin + 6, y);
        y += lines.length * 12 + 2;
      });
      y += 4;
    }

    if (d.accommodation) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      ensureSpace(14);
      doc.text(`Accommodation: ${d.accommodation}`, margin, y);
      y += 16;
    }
  });

  // Footer on each page
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

  // jsPDF returns dataURI string; strip prefix
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1] || '';
  const safeTitle = (p.title || 'travel-plan').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
  return { base64, filename: `${safeTitle}.pdf` };
}
