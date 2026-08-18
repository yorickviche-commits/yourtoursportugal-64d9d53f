import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseGoogleMapsUrl } from '@/lib/mapEmbed';

export interface GuidePlanRow {
  time: string;
  activity: string;
  supplier: string;
  pax: number;
  bookingLabel: string;
  paymentLabel: string;
  invoiceLabel?: string;
  net: number;
  real: number | null;
}

export interface GuidePlanDay {
  day: number;
  title: string;
  mapUrl?: string;
  rows: GuidePlanRow[];
}

export interface GuidePlanGeneral {
  leadCode: string;
  clientName: string;
  destination?: string | null;
  travelDates?: string | null;
  travelEndDate?: string | null;
  pax?: number | null;
  paxChildren?: number | null;
  paxInfants?: number | null;
  comfortLevel?: string | null;
  notes?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface GuidePlanOptions {
  general: GuidePlanGeneral;
  days: GuidePlanDay[];
  guideName?: string;
  proposalUrl?: string | null;
  showValues?: boolean;
}

const NAVY = [10, 37, 64] as const;
const GREY = [110, 118, 128] as const;
const M = 12;

const eur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

function link(doc: jsPDF, label: string, url: string, x: number, y: number, size = 8.5) {
  doc.setFontSize(size);
  doc.setTextColor(21, 101, 192);
  doc.textWithLink(label, x, y, { url });
  const w = doc.getTextWidth(label);
  doc.setDrawColor(21, 101, 192);
  doc.setLineWidth(0.3);
  doc.line(x, y + 0.9, x + w, y + 0.9);
  doc.setTextColor(0, 0, 0);
}

export function generateGuidePlanningPdf(opts: GuidePlanOptions) {
  const { general: g, days, guideName, proposalUrl, showValues = false } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - M * 2;
  let y = M;

  const header = (subtitle?: string) => {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PLANNING OPERACIONAL — GUIA', M, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `${g.leadCode} · ${g.clientName}${guideName ? ` · Guia: ${guideName}` : ''}${subtitle ? ` · ${subtitle}` : ''}`,
      M,
      16.5,
    );
    doc.setTextColor(0, 0, 0);
  };

  // ── Page 1: general info
  header();
  y = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Dados Gerais', M, y);

  const paxLabel = [
    g.pax ? `${g.pax} adultos` : null,
    g.paxChildren ? `${g.paxChildren} crianças` : null,
    g.paxInfants ? `${g.paxInfants} bebés` : null,
  ].filter(Boolean).join(' + ') || '—';

  const dates = [g.travelDates, g.travelEndDate].filter(Boolean).join(' → ') || '—';

  const generalRows: [string, string][] = [
    ['Cliente', g.clientName || '—'],
    ['Referência', g.leadCode || '—'],
    ['Destino', g.destination || '—'],
    ['Datas', dates],
    ['Pax', paxLabel],
    ['Nível / conforto', g.comfortLevel || '—'],
    ['Contacto cliente', [g.contactPhone, g.contactEmail].filter(Boolean).join(' · ') || '—'],
    ['Notas', (g.notes || '—').slice(0, 1200)],
  ];

  autoTable(doc, {
    startY: y + 4,
    margin: { left: M, right: M },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.8, textColor: [30, 30, 30], overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold', textColor: [GREY[0], GREY[1], GREY[2]] },
      1: { cellWidth: contentW - 44 },
    },
    body: generalRows,
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Links & Anexos', M, y);
  y += 6;

  if (proposalUrl) {
    link(doc, 'Programa comercial / proposta do cliente (abrir)', proposalUrl, M, y, 9);
    y += 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    doc.text('Sem programa comercial publicado.', M, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  days.forEach(d => {
    if (!d.mapUrl) return;
    if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); header(); y = 30; }
    link(doc, `Dia ${d.day} — rota no Google Maps`, d.mapUrl, M, y, 8.5);
    y += 5.5;
  });

  // ── One page per day
  days.forEach(d => {
    doc.addPage();
    header(`Dia ${d.day}`);
    y = 30;

    doc.setFillColor(240, 244, 248);
    doc.rect(M, y - 5, contentW, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`DIA ${d.day} — ${d.title || ''}`.slice(0, 130), M + 2, y + 1.4);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const parsed = d.mapUrl ? parseGoogleMapsUrl(d.mapUrl) : null;
    if (d.mapUrl) {
      link(doc, 'Ver rota do dia no Google Maps', d.mapUrl, M + 2, y + 1);
      y += 5.5;
      if (parsed?.waypoints?.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(GREY[0], GREY[1], GREY[2]);
        const wp = doc.splitTextToSize(`Pontos: ${parsed.waypoints.join(' → ')}`, contentW - 4);
        doc.text(wp, M + 2, y + 1);
        y += wp.length * 3.4;
        doc.setTextColor(0, 0, 0);
      }
      y += 2;
    }

    const head = showValues
      ? [['Hora', 'Atividade', 'FSE / Fornecedor', 'Pax', 'Reserva', 'Pagamento', 'Fatura', 'NET', 'Real']]
      : [['Hora', 'Atividade', 'FSE / Fornecedor', 'Pax', 'Reserva', 'Pagamento', 'Fatura']];

    const body = d.rows.map(r => {
      const base = [
        r.time || '—',
        r.activity || '—',
        r.supplier || '—',
        r.pax ? String(r.pax) : '—',
        r.bookingLabel || '—',
        r.paymentLabel || '—',
        r.invoiceLabel || '—',
      ];
      return showValues ? [...base, eur(r.net), r.real != null ? eur(r.real) : '—'] : base;
    });

    // Column widths tuned for 273 mm of content width
    const withValues = {
      0: { cellWidth: 16 }, 1: { cellWidth: 78 }, 2: { cellWidth: 55 },
      3: { cellWidth: 12, halign: 'center' as const }, 4: { cellWidth: 26 },
      5: { cellWidth: 32 }, 6: { cellWidth: 28 },
      7: { cellWidth: 13, halign: 'right' as const }, 8: { cellWidth: 13, halign: 'right' as const },
    };
    const noValues = {
      0: { cellWidth: 18 }, 1: { cellWidth: 96 }, 2: { cellWidth: 63 },
      3: { cellWidth: 14, halign: 'center' as const }, 4: { cellWidth: 28 },
      5: { cellWidth: 34 }, 6: { cellWidth: 30 },
    };

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head,
      body,
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [NAVY[0], NAVY[1], NAVY[2]], textColor: 255, fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: showValues ? withValues : noValues,
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  });

  // ── Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    doc.text('Your Tours Portugal — documento operacional interno', M, h - 7);
    doc.text(`${i} / ${total}`, pageW - M, h - 7, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  const safeGuide = (guideName || 'guia').replace(/[^\w-]+/g, '_');
  doc.save(`Planning_${g.leadCode}_${safeGuide}.pdf`);
}
