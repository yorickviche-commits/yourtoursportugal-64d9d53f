import { Bot, Loader2, Zap, Calculator, FileText, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useAgentPipeline } from '@/hooks/useAgentPipeline';

interface Props {
  leadId: string;
  leadName: string;
}

export default function AgentPipelineButton({ leadId, leadName }: Props) {
  const { runAgent, running } = useAgentPipeline();

  if (running) {
    return (
      <Button size="sm" disabled className="text-xs gap-1.5 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--success))] text-white">
        <Loader2 className="h-3 w-3 animate-spin" />
        {running === 'plan' && 'Generating plan...'}
        {running === 'cost' && 'Calculating budget...'}
        {running === 'itinerary' && 'Creating itinerary...'}
        {running === 'full_pipeline' && 'Running pipeline...'}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="text-xs gap-1.5 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--success))] text-white hover:opacity-90">
          <Bot className="h-3 w-3" /> AI Agents
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => runAgent('full_pipeline', leadId)} className="text-xs gap-2 cursor-pointer">
          <Workflow className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
          <div>
            <p className="font-medium">Full Pipeline</p>
            <p className="text-[10px] text-muted-foreground">Plan → Budget → Itinerary</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => runAgent('plan', leadId)} className="text-xs gap-2 cursor-pointer">
          <Zap className="h-3.5 w-3.5 text-[#00BCD4]" />
          Travel Plan Only
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runAgent('cost', leadId)} className="text-xs gap-2 cursor-pointer">
          <Calculator className="h-3.5 w-3.5 text-[#F44336]" />
          Budget Only
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runAgent('itinerary', leadId)} className="text-xs gap-2 cursor-pointer">
          <FileText className="h-3.5 w-3.5 text-[#4CAF50]" />
          Digital Itinerary Only
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
