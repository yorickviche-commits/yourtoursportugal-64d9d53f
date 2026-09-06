// Labels e cores do Feedback Hub (PT-PT)

export type FeedbackType = 'bug' | 'improvement' | 'suggestion';
export type FeedbackSeverity = 'blocker' | 'high' | 'medium' | 'low';
export type FeedbackStatus =
  | 'new' | 'triaged' | 'in_progress' | 'in_review' | 'done' | 'wont_fix' | 'duplicate';
export type FeedbackPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type FeedbackEffort = 'xs' | 's' | 'm' | 'l' | 'xl';

export const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  improvement: 'Melhoria',
  suggestion: 'Sugestão',
};

export const TYPE_DESCRIPTIONS: Record<FeedbackType, string> = {
  bug: 'Algo não funciona como devia',
  improvement: 'Funciona, mas podia ser melhor',
  suggestion: 'Uma ideia nova para a plataforma',
};

export const TYPE_CLASSES: Record<FeedbackType, string> = {
  bug: 'bg-red-50 text-red-700 border-red-200',
  improvement: 'bg-amber-50 text-amber-700 border-amber-200',
  suggestion: 'bg-sky-50 text-sky-700 border-sky-200',
};

export const SEVERITY_LABELS: Record<FeedbackSeverity, string> = {
  blocker: 'Bloqueia o trabalho',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const SEVERITY_DOT: Record<FeedbackSeverity, string> = {
  blocker: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
};

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Novo',
  triaged: 'Triado',
  in_progress: 'Em curso',
  in_review: 'Em revisão',
  done: 'Concluído',
  wont_fix: 'Não fazer',
  duplicate: 'Duplicado',
};

export const STATUS_CLASSES: Record<FeedbackStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  triaged: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  in_review: 'bg-violet-50 text-violet-700 border-violet-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  wont_fix: 'bg-slate-100 text-slate-600 border-slate-200',
  duplicate: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const OPEN_STATUSES: FeedbackStatus[] = ['new', 'triaged', 'in_progress', 'in_review'];
export const CLOSED_STATUSES: FeedbackStatus[] = ['done', 'wont_fix', 'duplicate'];

export const BOARD_COLUMNS: FeedbackStatus[] = [
  'new', 'triaged', 'in_progress', 'in_review', 'done', 'wont_fix', 'duplicate',
];

export const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  p0: 'P0', p1: 'P1', p2: 'P2', p3: 'P3',
};

export const PRIORITY_CLASSES: Record<FeedbackPriority, string> = {
  p0: 'bg-red-600 text-white',
  p1: 'bg-orange-500 text-white',
  p2: 'bg-amber-400 text-slate-900',
  p3: 'bg-slate-300 text-slate-800',
};

export const EFFORT_OPTIONS: FeedbackEffort[] = ['xs', 's', 'm', 'l', 'xl'];

export const DESCRIPTION_PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: 'O que estavas a fazer?\nO que esperavas que acontecesse?\nO que aconteceu?\nComo repetir?',
  improvement: 'O que está a custar tempo ou a causar erros hoje? Como imaginas que devia funcionar?',
  suggestion: 'Que problema resolve? Quem beneficia (vendas, operações, admin)?',
};

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const FEEDBACK_BUCKET = 'feedback-media';
export const DRAFT_STORAGE_KEY = 'tcc.feedback.draft';
