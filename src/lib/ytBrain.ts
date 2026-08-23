/**
 * YT Brain — central knowledge base configuration.
 * The menu label lives here (single source of truth). Nothing about the
 * folder/category taxonomy is hardcoded: it all comes from the database.
 */
export const BRAIN_LABEL = 'YT Brain';
export const BRAIN_ROUTE = '/yt-brain';
export const BRAIN_BUCKET = 'yt-brain-docs';

export type YtbDocType = 'text' | 'pdf' | 'file' | 'link';
export type YtbStatus = 'draft' | 'active' | 'obsolete';
export type YtbConfidentiality = 'internal' | 'confidential' | 'client';

export const DOC_TYPE_LABELS: Record<YtbDocType, string> = {
  text: 'Texto',
  pdf: 'PDF',
  file: 'Ficheiro',
  link: 'Link',
};

export const STATUS_LABELS: Record<YtbStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  obsolete: 'Obsoleto',
};

export const CONF_LABELS: Record<YtbConfidentiality, string> = {
  internal: 'Interno',
  confidential: 'Confidencial',
  client: 'Cliente',
};

export const CONF_BADGE_CLASS: Record<YtbConfidentiality, string> = {
  internal: 'bg-muted text-muted-foreground',
  confidential: 'bg-destructive/15 text-destructive',
  client: 'bg-emerald-500/15 text-emerald-600',
};

export const CONF_HELP =
  'Confidencial = preços net e fornecedores — nunca visível a leitores nem usado em comunicação com clientes.';

/** Named colours used by categories (chips). */
export const CATEGORY_COLORS: { value: string; label: string; className: string }[] = [
  { value: 'blue', label: 'Azul', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  { value: 'green', label: 'Verde', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  { value: 'purple', label: 'Roxo', className: 'bg-violet-500/15 text-violet-600 border-violet-500/30' },
  { value: 'orange', label: 'Laranja', className: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  { value: 'gray', label: 'Cinza', className: 'bg-muted text-muted-foreground border-border' },
  { value: 'teal', label: 'Teal', className: 'bg-teal-500/15 text-teal-600 border-teal-500/30' },
  { value: 'yellow', label: 'Amarelo', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  { value: 'pink', label: 'Rosa', className: 'bg-pink-500/15 text-pink-600 border-pink-500/30' },
  { value: 'red', label: 'Vermelho', className: 'bg-red-500/15 text-red-600 border-red-500/30' },
  { value: 'indigo', label: 'Índigo', className: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30' },
];

export const categoryColorClass = (color?: string | null) =>
  CATEGORY_COLORS.find(c => c.value === color)?.className ?? CATEGORY_COLORS[4].className;
