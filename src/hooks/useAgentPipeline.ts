import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

type PipelineAction = 'plan' | 'cost' | 'itinerary' | 'full_pipeline';

export function useAgentPipeline() {
  const [running, setRunning] = useState<PipelineAction | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runAgent = useCallback(async (action: PipelineAction, leadId: string) => {
    setRunning(action);
    try {
      const { data, error } = await supabase.functions.invoke('agent-orchestrator', {
        body: { action, leadId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const labels: Record<string, string> = {
        plan: 'Travel plan gerado com sucesso!',
        cost: 'Budget calculado com sucesso!',
        itinerary: 'Itinerário digital criado!',
        full_pipeline: 'Pipeline completo executado!',
      };

      toast({
        title: '🤖 ' + labels[action],
        description: data?.results?.budget?.needsApproval
          ? '⚠️ Proposta >€8k — aguarda aprovação CEO'
          : undefined,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['lead_planner'] });
      queryClient.invalidateQueries({ queryKey: ['lead_costing'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });

      return data;
    } catch (err: any) {
      toast({
        title: 'Erro no agente',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setRunning(null);
    }
  }, [toast, queryClient]);

  return { runAgent, running };
}
