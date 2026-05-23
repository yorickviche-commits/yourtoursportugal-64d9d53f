import { NavLink, useLocation } from 'react-router-dom';
import {
  Map, Sun, Users, CreditCard,
  LogOut, ChevronDown, ChevronRight,
  Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  to: string;
  icon: any;
  label: string;
}

const reservasItems: NavItem[] = [
  { to: '/leads', icon: Users, label: 'Leads & Files' },
  { to: '/trips', icon: Map, label: 'Bookings & Reservas' },
  { to: '/payments', icon: CreditCard, label: 'Pagamentos' },
];

// ─── Desktop Sidebar (hover-expand) ───
const DesktopSidebar = () => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [reservasOpen, setReservasOpen] = useState(true);

  const expanded = hovered;

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : profile?.email?.slice(0, 2).toUpperCase() || '??';

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={item.label}
        className={cn(
          "flex items-center gap-3 rounded-md text-sm transition-colors relative",
          expanded ? "px-3 py-2" : "justify-center px-2 py-2",
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        <div className="relative shrink-0">
          <item.icon className="h-4 w-4" />
        </div>
        {expanded && (
          <span className="truncate text-xs">{item.label}</span>
        )}
      </NavLink>
    );
  };

  const renderGroup = (label: string, items: NavItem[], open: boolean, setOpen: (v: boolean) => void) => (
    <div>
      {expanded ? (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] uppercase text-sidebar-muted font-semibold tracking-wider hover:text-sidebar-foreground transition-colors"
        >
          {label}
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      ) : (
        <div className="border-t border-sidebar-border my-2" />
      )}
      {(expanded ? open : true) && (
        <div className="space-y-0.5">
          {items.map(renderNavItem)}
        </div>
      )}
    </div>
  );

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed left-0 top-0 bottom-0 bg-sidebar text-sidebar-foreground flex flex-col z-40 transition-all duration-200 ease-in-out shadow-lg",
        expanded ? "w-[220px]" : "w-[56px]"
      )}
    >
      {/* Logo */}
      <div className="p-3 border-b border-sidebar-border flex items-center gap-2">
        <Sun className="h-5 w-5 text-[hsl(var(--urgent))] shrink-0" />
        {expanded && (
          <div>
            <span className="font-semibold text-sidebar-primary text-sm tracking-wide">YOUR TOURS</span>
            <p className="text-[11px] text-sidebar-muted">Operations Center</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {renderGroup('Dep. Reservas', reservasItems, reservasOpen, setReservasOpen)}
      </nav>

      {/* User */}
      <div className={cn("border-t border-sidebar-border", expanded ? "p-3" : "p-2")}>
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

// ─── Mobile Menu (full-screen overlay) ───
const MobileMenu = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [reservasOpen, setReservasOpen] = useState(true);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  if (!open) return null;

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-sm rounded-lg min-h-[48px] transition-colors",
        isActive(item.to)
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-foreground hover:bg-muted'
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );

  const renderGroup = (label: string, items: NavItem[], groupOpen: boolean, setGroupOpen: (v: boolean) => void) => (
    <div>
      <button
        onClick={() => setGroupOpen(!groupOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-xs uppercase text-muted-foreground font-semibold tracking-wider"
      >
        {label}
        {groupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {groupOpen && <div className="space-y-0.5">{items.map(renderItem)}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-[hsl(var(--urgent))]" />
          <span className="font-semibold text-primary text-sm">YOUR TOURS</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
        {renderGroup('Dep. Reservas', reservasItems, reservasOpen, setReservasOpen)}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
            {initials}
          </div>
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

// ─── Hamburger Button (mobile only) ───
export const MobileMenuButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="md:hidden fixed top-3 left-3 z-50 p-2 bg-card border border-border rounded-lg shadow-md"
    aria-label="Abrir menu"
  >
    <Menu className="h-5 w-5" />
  </button>
);

// ─── Main Export ───
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
