/**
 * Formatação monetária única da plataforma: 1.230,00€
 * Sempre com duas casas decimais e separador de milhares em ponto.
 */
const nf2 = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

/** 1234.5 → "1.234,50€" */
export const eur = (n: unknown): string => {
  const v = Number(n);
  return `${nf2.format(isFinite(v) ? v : 0)}€`;
};

/** 1234.5 → "1.234,50" (sem símbolo) */
export const num2 = (n: unknown): string => {
  const v = Number(n);
  return nf2.format(isFinite(v) ? v : 0);
};

/** Moeda arbitrária: 1234.5, "USD" → "1.234,50 USD" */
export const money = (n: unknown, currency = 'EUR'): string =>
  currency === 'EUR' ? eur(n) : `${num2(n)} ${currency}`;
