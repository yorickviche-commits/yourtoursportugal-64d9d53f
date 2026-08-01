const LOCALES: Record<string, string> = {
  en: 'en-GB', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', it: 'it-IT', de: 'de-DE',
};

export const sanitizeFilenamePart = (value?: string | null) => (value || '')
  .replace(/[\\/:*?"<>|]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const normalizeYtId = (value?: string | null) => {
  const clean = sanitizeFilenamePart(value);
  const compact = clean.match(/\bYT\s*-?\s*(\d{4,})\b/i);
  return compact ? `YT${compact[1]}` : clean;
};

export const cleanProgramTitle = (title?: string | null, ytId?: string | null) => {
  let clean = sanitizeFilenamePart(title);
  const normalizedId = normalizeYtId(ytId);
  const digits = normalizedId.match(/\d{4,}/)?.[0];
  if (digits) {
    clean = clean
      .replace(new RegExp(`^\\s*YT\\s*-?\\s*${digits}\\s*[-–—:]?\\s*`, 'i'), '')
      .replace(new RegExp(`\\s*[-–—:]?\\s*YT\\s*-?\\s*${digits}\\s*$`, 'i'), '')
      .trim();
  }
  return clean;
};

export const formatProposalDate = (value?: string | null, language = 'en') => {
  if (!value) return '';
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return sanitizeFilenamePart(value);
  const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  return new Intl.DateTimeFormat(LOCALES[language.toLowerCase()] || LOCALES.en, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date);
};

interface ProposalFilenameInput {
  ytId?: string | null;
  clientName?: string | null;
  programName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dateRange?: string | null;
  language?: string | null;
}

export const buildProposalFilename = ({
  ytId, clientName, programName, startDate, endDate, dateRange, language = 'en',
}: ProposalFilenameInput) => {
  const id = normalizeYtId(ytId) || 'YT';
  const program = cleanProgramTitle(programName, id) || 'Travel Plan';
  const start = formatProposalDate(startDate, language || 'en');
  const end = formatProposalDate(endDate, language || 'en');
  const dates = start || end
    ? (start && end && start !== end ? `${start} - ${end}` : start || end)
    : sanitizeFilenamePart(dateRange);
  const base = [id, sanitizeFilenamePart(clientName) || 'Client', program, dates]
    .filter(Boolean)
    .join(' - ')
    .slice(0, 180)
    .trim();
  return `${base}.pdf`;
};

export const downloadBase64Pdf = (base64: string, filename: string) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};