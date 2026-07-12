// Central registry of pages/menus that can be permissioned per role.
// Keys are stored in the `permissions` table as `page:<slug>`.

export type PageKey =
  | 'dashboard'
  | 'leads'
  | 'trips'
  | 'proposals'
  | 'payments'
  | 'crm'
  | 'comercial_matriz'
  | 'comercial_suppliers'
  | 'partners'
  | 'profile'
  | 'admin_users'
  | 'admin_permissions'
  | 'admin_settings'
  | 'admin_integrations'
  | 'admin_kpi'
  | 'admin_logs'
  | 'agents';


export interface PageDef {
  key: PageKey;
  label: string;
  path: string;      // top-level route prefix
  group: 'Visão Geral' | 'Dep. Reservas' | 'Comercial' | 'Administração' | 'AI Agents';
}

export const PAGES: PageDef[] = [
  { key: 'dashboard',           label: 'Dashboard',            path: '/dashboard',            group: 'Visão Geral' },
  { key: 'leads',               label: 'Leads & Files',        path: '/leads',                group: 'Dep. Reservas' },
  { key: 'trips',               label: 'Bookings & Reservas',  path: '/trips',                group: 'Dep. Reservas' },
  { key: 'proposals',           label: 'Propostas',            path: '/proposals',            group: 'Dep. Reservas' },
  { key: 'payments',            label: 'Pagamentos',           path: '/payments',             group: 'Dep. Reservas' },
  { key: 'crm',                 label: 'CRM / Comunicação',    path: '/crm',                  group: 'Dep. Reservas' },
  { key: 'comercial_matriz',    label: 'Matriz FSE',           path: '/comercial/matriz',     group: 'Comercial' },
  { key: 'comercial_suppliers', label: 'Fornecedores',         path: '/comercial/suppliers',  group: 'Comercial' },
  { key: 'partners',            label: 'Parceiros B2B',        path: '/partners',             group: 'Comercial' },
  { key: 'admin_users',         label: 'Utilizadores',         path: '/admin/users',          group: 'Administração' },
  { key: 'admin_permissions',   label: 'Permissões',           path: '/admin/permissions',    group: 'Administração' },
  { key: 'admin_settings',      label: 'Configurações',        path: '/admin/settings',       group: 'Administração' },
  { key: 'admin_integrations',  label: 'Integrações',          path: '/admin/integrations',   group: 'Administração' },
  { key: 'admin_kpi',           label: 'KPI',                  path: '/admin/kpi',            group: 'Administração' },
  { key: 'admin_logs',          label: 'Logs',                 path: '/admin/logs',           group: 'Administração' },
  { key: 'agents',              label: 'Spark · Agents',       path: '/agents',               group: 'AI Agents' },
];

export const permKey = (key: PageKey) => `page:${key}`;

// Given the current pathname, resolve which PageKey it belongs to (longest-match prefix).
export function resolvePageKey(pathname: string): PageKey | null {
  const match = [...PAGES]
    .sort((a, b) => b.path.length - a.path.length)
    .find(p => pathname === p.path || pathname.startsWith(p.path + '/'));
  return match ? match.key : null;
}
