import type { LeadCostingDay, LeadCostItem } from '@/components/trip/LeadCostingEditor';

export interface CostingExportInput {
  days: LeadCostingDay[];
  leadCode?: string;
  clientName?: string;
  destination?: string;
  version: number;
  pax: number;
  paxChildren: number;
  startDate?: string | null;
  endDate?: string | null;
  pvpOverride?: number | null;
}

const statuses = { neutro: 'Neutro', aceite: 'Aceite', opcionais: 'Opcional', eliminar: 'Excluído' };
const layers: Record<string, string> = { transport: 'Transporte', guide: 'Guia', experience: 'Experiência', accommodation: 'Alojamento', meal: 'Refeição', operational: 'Operacional' };
const priceTypes = { total: 'Total', per_person: 'Por pessoa', per_night: 'Por noite' };
const money = (n: number) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €';

export function costingNotes(item: LeadCostItem): string {
  return (item.notes ?? []).map(note => {
    const date = new Date(note.createdAt);
    const stamp = Number.isNaN(date.getTime()) ? note.createdAt : date.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
    return [stamp, note.text, note.imageUrl ? `Anexo: ${note.imageUrl}` : ''].filter(Boolean).join('\n');
  }).join('\n\n');
}

export function costingExportTotals(input: CostingExportInput) {
  const items = input.days.flatMap(d => d.items);
  const base = items.filter(i => i.status !== 'opcionais' && i.status !== 'eliminar');
  const net = base.reduce((s, i) => s + i.netTotal, 0);
  const computed = base.reduce((s, i) => s + i.pvpTotal, 0);
  const pvp = input.pvpOverride ?? computed;
  return { net, computed, pvp, profit: pvp - net, markup: net ? (pvp - net) / net * 100 : 0,
    optional: items.filter(i => i.status === 'opcionais').reduce((s, i) => s + i.pvpTotal, 0) };
}

export function costingExportFilename(input: CostingExportInput, extension: string) {
  return `${[input.leadCode || 'Custos', input.clientName, `V${input.version}`, 'Custos-internos'].filter(Boolean).join(' - ').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 180)}.${extension}`;
}

/** No printing dialog; keep the object URL alive while the browser receives it. */
export function saveCostingBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function buildCostingPdf(input: CostingExportInput): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', compress: true });
  const totals = costingExportTotals(input);
  const navy: [number, number, number] = [10, 37, 64];
  // Colors belong to the document palette, not to the application UI.
  const text: [number, number, number] = [40, 48, 57];
  autoTable(doc, {
    startY: 21, margin: { left: 12, right: 12, top: 20, bottom: 15 }, theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2, overflow: 'linebreak', textColor: text },
    columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold' } },
    body: [['Referência', `${input.leadCode || '—'} · V${input.version}`], ['Cliente / programa', input.clientName || '—'],
      ['Destino', input.destination || '—'], ['Datas / passageiros', `${input.startDate || '—'} a ${input.endDate || '—'} · ${input.pax} adultos + ${input.paxChildren} crianças`]],
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  for (const day of input.days) {
    const main = day.items.filter(i => i.status !== 'opcionais');
    const optional = day.items.filter(i => i.status === 'opcionais');
    for (const [section, items] of [['Programa', main], ['Opcionais — fora do preço base', optional]] as const) {
      if (!items.length) continue;
      const heading = `${day.day === 0 ? 'Alojamentos' : `Dia ${day.day}`} · ${day.title || 'Sem título'}${day.date && day.date !== 'hidden' ? ` · ${day.date}` : ''}${section !== 'Programa' ? ` · ${section}` : ''}`;
      autoTable(doc, {
        startY: y, margin: { left: 12, right: 12, top: 20, bottom: 15 }, theme: 'grid',
        head: [[{ content: heading, colSpan: 8, styles: { fontSize: 10, cellPadding: 3 } }],
          ['Atividade / serviço', 'Fornecedor', 'Base / quantidades', 'NET €', 'Markup %', 'PVP €', 'Lucro €', 'Notas & anexos']],
        body: items.map(i => [
          [i.description, layers[i.costLayer || ''], `${statuses[i.status]}${i.netPending ? ' · NET pendente' : ''}`, i.startTime || i.endTime ? `${i.startTime || '—'} – ${i.endTime || '—'}` : ''].filter(Boolean).join('\n'),
          i.supplier || '—', `${priceTypes[i.pricingType]}\nAdt/noites: ${i.numAdults} × ${money(i.priceAdults)}\nCri: ${i.numChildren} × ${money(i.priceChildren)}`,
          money(i.netTotal), i.marginPercent.toFixed(2), money(i.pvpTotal), money(i.profit), costingNotes(i) || '—',
        ]),
        styles: { fontSize: 8.5, cellPadding: 2.3, overflow: 'linebreak', valign: 'top', textColor: text, lineColor: [222, 228, 234], lineWidth: 0.15 },
        headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 250] },
        columnStyles: { 0: { cellWidth: 53 }, 1: { cellWidth: 31 }, 2: { cellWidth: 36 }, 3: { cellWidth: 22, halign: 'right' }, 4: { cellWidth: 18, halign: 'right' }, 5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 22, halign: 'right' }, 7: { cellWidth: 69 } },
        showHead: 'everyPage', rowPageBreak: 'avoid',
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    }
  }
  autoTable(doc, {
    startY: y, margin: { left: 12, right: 12, top: 20, bottom: 15 }, theme: 'striped',
    head: [['Resumo financeiro interno', 'Valor']],
    body: [['Total NET (sem opcionais/excluídos)', money(totals.net)], ['PVP calculado', money(totals.computed)],
      ['TOTAL PVP', money(totals.pvp)], ['Lucro (PVP - NET)', money(totals.profit)], ['Markup médio sobre NET', `${totals.markup.toFixed(2)}%`], ['Opcionais (fora do preço base)', money(totals.optional)]],
    pageBreak: 'avoid',
    styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: navy }, columnStyles: { 1: { halign: 'right' } },
  });
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy);
    doc.text('YOUR TOURS · CUSTOS INTERNOS', 12, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`${input.leadCode || 'Custos'} · V${input.version} · Confidencial`, 12, 202);
    doc.text(`${page} / ${pageCount}`, 285, 202, { align: 'right' });
  }
  return doc.output('blob');
}

export async function buildCostingExcel(input: CostingExportInput): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Your Tours Portugal';
  const sheet = wb.addWorksheet('Custos', { views: [{ state: 'frozen', ySplit: 5 }], pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.addRow([`${input.leadCode || 'Custos'} · V${input.version} · Custos internos`]);
  sheet.addRow([input.clientName || '', input.destination || '']);
  sheet.addRow([`${input.startDate || '—'} a ${input.endDate || '—'} · ${input.pax} adultos + ${input.paxChildren} crianças`]);
  sheet.addRow([]);
  sheet.addRow(['Dia / secção', 'Título', 'Data', 'Camada', 'Atividade', 'Fornecedor', 'Base', 'Adt / noites', 'Preço adt €', 'Crianças', 'Preço cri €', 'NET €', 'Markup %', 'PVP €', 'Lucro €', 'Estado', 'Horário', 'Notas & anexos']);
  sheet.columns.forEach((col, idx) => { col.width = [18, 32, 14, 18, 55, 30, 16, 14, 17, 12, 17, 17, 14, 17, 17, 18, 18, 75][idx]; });
  for (const day of input.days) for (const item of day.items) {
    const notes = costingNotes(item);
    // Bounded continuation rows avoid Excel's 409-point row-height limit.
    const chunks = (value: string) => {
      const lines = value.split('\n').flatMap(line => line.match(/[\s\S]{1,48}/g) || ['']);
      return Array.from({ length: Math.max(1, Math.ceil(lines.length / 18)) }, (_, i) => lines.slice(i * 18, (i + 1) * 18).join('\n'));
    };
    const descriptions = chunks(item.description);
    const noteChunks = chunks(notes);
    const row = sheet.addRow([day.day === 0 ? 'Alojamentos' : `Dia ${day.day}`, day.title, day.date === 'hidden' ? '' : day.date || '', layers[item.costLayer || ''] || '', descriptions[0], item.supplier, priceTypes[item.pricingType], item.numAdults, item.priceAdults, item.numChildren, item.priceChildren, item.netTotal, item.marginPercent / 100, item.pvpTotal, item.profit, statuses[item.status], [item.startTime, item.endTime].filter(Boolean).join(' – '), noteChunks[0]]);
    row.height = Math.max(32, Math.min(400, Math.max(descriptions[0].length / 50, noteChunks[0].length / 65, noteChunks[0].split('\n').length) * 15 + 10));
    for (let part = 1; part < Math.max(descriptions.length, noteChunks.length); part++) {
      const extra = sheet.addRow(['Continuação', '', '', '', descriptions[part] || '', '', '', '', '', '', '', '', '', '', '', '', '', noteChunks[part] || '']);
      extra.height = Math.max(32, Math.max((descriptions[part] || '').split('\n').length, (noteChunks[part] || '').split('\n').length) * 15 + 10);
    }
  }
  sheet.autoFilter = { from: 'A5', to: `R${Math.max(5, sheet.rowCount)}` };
  const totals = costingExportTotals(input);
  const summary = wb.addWorksheet('Resumo');
  summary.columns = [{ width: 46 }, { width: 24 }];
  [['Resumo financeiro interno', 'Valor'], ['Total NET', totals.net], ['PVP calculado', totals.computed], ['TOTAL PVP', totals.pvp], ['Lucro', totals.profit], ['Markup médio sobre NET', totals.markup / 100], ['Opcionais — fora do preço base', totals.optional]].forEach(row => summary.addRow(row));
  const last = Math.max(6, sheet.rowCount);
  const baseSum = (col: string) => `SUMIFS(Custos!${col}6:${col}${last},Custos!P6:P${last},"<>Opcional",Custos!P6:P${last},"<>Excluído")`;
  summary.getCell('B2').value = { formula: baseSum('L'), result: totals.net };
  summary.getCell('B3').value = { formula: baseSum('N'), result: totals.computed };
  summary.getCell('B4').value = input.pvpOverride ?? { formula: 'B3', result: totals.pvp };
  summary.getCell('B5').value = { formula: 'B4-B2', result: totals.profit };
  summary.getCell('B6').value = { formula: 'IFERROR(B5/B2,0)', result: totals.markup / 100 };
  summary.getCell('B7').value = { formula: `SUMIF(Custos!P6:P${last},"Opcional",Custos!N6:N${last})`, result: totals.optional };
  for (const ws of [sheet, summary]) ws.eachRow((row, index) => {
    row.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, color: { argb: 'FF0A2540' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      if (index === (ws === sheet ? 5 : 1)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } };
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (index > 5 && index % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5F8' } };
      if (typeof cell.value === 'number') cell.numFmt = '#,##0.00;(#,##0.00);"—"';
    });
  });
  sheet.getColumn(13).numFmt = '0.0%;(0.0%);"—"';
  summary.getCell('B6').numFmt = '0.0%;(0.0%);"—"';
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}