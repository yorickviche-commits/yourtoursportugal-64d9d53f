import { ChevronDown, ChevronRight, Eye, Mail, Upload, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type ReservationStatus = 'confirmed' | 'pending' | 'not_started';
export type PaymentStatus = 'conta_mensal' | 'pago_backoffice' | 'pago_guia' | 'pago_parcialmente' | 'a_pagar_guia' | 'a_pagar_backoffice' | 'nao_pago';
export type InvoiceStatus = 'received' | 'pending' | 'not_applicable';

export interface OperationsActivity {
  id: string;
  name: string;
  supplier: string | null;
  numPeople: number;
  netTotal: number;
  paidAmount: number;
  startTime: string;
  endTime: string;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
  invoiceStatus: InvoiceStatus;
}

export interface OperationsDay {
  day: number;
  date: string;
  title: string;
  activities: OperationsActivity[];
}

const reservationLabels: Record<ReservationStatus, { label: string; className: string }> = {
  confirmed: { label: 'Confirmada', className: 'text-success' },
  pending: { label: 'Pendente', className: 'text-urgent' },
  not_started: { label: '—', className: 'text-muted-foreground' },
};

const paymentLabels: Record<PaymentStatus, { label: string; className: string }> = {
  conta_mensal: { label: 'CONTA MENSAL', className: 'text-info font-semibold' },
  pago_backoffice: { label: 'PAGO BACKOFFICE', className: 'text-info font-semibold' },
  pago_guia: { label: 'PAGO PELO GUIA', className: 'text-info font-semibold' },
  pago_parcialmente: { label: 'PAGO PARCIALMENTE', className: 'text-success font-semibold' },
  a_pagar_guia: { label: 'A PAGAR PELO GUIA', className: 'text-urgent font-semibold' },
  a_pagar_backoffice: { label: 'A PAGAR BACKOFFICE', className: 'text-urgent font-semibold' },
  nao_pago: { label: 'NÃO PAGO', className: 'text-destructive font-semibold' },
};

interface OperationsTableProps {
  days: OperationsDay[];
}

const OperationsTable = ({ days }: OperationsTableProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>(days.map(d => d.day));

  const toggleDay = (day: number) => {
    setExpandedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold">Operações / Reservas & Pagamentos</h2>
      </div>
      <div className="divide-y">
        {days.map((day) => {
          const expanded = expandedDays.includes(day.day);
          return (
            <div key={day.day}>
              <button
                onClick={() => toggleDay(day.day)}
                className="w-full flex items-center gap-3 p-3 px-4 hover:bg-muted/30 transition-colors text-left"
              >
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <span className="text-xs text-info font-medium">Dia {day.day}.</span>
                  <p className="text-sm font-semibold text-info">
                    Day {day.day} | {day.date}: {day.title}
                  </p>
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-medium text-primary-foreground uppercase tracking-wider px-2 py-2 bg-info/80 rounded-t-md">
                    <div className="col-span-2">Atividade</div>
                    <div className="col-span-1">Início/Fim</div>
                    <div className="col-span-1">Fornecedor</div>
                    <div className="col-span-1 text-right">Nº Pess.</div>
                    <div className="col-span-1 text-right">NET Total</div>
                    <div className="col-span-1 text-right">Pago</div>
                    <div className="col-span-1 text-center">Reserva</div>
                    <div className="col-span-2 text-center">Pagamento</div>
                    <div className="col-span-1 text-center">Ações</div>
                  </div>

                  {/* Rows */}
                  <div className="border border-t-0 rounded-b-md divide-y">
                    {day.activities.map((act) => {
                      const resConfig = reservationLabels[act.reservationStatus];
                      const payConfig = paymentLabels[act.paymentStatus];
                      return (
                        <div key={act.id} className="grid grid-cols-12 gap-1 px-2 py-3 text-xs items-center hover:bg-muted/20 transition-colors">
                          <div className="col-span-2 font-medium">{act.name}</div>
                          <div className="col-span-1">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{act.startTime || '--:--'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{act.endTime || '--:--'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-1 text-muted-foreground truncate">{act.supplier || '—'}</div>
                          <div className="col-span-1 text-right">{act.numPeople}</div>
                          <div className="col-span-1 text-right font-medium">€{act.netTotal}</div>
                          <div className="col-span-1 text-right">
                            <span className="bg-muted px-1.5 py-0.5 rounded">{act.paidAmount}</span>
                          </div>
                          <div className={cn("col-span-1 text-center text-[10px]", resConfig.className)}>
                            {resConfig.label}
                          </div>
                          <div className={cn("col-span-2 text-center text-[10px]", payConfig.className)}>
                            {payConfig.label}
                          </div>
                          <div className="col-span-1 flex items-center justify-center gap-1">
                            <button className="p-1 hover:bg-muted rounded" title="Ver">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 hover:bg-muted rounded" title="Upload">
                              <Upload className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button className="p-1 hover:bg-muted rounded" title="Email">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OperationsTable;
