import type { FieldFormat } from '@/types/reports';

// pt-PT com separador de milhares em ponto e decimal em vírgula (€ 1.705,00).
const nf = (min: number, max: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: true });

const int = nf(0, 0);
const dec2 = nf(2, 2);
const dec1 = nf(1, 1);

export const NO_VALUE = '— sem valor —';

export function formatValue(value: unknown, format: FieldFormat): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (format) {
    case 'eur': {
      const n = Number(value);
      if (!isFinite(n)) return '—';
      return `${dec2.format(n)}€`;
    }
    case 'pct': {
      const n = Number(value);
      if (!isFinite(n)) return '—';
      return `${dec1.format(n)} %`;
    }
    case 'int': {
      const n = Number(value);
      if (!isFinite(n)) return '—';
      return int.format(n);
    }
    case 'days': {
      const n = Number(value);
      if (!isFinite(n)) return '—';
      return `${dec1.format(n).replace(',0', '')} d`;
    }
    case 'date': {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('pt-PT');
    }
    case 'datetime': {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleString('pt-PT');
    }
    case 'bool':
      return value === true || value === 'true' ? 'Sim' : 'Não';
    default:
      return String(value);
  }
}

/** Valor cru para CSV (números sem símbolos, datas ISO). */
export function rawValue(value: unknown, format: FieldFormat): string {
  if (value === null || value === undefined) return '';
  if (format === 'eur' || format === 'pct' || format === 'int' || format === 'days') {
    const n = Number(value);
    return isFinite(n) ? String(n) : '';
  }
  return String(value);
}

export function formatGroupKey(value: string | null, bucket?: string | null): string {
  if (value === null || value === undefined || value === '') return NO_VALUE;
  if (bucket) return formatBucketKey(value, bucket);
  return value;
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DOW_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Etiqueta pt-PT de uma chave de agrupamento por data. A chave crua mantém-se para CSV/drill-down. */
export function formatBucketKey(value: string, bucket: string): string {
  const v = String(value);
  if (bucket === 'dow') {
    const n = Number(v);
    if (isFinite(n) && n >= 0 && n <= 6) return DOW_PT[n];
    return v;
  }
  if (bucket === 'year') return v.slice(0, 4);
  const dm = v.match(/^(\d{4})-(\d{2})/);
  if (bucket === 'month' && dm) return `${MONTHS_PT[Number(dm[2]) - 1]} ${dm[1]}`;
  if (bucket === 'quarter') {
    const q = v.match(/^(\d{4})-?Q?(\d)/i);
    if (q) return `T${q[2]} ${q[1]}`;
    if (dm) return `T${Math.floor((Number(dm[2]) - 1) / 3) + 1} ${dm[1]}`;
  }
  if ((bucket === 'day' || bucket === 'week') && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return formatIsoDate(v);
  }
  return v;
}

/** ISO (yyyy-mm-dd) → dd/mm/yyyy */
export function formatIsoDate(value?: string | null): string {
  if (!value) return '—';
  const m = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(value);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatDelta(current: unknown, prior: unknown): { text: string; tone: 'up' | 'down' | 'flat' } {
  const c = Number(current ?? 0);
  const p = Number(prior ?? 0);
  if (!isFinite(c) || !isFinite(p) || p === 0) return { text: '—', tone: 'flat' };
  const d = ((c - p) / Math.abs(p)) * 100;
  const tone = d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat';
  return { text: `${d > 0 ? '+' : ''}${dec1.format(d)} %`, tone };
}

export function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const body = [header, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
