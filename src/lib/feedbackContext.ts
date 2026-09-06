// Captura automática do contexto técnico + deteção de módulo pela rota.

export type FeedbackModule =
  | 'dashboard' | 'leads' | 'travel_plan' | 'costing' | 'operations' | 'proposals'
  | 'payments' | 'crm' | 'commercial' | 'agents' | 'admin' | 'auth' | 'mobile' | 'other';

export const FEEDBACK_MODULES: { value: FeedbackModule; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'leads', label: 'Leads & Files' },
  { value: 'travel_plan', label: 'Travel Plan / Itinerário' },
  { value: 'costing', label: 'Costing' },
  { value: 'operations', label: 'Operações (FSE)' },
  { value: 'proposals', label: 'Propostas / PDF' },
  { value: 'payments', label: 'Pagamentos / WeTravel' },
  { value: 'crm', label: 'CRM / NetHunt / Comunicação' },
  { value: 'commercial', label: 'Comercial (Matriz FSE, Fornecedores, Catálogo, Mapas, Parceiros)' },
  { value: 'agents', label: 'Spark · Agents / YT Brain / Copilot' },
  { value: 'admin', label: 'Administração' },
  { value: 'auth', label: 'Login / Conta / Permissões' },
  { value: 'mobile', label: 'Versão mobile' },
  { value: 'other', label: 'Outro' },
];

export const moduleLabel = (value: string): string =>
  FEEDBACK_MODULES.find(m => m.value === value)?.label ?? value;

export function resolveModule(pathname: string): FeedbackModule {
  const p = pathname.toLowerCase();
  if (p.startsWith('/dashboard')) return 'dashboard';
  if (p.startsWith('/ops') || p.startsWith('/trips')) return 'operations';
  if (p.startsWith('/leads') || p.startsWith('/bookings')) return 'leads';
  if (p.startsWith('/proposal')) return 'proposals';
  if (p.startsWith('/payments')) return 'payments';
  if (p.startsWith('/crm')) return 'crm';
  if (p.startsWith('/comercial') || p.startsWith('/catalog') || p.startsWith('/products')
      || p.startsWith('/mapas') || p.startsWith('/partners')) return 'commercial';
  if (p.startsWith('/agents') || p.startsWith('/ai-office') || p.startsWith('/yt-brain')) return 'agents';
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/login') || p.startsWith('/profile') || p.startsWith('/setup-account')) return 'auth';
  if (p.startsWith('/mobile')) return 'mobile';
  return 'other';
}

export function parseBrowserOS(ua: string): { browser: string; os: string } {
  let browser = 'Desconhecido';
  const edge = ua.match(/Edg\/(\d+)/);
  const chrome = ua.match(/Chrome\/(\d+)/);
  const firefox = ua.match(/Firefox\/(\d+)/);
  const safari = ua.match(/Version\/(\d+).+Safari/);
  if (edge) browser = `Edge ${edge[1]}`;
  else if (firefox) browser = `Firefox ${firefox[1]}`;
  else if (safari) browser = `Safari ${safari[1]}`;
  else if (chrome) browser = `Chrome ${chrome[1]}`;

  let os = 'Desconhecido';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, os };
}

declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export interface CapturedContext {
  page_url: string;
  page_route: string;
  page_title: string;
  user_agent: string;
  browser: string;
  os: string;
  screen: string;
  viewport: string;
  app_version: string;
  locale: string;
  timezone: string;
  lead_ref: string | null;
}

const LEAD_REF_RE = /YT[-\s]?\d{4}(?:-\d{3,4})?/i;

export function extractLeadRef(...sources: (string | null | undefined)[]): string | null {
  for (const s of sources) {
    if (!s) continue;
    const m = s.match(LEAD_REF_RE);
    if (m) return m[0].toUpperCase().replace(/\s/g, '');
  }
  return null;
}

export function captureContext(leadRefHint?: string | null): CapturedContext {
  const ua = navigator.userAgent;
  const { browser, os } = parseBrowserOS(ua);
  return {
    page_url: window.location.href,
    page_route: window.location.pathname,
    page_title: document.title,
    user_agent: ua,
    browser,
    os,
    screen: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    app_version: APP_VERSION,
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lead_ref: extractLeadRef(leadRefHint, document.title),
  };
}
