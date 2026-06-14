import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';

interface AgentPageShellProps {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  role: string;
  accent?: string; // e.g. 'from-emerald-500/15 to-emerald-500/5'
  children: ReactNode;
  toolbar?: ReactNode;
}

const AgentPageShell = ({ icon: Icon, name, role, accent, children, toolbar }: AgentPageShellProps) => (
  <AppLayout>
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/agents" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Spark
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{name}</span>
      </div>

      <div className={cn(
        'rounded-lg border bg-gradient-to-br p-4 flex items-start gap-3',
        accent || 'from-muted/40 to-transparent',
      )}>
        <div className="h-10 w-10 rounded-md bg-white shadow-sm flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
            <h1 className="text-base md:text-lg font-bold">{name}</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{role}</p>
        </div>
        {toolbar && <div className="shrink-0">{toolbar}</div>}
      </div>

      {children}
    </div>
  </AppLayout>
);

export default AgentPageShell;
