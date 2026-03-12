import { Clock, AlertTriangle, Zap, Coffee, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

interface Props {
  statusCounts: { active: number; waiting: number; idle: number; error: number; offline: number };
  pendingCount: number;
  onCeoClick: () => void;
}

export default function OfficeTopBar({ statusCounts, pendingCount, onCeoClick }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        <span className="text-lg" role="img" aria-label="office">🏢</span>
        <h1 className="font-bold text-foreground text-sm md:text-base" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          AI Work Office
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Clock */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
          <Clock className="h-3 w-3" />
          {time.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        {/* Status pills */}
        <div className="hidden md:flex items-center gap-1.5">
          {statusCounts.active > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-[#22c55e]/40 text-[#22c55e]">
              <Zap className="h-2.5 w-2.5" /> {statusCounts.active} Active
            </Badge>
          )}
          {statusCounts.waiting > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-[#f59e0b]/40 text-[#f59e0b]">
              <Coffee className="h-2.5 w-2.5" /> {statusCounts.waiting} Waiting
            </Badge>
          )}
          {statusCounts.idle > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-muted text-muted-foreground">
              <Wifi className="h-2.5 w-2.5" /> {statusCounts.idle} Idle
            </Badge>
          )}
          {statusCounts.error > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" /> {statusCounts.error} Error
            </Badge>
          )}
        </div>

        {/* CEO Button */}
        <Button
          size="sm"
          variant={pendingCount > 0 ? 'destructive' : 'outline'}
          onClick={onCeoClick}
          className="text-xs gap-1.5 h-7"
        >
          👔 CEO Desk
          {pendingCount > 0 && (
            <span className="bg-background text-destructive rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-1">
              {pendingCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
