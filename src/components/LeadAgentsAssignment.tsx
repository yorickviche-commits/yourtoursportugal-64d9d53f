import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useInternalUsers } from '@/hooks/useInternalUsers';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Save, X } from 'lucide-react';

interface Props { leadId: string; initial?: string[] | null; }

const NONE = '__none__';

export default function LeadAgentsAssignment({ leadId, initial }: Props) {
  const { data: users = [] } = useInternalUsers();
  const [agents, setAgents] = useState<string[]>((initial || []).filter(Boolean));
  const [open, setOpen] = useState(false);
  const [a1, setA1] = useState<string>(agents[0] || NONE);
  const [a2, setA2] = useState<string>(agents[1] || NONE);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setAgents((initial || []).filter(Boolean));
    setA1((initial || [])[0] || NONE);
    setA2((initial || [])[1] || NONE);
  }, [initial?.join(',')]);

  const nameOf = (id: string) => users.find(u => u.id === id)?.full_name || users.find(u => u.id === id)?.email || 'Utilizador';

  const save = async () => {
    const list = [a1, a2].filter(v => v && v !== NONE);
    if (new Set(list).size !== list.length) {
      toast({ title: 'Agentes duplicados', description: 'Escolhe agentes diferentes.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ assigned_agents: list as any } as any)
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    setAgents(list);
    setOpen(false);
    toast({ title: 'Agentes atualizados' });
    import('@/hooks/useCalendarSync').then(m => m.triggerCalendarSync(leadId, 'update'));
  };

  return (
    <div className="flex items-center gap-2">
      <Users className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground uppercase font-semibold">Agentes:</span>
      {agents.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">Nenhum</span>
      ) : (
        <div className="flex items-center gap-1">
          {agents.map(id => (
            <span key={id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{nameOf(id)}</span>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2">Editar</Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <p className="text-xs font-semibold">Atribuir até 2 agentes</p>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Agente 1</label>
              <Select value={a1} onValueChange={setA1}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Nenhum —</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Agente 2</label>
              <Select value={a2} onValueChange={setA2}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Nenhum —</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}><X className="h-3 w-3 mr-1" />Cancelar</Button>
              <Button size="sm" onClick={save} disabled={saving}><Save className="h-3 w-3 mr-1" />Guardar</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
