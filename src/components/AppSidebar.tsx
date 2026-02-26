import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, CheckCircle, Sun } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trips', icon: Map, label: 'Trips' },
  { to: '/approvals', icon: CheckCircle, label: 'Approvals' },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-sidebar text-sidebar-foreground flex flex-col z-30">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-urgent" />
          <span className="font-semibold text-sidebar-primary text-sm tracking-wide">
            YOUR TOURS
          </span>
        </div>
        <p className="text-[11px] text-sidebar-muted mt-1">Operations Center</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground">
            MS
          </div>
          <div>
            <p className="text-xs font-medium text-sidebar-accent-foreground">Maria S.</p>
            <p className="text-[10px] text-sidebar-muted">Sales</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
