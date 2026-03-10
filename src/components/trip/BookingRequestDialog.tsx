import { useState } from 'react';
import { Mail, Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCreateBookingEmailLog, useUpsertTripOperation } from '@/hooks/useTripOperationsQuery';
import { useCreateItemNote } from '@/hooks/useItemNotesQuery';
import { supabase } from '@/integrations/supabase/client';

interface BookingRequestDialogProps {
  operationId: string | null;
  costItemId: string;
  tripId: string;
  tripCode: string;
  activityName: string;
  activityDate: string;
  scheduleTime: string;
  supplierName: string;
  supplierEmail: string;
  pax: number;
  netValue: number;
}

const BookingRequestDialog = ({
  operationId, costItemId, tripId, tripCode,
  activityName, activityDate, scheduleTime,
  supplierName, supplierEmail, pax, netValue,
}: BookingRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const createLog = useCreateBookingEmailLog();
  const upsertOp = useUpsertTripOperation();
  const createNote = useCreateItemNote();

  const defaultSubject = `Booking Request — ${activityName} — ${tripCode}`;
  const defaultBody = `Dear ${supplierName || '[Supplier Name]'},

We would like to request a booking for the following service:

Service: ${activityName}
Date: ${activityDate || '[Activity Date]'}
Time: ${scheduleTime || '[Time TBD]'}
Number of people: ${pax}
Total value: €${netValue.toFixed(2)}
Booking reference: ${tripCode}

Please confirm availability and send us the confirmation.

Best regards,
Your Tours Portugal
reservas@yourtours.pt`;

  const [to, setTo] = useState(supplierEmail);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTo(supplierEmail);
      setSubject(`Booking Request — ${activityName} — ${tripCode}`);
      setBody(defaultBody);
    }
    setOpen(isOpen);
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: 'Email do fornecedor em falta', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      // Ensure operation record exists
      let opId = operationId;
      if (!opId) {
        const op = await upsertOp.mutateAsync({
          cost_item_id: costItemId,
          trip_id: tripId,
          booking_status: 'requested',
        });
        opId = op.id;
      } else {
        await upsertOp.mutateAsync({
          cost_item_id: costItemId,
          trip_id: tripId,
          booking_status: 'requested',
        });
      }

      // Log the email
      await createLog.mutateAsync({
        operation_id: opId!,
        supplier_email: to,
        subject,
        body,
      });

      // Add note to cost item
      await createNote.mutateAsync({
        entity_type: 'cost_item',
        entity_id: costItemId,
        note_text: `📧 Booking request enviado para ${to}\nAssunto: ${subject}`,
      });

      toast({ title: 'Pedido de reserva registado', description: 'Status atualizado para "Requested"' });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-muted rounded" title="Enviar pedido de reserva">
          <Mail className="h-3 w-3 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Pedido de Reserva — {activityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Para</label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@fornecedor.pt" className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Assunto</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Corpo do email</label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} className="text-xs min-h-[200px] font-mono" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleSend} disabled={sending} className="text-xs gap-1">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Enviar & Atualizar Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingRequestDialog;
