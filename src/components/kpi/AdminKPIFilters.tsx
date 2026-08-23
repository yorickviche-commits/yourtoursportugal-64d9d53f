import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { useInternalUsers } from '@/hooks/useInternalUsers';
import { KPIFilterState, Period } from '@/hooks/useAdminKPIs';

interface Props {
  value: KPIFilterState;
  onChange: (v: KPIFilterState) => void;
  agentFilterSupported?: boolean;
}

export default function AdminKPIFilters({ value, onChange, agentFilterSupported = true }: Props) {
  const { data: agents = [] } = useInternalUsers();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value.period} onValueChange={(v) => onChange({ ...value, period: v as Period })}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="90d">Últimos 90 dias</SelectItem>
          <SelectItem value="year">Este ano</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Select
          value={value.agentId || 'all'}
          onValueChange={(v) => onChange({ ...value, agentId: v === 'all' ? undefined : v })}
          disabled={!agentFilterSupported}
        >
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Todos os agentes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!agentFilterSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">
              Este separador ainda não tem uma coluna de responsável fiável — o filtro de agente não tem efeito aqui.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
