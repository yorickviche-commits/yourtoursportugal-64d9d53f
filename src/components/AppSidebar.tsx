import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, CheckCircle, Sun, PanelLeftClose, PanelLeft, Users, Globe, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trips', icon: Map, label: 'Reservas Confirmadas' },
  { to: '/leads', icon: Users, label: 'Leads & Files' },
  { to: '/approvals', icon: CheckCircle, label: 'Processos / Aprovações' },
  { to: '/crm', icon: Globe, label: 'CRM (NetHunt)' },
  { to: '/payments', icon: CreditCard, label: 'Pagamentos (WeTravel)' },
];

const AppSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 bg-sidebar text-sidebar-foreground flex flex-col z-30 transition-all duration-200",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
    >
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center w-full")}>
          <Sun className="h-5 w-5 text-urgent shrink-0" />
          {!collapsed && (
            <div>
              <span className="font-semibold text-sidebar-primary text-sm tracking-wide">YOUR TOURS</span>
              <p className="text-[11px] text-sidebar-muted">Operations Center</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="p-1 hover:bg-sidebar-accent rounded">
            <PanelLeftClose className="h-4 w-4 text-sidebar-muted" />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)} className="p-3 hover:bg-sidebar-accent/50 flex justify-center">
          <PanelLeft className="h-4 w-4 text-sidebar-muted" />
        </button>
      )}

      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground shrink-0">
              MS
            </div>
            <div>
              <p className="text-xs font-medium text-sidebar-accent-foreground">Maria S.</p>
              <p className="text-[10px] text-sidebar-muted">Sales</p>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="p-2 border-t border-sidebar-border flex justify-center">
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground">
            MS
          </div>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
