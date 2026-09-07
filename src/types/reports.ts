// Contrato de definição de relatórios (input de run_report e conteúdo de saved_reports.definition)

export type ReportType = 'files';

export type DatePreset =
  | 'today' | 'yesterday'
  | 'this_week' | 'this_week_to_date' | 'last_week'
  | 'this_month' | 'this_month_to_date' | 'last_month'
  | 'this_quarter' | 'last_quarter'
  | 'this_year' | 'this_year_to_date' | 'last_year' | 'last_year_to_date'
  | 'next_30_days' | 'next_90_days' | 'next_month'
  | 'all' | 'custom';

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  this_week: 'Esta semana',
  this_week_to_date: 'Esta semana até hoje',
  last_week: 'Semana passada',
  this_month: 'Este mês',
  this_month_to_date: 'Este mês até hoje',
  last_month: 'Mês passado',
  this_quarter: 'Este trimestre',
  last_quarter: 'Trimestre passado',
  this_year: 'Este ano',
  this_year_to_date: 'Este ano até hoje',
  last_year: 'Ano passado',
  last_year_to_date: 'Ano passado até hoje',
  next_30_days: 'Próximos 30 dias',
  next_90_days: 'Próximos 90 dias',
  next_month: 'Próximo mês',
  all: 'Tudo',
  custom: 'Personalizado',
};

export const DATE_PRESET_ORDER: DatePreset[] = [
  'today', 'yesterday', 'this_week', 'this_week_to_date', 'last_week',
  'this_month', 'this_month_to_date', 'last_month',
  'this_quarter', 'last_quarter',
  'this_year', 'this_year_to_date', 'last_year', 'last_year_to_date',
  'next_30_days', 'next_90_days', 'next_month', 'all', 'custom',
];

export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'dow';

export const BUCKET_LABELS: Record<DateBucket, string> = {
  day: 'Dia', week: 'Semana', month: 'Mês', quarter: 'Trimestre', year: 'Ano', dow: 'Dia da semana',
};

export type FilterOp =
  | 'in' | 'not_in' | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'is_null' | 'not_null' | 'contains';

export const FILTER_OP_LABELS: Record<FilterOp, string> = {
  in: 'é um de',
  not_in: 'não é um de',
  eq: '=',
  neq: '≠',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  is_null: 'está vazio',
  not_null: 'não está vazio',
  contains: 'contém',
};

export interface ReportFilter {
  field: string;
  op: FilterOp;
  values?: (string | number | boolean)[];
}

export interface ReportGroupBy {
  field: string;
  bucket?: DateBucket;
}

export interface ReportSort {
  field: string;
  dir: 'asc' | 'desc';
}

export type ReportMode = 'summary' | 'detail';

export interface ReportDefinition {
  report_type: ReportType;
  date: {
    axis: string;
    preset: DatePreset;
    from?: string | null;
    to?: string | null;
    compare?: 'prior_year' | null;
  };
  scope?: { client_type?: string[] };
  filters: ReportFilter[];
  group_by: ReportGroupBy[];
  mode: ReportMode;
  columns: { summary: string[]; detail: string[] };
  sort?: ReportSort[];
  page?: number;
  page_size?: number;
}

export type FieldFormat = 'text' | 'int' | 'eur' | 'pct' | 'date' | 'datetime' | 'bool' | 'days';
export type FieldKind = 'dimension' | 'metric' | 'date_axis';

export type OptionsSource =
  | { type: 'enum'; values: string[] }
  | { type: 'table'; table: string; value: string; label: string; order?: string }
  | { type: 'distinct' }
  | { type: 'free' }
  | null;

export interface ReportField {
  key: string;
  label_pt: string;
  label_en: string | null;
  field_group: string;
  kind: FieldKind;
  data_type: string;
  format: FieldFormat;
  filterable: boolean;
  groupable: boolean;
  sortable: boolean;
  summary_default: boolean;
  detail_default: boolean;
  is_financial: boolean;
  options_source: OptionsSource;
  sort_order: number;
}

export interface ReportColumnMeta {
  key: string;
  label: string;
  label_en?: string | null;
  format: FieldFormat;
  kind: FieldKind;
  group: string;
}

export interface ReportGroupKeyMeta {
  key: string;
  label: string;
  label_en?: string | null;
  bucket?: DateBucket | null;
}

export interface ReportPeriod {
  axis: string;
  preset: DatePreset;
  from: string | null;
  to: string | null;
  compare?: string | null;
}

export interface SummaryRow {
  level: number;
  keys: (string | null)[];
  values: Record<string, number | string | null>;
}

export interface SummaryResult {
  mode: 'summary';
  period: ReportPeriod;
  group_keys: ReportGroupKeyMeta[];
  columns: ReportColumnMeta[];
  rows: SummaryRow[];
  total: Record<string, number | string | null>;
  prior_rows?: SummaryRow[] | null;
  prior_total?: Record<string, number | string | null> | null;
  row_count: number;
  truncated?: boolean;
  hidden_financial?: boolean;
  generated_at: string;
}

export interface DetailResult {
  mode: 'detail';
  period: ReportPeriod;
  columns: ReportColumnMeta[];
  rows: Record<string, any>[];
  row_count: number;
  page: number;
  page_size: number;
  hidden_financial?: boolean;
  generated_at: string;
}

export type RunReportResult = SummaryResult | DetailResult;

export type SavedReportCategory = 'Performance' | 'Operações' | 'Clientes & Marketing' | 'Contabilidade';

export const SAVED_REPORT_CATEGORIES: SavedReportCategory[] = [
  'Performance', 'Operações', 'Clientes & Marketing', 'Contabilidade',
];

export interface SavedReport {
  id: string;
  report_type: string;
  name: string;
  note: string | null;
  category: SavedReportCategory;
  definition: ReportDefinition;
  owner_id: string | null;
  visibility: 'private' | 'team';
  is_suggested: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export const emptyDefinition = (): ReportDefinition => ({
  report_type: 'files',
  date: { axis: 'trip_start', preset: 'this_month', from: null, to: null, compare: null },
  scope: {},
  filters: [],
  group_by: [],
  mode: 'summary',
  columns: { summary: [], detail: [] },
  sort: [],
  page: 1,
  page_size: 100,
});
