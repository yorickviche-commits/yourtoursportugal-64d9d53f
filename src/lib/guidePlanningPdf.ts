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
const M = 14;

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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = M;

  // ── Header band
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PLANNING OPERACIONAL — GUIA', M, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${g.leadCode} · ${g.clientName}${guideName ? ` · Guia: ${guideName}` : ''}`,
    M,
    19,
  );
  doc.setTextColor(0, 0, 0);
  y = 34;

  // ── Dados gerais
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Dados Gerais', M, y);
  y += 2;

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
    ['Notas', (g.notes || '—').slice(0, 500)],
  ];

  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 1.4, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', textColor: [GREY[0], GREY[1], GREY[2]] },
      1: { cellWidth: 'auto' },
    },
    body: generalRows,
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (proposalUrl) {
    link(doc, 'Programa comercial / proposta do cliente (abrir)', proposalUrl, M, y, 9);
    y += 8;
  }

  // ── Days
  days.forEach(d => {
    if (y > 250) { doc.addPage(); y = M + 4; }

    doc.setFillColor(240, 244, 248);
    doc.rect(M, y - 4.5, pageW - M * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`DIA ${d.day} — ${d.title || ''}`.slice(0, 95), M + 2, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 8;

    const parsed = d.mapUrl ? parseGoogleMapsUrl(d.mapUrl) : null;
    if (d.mapUrl) {
      link(doc, 'Ver rota do dia no Google Maps', d.mapUrl, M + 2, y + 1);
      y += 5;
      if (parsed?.waypoints?.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(GREY[0], GREY[1], GREY[2]);
        const wp = doc.splitTextToSize(`Pontos: ${parsed.waypoints.join(' → ')}`, pageW - M * 2 - 4);
        doc.text(wp, M + 2, y + 1);
        y += wp.length * 3.2;
        doc.setTextColor(0, 0, 0);
      }
      y += 2;
    }

    const head = showValues
      ? [['Hora', 'Atividade', 'FSE / Fornecedor', 'Pax', 'Reserva', 'Pagamento', 'NET', 'Real']]
      : [['Hora', 'Atividade', 'FSE / Fornecedor', 'Pax', 'Reserva', 'Pagamento']];

    const body = d.rows.map(r => {
      const base = [
        r.time || '—',
        r.activity || '—',
        r.supplier || '—',
        r.pax ? String(r.pax) : '—',
        r.bookingLabel,
        r.paymentLabel,
      ];
      return showValues ? [...base, eur(r.net), r.real != null ? eur(r.real) : '—'] : base;
    });

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head,
      body,
      styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [NAVY[0], NAVY[1], NAVY[2]], textColor: 255, fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: showValues
        ? {
            0: { cellWidth: 14 }, 1: { cellWidth: 55 }, 2: { cellWidth: 32 },
            3: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 },
            6: { cellWidth: 16, halign: 'right' }, 7: { cellWidth: 16, halign: 'right' },
          }
        : {
            0: { cellWidth: 16 }, 1: { cellWidth: 74 }, 2: { cellWidth: 40 },
            3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 24 }, 5: { cellWidth: 24 },
          },
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
    doc.text('Your Tours Portugal — documento operacional interno', M, h - 8);
    doc.text(`${i} / ${total}`, pageW - M, h - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  const safeGuide = (guideName || 'guia').replace(/[^\w-]+/g, '_');
  doc.save(`Planning_${g.leadCode}_${safeGuide}.pdf`);
}
