import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useInternalUsers } from '@/hooks/useInternalUsers';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const NONE = '__none__';

interface Props { leadId: string; value: string[] | null | undefined; compact?: boolean; }

export default function LeadAgentsCell({ leadId, value, compact }: Props) {
  const { data: users = [] } = useInternalUsers();
  const [agents, setAgents] = useState<string[]>((value || []).filter(Boolean));
  const [open, setOpen] = useState(false);
  const [a1, setA1] = useState<string>(agents[0] || NONE);
  const [a2, setA2] = useState<string>(agents[1] || NONE);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const list = (value || []).filter(Boolean);
    setAgents(list);
    setA1(list[0] || NONE);
    setA2(list[1] || NONE);
  }, [value?.join(',')]);

  const shortName = (id: string) => {
    const u = users.find(x => x.id === id);
    const n = u?.full_name || u?.email || '?';
    return n.split(' ').slice(0, 2).join(' ');
  };
  const initials = (id: string) => {
    const u = users.find(x => x.id === id);
    const n = u?.full_name || u?.email || '?';
    return n.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  };

  const persist = async (a: string, b: string) => {
    const list = [a, b].filter(v => v && v !== NONE);
    if (new Set(list).size !== list.length) {
      toast({ title: 'Agentes duplicados', variant: 'destructive' });
      return;
    }
    setAgents(list);
    const { error } = await supabase.from('leads').update({ assigned_agents: list as any } as any).eq('id', leadId);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Agentes guardados', duration: 1500 });
      import('@/hooks/useCalendarSync').then(m => m.triggerCalendarSync(leadId, 'update'));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 hover:bg-muted rounded px-1.5 py-0.5 min-h-[24px]">
          {agents.length === 0 ? (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Users className="h-3 w-3" />Atribuir</span>
          ) : compact ? (
            <div className="flex -space-x-1">
              {agents.map(id => (
                <span key={id} title={shortName(id)} className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center border border-background">
                  {initials(id)}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] font-medium">{agents.map(shortName).join(', ')}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" onClick={e => e.stopPropagation()} align="start">
        <div className="space-y-2">
          <p className="text-xs font-semibold">Atribuir agentes</p>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Agente 1</label>
            <Select value={a1} onValueChange={v => { setA1(v); persist(v, a2); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Nenhum —</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Agente 2</label>
            <Select value={a2} onValueChange={v => { setA2(v); persist(a1, v); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Nenhum —</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[10px] text-muted-foreground">Guarda automaticamente.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
