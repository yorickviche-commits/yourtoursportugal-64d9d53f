import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function LearningDrafts() {
  const query = useQuery({ queryKey: ['admin-learning-drafts'], queryFn: async () => {
    const { data, error } = await supabase.from('agent_task_drafts').select('id,title,summary,status,created_at')
      .eq('origin', 'learning_loop').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } });
  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  if (query.error) return <p className="text-destructive">Não foi possível consultar a aprendizagem.</p>;
  return <section className="space-y-4"><h2 className="font-semibold">Aprendizagem ({query.data?.length || 0})</h2>
    {!query.data?.length && <p className="text-sm text-muted-foreground">Sem propostas de aprendizagem.</p>}
    {query.data?.map(row => <article key={row.id} className="border-b border-border pb-4 space-y-2">
      <h3 className="font-medium">{row.title}</h3><p className="text-sm break-words">{row.summary}</p>
      <Badge variant="outline">{row.status === 'pending_approval' ? 'Por rever' : row.status}</Badge>
      <span className="ml-3 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString('pt-PT')}</span>
    </article>)}
  </section>;
}