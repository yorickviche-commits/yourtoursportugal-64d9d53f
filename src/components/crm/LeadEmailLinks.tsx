import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ExternalLink, Link2Off, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { gmailThreadUrl, mailboxLabel } from '@/lib/crmEmail';

/** Emails linked to this file from every shared mailbox, plus linked calendar events. */
export default function LeadEmailLinks({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({
    queryKey: ['lead-email-links', leadId],
    queryFn: async () => {
      const [em, ev, cl] = await Promise.all([
        supabase.from('email_links').select('id,mailbox,gmail_thread_id,direction,from_email,from_name,to_emails,subject,snippet,sent_at,link_source').eq('lead_id', leadId).eq('unlinked', false).order('sent_at', { ascending: false }).limit(200),
        supabase.from('calendar_events').select('id,day_date,status').eq('lead_id', leadId).order('day_date', { ascending: false }).limit(50),
        supabase.from('calendar_event_links').select('id,title,start_at,html_link').eq('lead_id', leadId).eq('unlinked', false).order('start_at', { ascending: false }).limit(50),
      ]);
      if (em.error) throw em.error;
      return { emails: em.data || [], tccEvents: ev.data || [], linkedEvents: cl.data || [] };
    },
  });
  const unlink = async (e: { mailbox: string; gmail_thread_id: string | null; id: string }) => {
    if (!window.confirm('Desligar esta conversa da file? O sync automático não a volta a ligar.')) return;
    const base = supabase.from('email_links').update({ unlinked: true }).eq('lead_id', leadId).eq('mailbox', e.mailbox);
    const { error } = e.gmail_thread_id ? await base.eq('gmail_thread_id', e.gmail_thread_id) : await base.eq('id', e.id);
    if (error) return toast({ title: 'Não foi possível desligar', description: error.message, variant: 'destructive' });
    toast({ title: 'Conversa desligada' });
    qc.invalidateQueries({ queryKey: ['lead-email-links', leadId] });
  };
  if (q.isLoading) return <Skeleton className="h-24 w-full" />;
  if (q.error) return <p className="text-xs text-destructive">Erro a carregar emails: {(q.error as Error).message}</p>;
  const { emails, tccEvents, linkedEvents } = q.data!;
  return (
    <section className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Emails ligados ({emails.length})</h3><span className="text-[11px] text-muted-foreground">reservas@ · operations@ · contabilidade@</span></div>
      {!emails.length && <p className="text-xs text-muted-foreground">Ainda não há emails ligados a esta file.</p>}
      <ul className="divide-y divide-border">
        {emails.map((e) => (
          <li key={e.id} className="py-2 flex flex-wrap items-start gap-2 text-xs">
            <Badge variant="outline" className="shrink-0">{mailboxLabel(e.mailbox)}</Badge>
            <Badge variant={e.direction === 'out' ? 'secondary' : 'default'} className="shrink-0">{e.direction === 'out' ? 'OUT' : 'IN'}</Badge>
            <div className="flex-1 min-w-[12rem]">
              <p className="font-medium text-foreground">{e.subject || '(sem assunto)'}</p>
              <p className="text-muted-foreground truncate">{e.direction === 'out' ? (e.to_emails || []).join(', ') : e.from_name || e.from_email} · {e.snippet}</p>
            </div>
            <span className="text-muted-foreground shrink-0">{e.sent_at ? format(new Date(e.sent_at), 'dd MMM yyyy HH:mm', { locale: pt }) : ''}</span>
            {gmailThreadUrl(e.mailbox, e.gmail_thread_id) && <Button asChild size="sm" variant="outline" className="h-7"><a href={gmailThreadUrl(e.mailbox, e.gmail_thread_id)!} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" />Abrir no Gmail</a></Button>}
            <Button size="sm" variant="ghost" className="h-7" onClick={() => unlink(e)}><Link2Off className="h-3 w-3 mr-1" />Desligar</Button>
          </li>
        ))}
      </ul>
      {(tccEvents.length > 0 || linkedEvents.length > 0) && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold flex items-center gap-1"><CalendarDays className="h-3 w-3" />Eventos de calendário</h4>
          {linkedEvents.map((ev) => <div key={ev.id} className="text-xs flex gap-2"><span className="text-muted-foreground">{ev.start_at ? format(new Date(ev.start_at), 'dd MMM yyyy', { locale: pt }) : ''}</span><span className="flex-1">{ev.title || 'Evento ligado'}</span>{ev.html_link && <a className="underline" href={ev.html_link} target="_blank" rel="noreferrer">Abrir</a>}</div>)}
          {tccEvents.map((ev) => <div key={ev.id} className="text-xs flex gap-2"><span className="text-muted-foreground">{ev.day_date}</span><span className="flex-1">Reservas YT · {ev.status}</span></div>)}
        </div>
      )}
    </section>
  );
}
