import { useState } from 'react';
import { Mail, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useBookingEmailsByLeadOperation, useBookingEmailsByOperation, DbBookingEmail } from '@/hooks/useBookingEmailsQuery';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BookingEmailHistoryProps {
  operationId?: string | null;
  leadOperationId?: string | null;
  label: string;
}

const BookingEmailHistory = ({ operationId, leadOperationId, label }: BookingEmailHistoryProps) => {
  const [open, setOpen] = useState(false);
  
  const { data: tripEmails = [] } = useBookingEmailsByOperation(
    !leadOperationId ? (operationId || undefined) : undefined
  );
  const { data: leadEmails = [] } = useBookingEmailsByLeadOperation(
    leadOperationId || undefined
  );

  const emails: DbBookingEmail[] = leadOperationId ? leadEmails : tripEmails;
  const hasEmails = emails.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          className="p-1 hover:bg-muted rounded relative" 
          title={hasEmails ? `${emails.length} email(s) enviado(s)` : 'Sem emails enviados'}
        >
          <Mail className={`h-3 w-3 ${hasEmails ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}`} />
          {hasEmails && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[hsl(var(--success))] text-[7px] text-white flex items-center justify-center font-bold">
              {emails.length}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Histórico de Emails — {label}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {emails.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum email enviado para este item.</p>
          ) : (
            <div className="space-y-3">
              {emails.map(email => (
                <EmailCard key={email.id} email={email} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

const EmailCard = ({ email }: { email: DbBookingEmail }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border rounded-lg p-3 text-xs space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            {format(new Date(email.sent_at), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>
      <div className="font-medium">{email.subject}</div>
      {email.supplier_email && (
        <div className="text-muted-foreground">Para: {email.supplier_email}</div>
      )}
      {expanded && (
        <pre className="mt-2 p-2 bg-muted/30 rounded text-[10px] whitespace-pre-wrap font-mono">
          {email.body}
        </pre>
      )}
    </div>
  );
};

export default BookingEmailHistory;
