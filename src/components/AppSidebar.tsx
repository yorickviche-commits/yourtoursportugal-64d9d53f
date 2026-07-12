import { NavLink, useLocation } from 'react-router-dom';
import {
  Map, Users, CreditCard, Sparkles, LayoutDashboard,
  FileText, Handshake, Grid3x3, Truck, Settings, Shield, BarChart3, Plug, ScrollText,
  Inbox,
  LogOut, ChevronDown, ChevronRight, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUnreadNotificationCount } from '@/hooks/useAgentNotifications';
import { useAgentPendingActions } from '@/hooks/useAgentPendingActions';
import { usePagePermissions } from '@/hooks/usePagePermissions';
import { PageKey } from '@/lib/pagePermissions';
import BrandLogo from './BrandLogo';

interface NavItem { to: string; icon: any; label: string; pageKey: PageKey; }

const overviewItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', pageKey: 'dashboard' },
];

const reservasItems: NavItem[] = [
  { to: '/leads', icon: Users, label: 'Leads & Files', pageKey: 'leads' },
  { to: '/trips', icon: Map, label: 'Bookings & Reservas', pageKey: 'trips' },
  { to: '/proposals', icon: FileText, label: 'Propostas', pageKey: 'proposals' },
  { to: '/payments', icon: CreditCard, label: 'Pagamentos', pageKey: 'payments' },
  { to: '/crm', icon: Inbox, label: 'CRM / Comunicação', pageKey: 'crm' },
];

const comercialItems: NavItem[] = [
  { to: '/comercial/matriz', icon: Grid3x3, label: 'Matriz FSE', pageKey: 'comercial_matriz' },
  { to: '/comercial/suppliers', icon: Truck, label: 'Fornecedores', pageKey: 'comercial_suppliers' },
  { to: '/partners', icon: Handshake, label: 'Parceiros B2B', pageKey: 'partners' },
];

const adminItems: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Utilizadores', pageKey: 'admin_users' },
  { to: '/admin/permissions', icon: Shield, label: 'Permissões', pageKey: 'admin_permissions' },
  { to: '/admin/settings', icon: Settings, label: 'Configurações', pageKey: 'admin_settings' },
  { to: '/admin/integrations', icon: Plug, label: 'Integrações', pageKey: 'admin_integrations' },
  { to: '/admin/kpi', icon: BarChart3, label: 'KPI', pageKey: 'admin_kpi' },
  { to: '/admin/logs', icon: ScrollText, label: 'Logs', pageKey: 'admin_logs' },
];

const DesktopSidebar = () => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { canAccess } = usePagePermissions();
  const [hovered, setHovered] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [reservasOpen, setReservasOpen] = useState(true);
  const [comercialOpen, setComercialOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();
  const { data: actions = [] } = useAgentPendingActions();
  const pendingActions = actions.filter(a => a.status === 'pending').length;
  const totalBadge = unreadCount + pendingActions;
  const expanded = hovered;

  const filter = (items: NavItem[]) => items.filter(i => canAccess(i.pageKey));
  const visibleOverview = filter(overviewItems);
  const visibleReservas = filter(reservasItems);
  const visibleComercial = filter(comercialItems);
  const visibleAdmin = filter(adminItems);
  const showAgents = canAccess('agents');

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : profile?.email?.slice(0, 2).toUpperCase() || '??';

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.to);
    return (
      <NavLink key={item.to} to={item.to} title={item.label}
        className={cn(
          'flex items-center gap-3 rounded-md text-sm transition-colors relative',
          expanded ? 'px-3 py-2' : 'justify-center px-2 py-2',
          active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                 : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {expanded && <span className="truncate text-xs">{item.label}</span>}
      </NavLink>
    );
  };

  const renderGroup = (label: string, items: NavItem[], open: boolean, setOpen: (v: boolean) => void) => (
    <div>
      {expanded ? (
        <button onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] uppercase text-sidebar-muted font-semibold tracking-wider hover:text-sidebar-foreground transition-colors">
          {label}
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      ) : <div className="border-t border-sidebar-border my-2" />}
      {(expanded ? open : true) && <div className="space-y-0.5">{items.map(renderNavItem)}</div>}
    </div>
  );

  const agentActive = isActive('/agents');

  return (
    <aside data-tour="sidebar" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={cn(
        'fixed left-0 top-0 bottom-0 bg-sidebar text-sidebar-foreground flex flex-col z-40 transition-all duration-200 ease-in-out shadow-lg',
        expanded ? 'w-[220px]' : 'w-[56px]'
      )}
    >
      <div className={cn('border-b border-sidebar-border flex items-center', expanded ? 'p-3' : 'p-2 justify-center')}>
        <BrandLogo
          showText={expanded}
          imageClassName={expanded ? 'h-10 w-10' : 'h-9 w-9'}
          className="[&_p:first-child]:text-sidebar-primary [&_p:last-child]:text-sidebar-muted"
        />
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {renderGroup('Visão Geral', overviewItems, overviewOpen, setOverviewOpen)}
        {renderGroup('Dep. Reservas', reservasItems, reservasOpen, setReservasOpen)}
        {renderGroup('Comercial', comercialItems, comercialOpen, setComercialOpen)}
        {renderGroup('Administração', adminItems, adminOpen, setAdminOpen)}

        {expanded
          ? <p className="px-3 py-1.5 text-[10px] uppercase text-sidebar-muted font-semibold tracking-wider mt-2">AI Agents</p>
          : <div className="border-t border-sidebar-border my-2" />
        }

        <NavLink to="/agents" title="Spark Agent Center"
          className={cn(
            'flex items-center gap-3 rounded-md text-sm transition-colors relative',
            expanded ? 'px-3 py-2' : 'justify-center px-2 py-2',
            agentActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <div className="relative shrink-0">
            <Sparkles className="h-4 w-4 text-violet-400" />
            {!expanded && totalBadge > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-violet-500 text-white text-[8px] font-bold flex items-center justify-center">
                {totalBadge > 9 ? '9+' : totalBadge}
              </span>
            )}
          </div>
          {expanded && (
            <>
              <span className="truncate text-xs">Spark · Agents</span>
              {totalBadge > 0 && (
                <span className="ml-auto text-[10px] bg-violet-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                  {totalBadge}
                </span>
              )}
            </>
          )}
        </NavLink>
      </nav>

      <div className={cn('border-t border-sidebar-border', expanded ? 'p-3' : 'p-2')}>
        {expanded ? (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                {profile?.full_name || profile?.email || 'Utilizador'}
              </p>
            </div>
            <button onClick={signOut} title="Sair" className="p-1 hover:bg-sidebar-accent rounded">
              <LogOut className="h-3.5 w-3.5 text-sidebar-muted" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground">
              {initials}
            </div>
            <button onClick={signOut} title="Sair" className="p-1 hover:bg-sidebar-accent rounded">
              <LogOut className="h-3.5 w-3.5 text-sidebar-muted" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

const MobileMenu = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [reservasOpen, setReservasOpen] = useState(true);
  const [comercialOpen, setComercialOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();
  const { data: actions = [] } = useAgentPendingActions();
  const totalBadge = unreadCount + actions.filter(a => a.status === 'pending').length;

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';
  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  if (!open) return null;

  const renderItem = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} onClick={onClose}
      className={cn(
        'flex items-center gap-3 px-4 py-3 text-sm rounded-lg min-h-[48px] transition-colors',
        isActive(item.to) ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );

  const renderGroup = (label: string, items: NavItem[], groupOpen: boolean, setGroupOpen: (v: boolean) => void) => (
    <div>
      <button onClick={() => setGroupOpen(!groupOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-xs uppercase text-muted-foreground font-semibold tracking-wider">
        {label}
        {groupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {groupOpen && <div className="space-y-0.5">{items.map(renderItem)}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <BrandLogo imageClassName="h-10 w-10" />
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
        {renderGroup('Visão Geral', overviewItems, overviewOpen, setOverviewOpen)}
        {renderGroup('Dep. Reservas', reservasItems, reservasOpen, setReservasOpen)}
        {renderGroup('Comercial', comercialItems, comercialOpen, setComercialOpen)}
        {renderGroup('Administração', adminItems, adminOpen, setAdminOpen)}
        <div className="pt-2">
          <p className="px-4 py-2 text-xs uppercase text-muted-foreground font-semibold tracking-wider">AI Agents</p>
          <NavLink to="/agents" onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm rounded-lg min-h-[48px] transition-colors',
              isActive('/agents') ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
            )}
          >
            <Sparkles className="h-5 w-5 shrink-0 text-violet-500" />
            <span>Spark · Agents</span>
            {totalBadge > 0 && (
              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-violet-500 text-white rounded-full">{totalBadge}</span>
            )}
          </NavLink>
        </div>
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email || 'Utilizador'}</p>
          </div>
          <button onClick={() => { signOut(); onClose(); }} className="p-2 hover:bg-muted rounded-lg">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const MobileMenuButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick}
    className="md:hidden fixed top-3 left-3 z-50 p-2 bg-card border border-border rounded-lg shadow-md"
    aria-label="Abrir menu"
  >
    <Menu className="h-5 w-5" />
  </button>
);

const AppSidebar = () => {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (isMobile) {
    return (
      <>
        <MobileMenuButton onClick={() => setMobileOpen(true)} />
        <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </>
    );
  }
  return <DesktopSidebar />;
};

export default AppSidebar;
