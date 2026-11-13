import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { mailboxLabel, gmailThreadUrl } from '@/lib/crmEmail';

type Suggestion = { id: string; mailbox: string; gmail_message_id: string; gmail_thread_id: string | null; rfc822_message_id: string | null; from_email: string | null; subject: string | null; snippet: string | null; sent_at: string | null; candidate_lead_ids: string[]; reason: string | null };

export function useEmailSuggestions() {
  return useQuery({
    queryKey: ['email-link-suggestions'],
    queryFn: async () => {
      const { data, error, count } = await supabase.from('email_link_suggestions').select('*', { count: 'exact' }).eq('status', 'open').order('sent_at', { ascending: false }).limit(30);
      if (error) throw error;
      const ids = [...new Set((data || []).flatMap((s) => s.candidate_lead_ids || []))];
      const leads = ids.length ? (await supabase.from('leads').select('id,yt_id,client_name').in('id', ids)).data || [] : [];
      return { items: (data || []) as Suggestion[], total: count ?? 0, leads: new Map(leads.map((l) => [l.id, l])) };
    },
  });
}

/** "Emails por ligar": one-click linking of messages the automatic rules could not decide. */
export default function EmailSuggestions() {
  const q = useEmailSuggestions();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const link = async (s: Suggestion, leadId: string) => {
    const { error } = await supabase.from('email_links').insert({ lead_id: leadId, mailbox: s.mailbox, gmail_message_id: s.gmail_message_id, gmail_thread_id: s.gmail_thread_id, rfc822_message_id: s.rfc822_message_id, direction: 'in', from_email: s.from_email, subject: s.subject, snippet: s.snippet, sent_at: s.sent_at, link_source: 'manual', linked_by: user?.email ?? 'cockpit' });
    if (error) return toast({ title: 'Não foi possível ligar', description: error.message, variant: 'destructive' });
    if (s.gmail_thread_id) await supabase.from('email_links').update({ lead_id: leadId, unlinked: false }).eq('mailbox', s.mailbox).eq('gmail_thread_id', s.gmail_thread_id);
    toast({ title: 'Email ligado à file' });
    qc.invalidateQueries({ queryKey: ['email-link-suggestions'] });
  };
  const dismiss = async (s: Suggestion) => {
    const { error } = await supabase.from('email_link_suggestions').update({ status: 'dismissed' }).eq('id', s.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    qc.invalidateQueries({ queryKey: ['email-link-suggestions'] });
  };
  if (q.isLoading) return <p className="text-sm text-muted-foreground">A carregar…</p>;
  if (q.error) return <p className="text-sm text-destructive">Erro: {(q.error as Error).message}</p>;
  if (!q.data!.items.length) return <p className="text-sm text-muted-foreground">Nenhum email por ligar.</p>;
  return (
    <div className="space-y-2">
      {q.data!.items.map((s) => (
        <div key={s.id} className="border-b py-2 text-sm space-y-1">
          <div className="flex flex-wrap gap-2 items-baseline"><span className="text-xs text-muted-foreground">{mailboxLabel(s.mailbox)}</span><strong className="flex-1">{s.subject || '(sem assunto)'}</strong>{gmailThreadUrl(s.mailbox, s.gmail_thread_id) && <a className="text-xs underline" href={gmailThreadUrl(s.mailbox, s.gmail_thread_id)!} target="_blank" rel="noreferrer">Gmail</a>}</div>
          <p className="text-xs text-muted-foreground truncate">{s.from_email} · {s.reason}</p>
          <div className="flex flex-wrap gap-2">
            {s.candidate_lead_ids.map((id) => { const l = q.data!.leads.get(id); return <Button key={id} size="sm" variant="outline" onClick={() => link(s, id)}>Ligar a {l?.yt_id || l?.client_name?.slice(0, 24) || 'file'}</Button>; })}
            <Button size="sm" variant="ghost" onClick={() => dismiss(s)}>Ignorar</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
