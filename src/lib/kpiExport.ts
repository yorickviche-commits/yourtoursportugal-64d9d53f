import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function exportPDF(title: string, headers: string[], rows: (string | number)[][], filename: string) {
  const doc = new jsPDF({ orientation: rows[0]?.length && rows[0].length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString('pt-PT'), 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows.map(r => r.map(c => (c == null ? '' : String(c)))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [10, 37, 64] },
  });
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function exportExcel(sheetName: string, headers: string[], rows: (string | number)[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30) || 'Sheet1');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
