import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

type Method = "wetravel" | "bank" | "cash" | "other";
type Kind = "payment" | "refund";

interface Payment {
  id: string;
  lead_id: string;
  kind: Kind;
  amount: number;
  currency: string;
  paid_at: string;
  method: Method;
  method_other: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

const methodLabel: Record<Method, string> = {
  wetravel: "WeTravel",
  bank: "Banco",
  cash: "Cash",
  other: "Outro",
};

export function PaymentsDialog({ leadId, children }: { leadId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ["lead_payments", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_payments")
        .select("*")
        .eq("lead_id", leadId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Payment[];
    },
    enabled: open,
  });

  const [form, setForm] = useState({
    kind: "payment" as Kind,
    amount: "",
    paid_at: new Date().toISOString().slice(0, 10),
    method: "wetravel" as Method,
    method_other: "",
    reference: "",
    notes: "",
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(form.amount);
      if (!amt || amt <= 0) throw new Error("Montante inválido");
      if (form.method === "other" && !form.method_other.trim()) throw new Error("Especifica o método");
      const { error } = await (supabase as any).from("lead_payments").insert({
        lead_id: leadId,
        kind: form.kind,
        amount: amt,
        paid_at: form.paid_at,
        method: form.method,
        method_other: form.method === "other" ? form.method_other : null,
        reference: form.reference || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead_payments", leadId] });
      qc.invalidateQueries({ queryKey: ["lead_payments_summary", leadId] });
      setForm({ ...form, amount: "", reference: "", notes: "", method_other: "" });
      toast({ title: "Pagamento registado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("lead_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead_payments", leadId] });
      qc.invalidateQueries({ queryKey: ["lead_payments_summary", leadId] });
    },
  });

  const totalPaid = payments.filter(p => p.kind === "payment").reduce((s, p) => s + Number(p.amount), 0);
  const totalRefund = payments.filter(p => p.kind === "refund").reduce((s, p) => s + Number(p.amount), 0);
  const net = totalPaid - totalRefund;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagamentos</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border p-2"><div className="text-muted-foreground">Pago</div><div className="text-lg font-bold text-green-600">{totalPaid.toFixed(2)}€</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground">Reembolsos</div><div className="text-lg font-bold text-orange-600">{totalRefund.toFixed(2)}€</div></div>
          <div className="rounded border p-2"><div className="text-muted-foreground">Líquido</div><div className="text-lg font-bold">{net.toFixed(2)}€</div></div>
        </div>

        <div className="rounded border p-3 space-y-2 bg-muted/30">
          <div className="text-xs font-semibold flex items-center gap-1"><Plus className="h-3 w-3"/> Novo registo</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">Tipo</Label>
              <Select value={form.kind} onValueChange={(v: Kind) => setForm({ ...form, kind: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">Pagamento</SelectItem>
                  <SelectItem value="refund">Reembolso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Montante (€)</Label>
              <Input type="number" step="0.01" className="h-8 text-xs" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/>
            </div>
            <div>
              <Label className="text-[10px]">Data</Label>
              <Input type="date" className="h-8 text-xs" value={form.paid_at} onChange={e => setForm({ ...form, paid_at: e.target.value })}/>
            </div>
            <div>
              <Label className="text-[10px]">Método</Label>
              <Select value={form.method} onValueChange={(v: Method) => setForm({ ...form, method: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wetravel">WeTravel</SelectItem>
                  <SelectItem value="bank">Banco</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.method === "other" && (
              <div className="col-span-2">
                <Label className="text-[10px]">Especifica</Label>
                <Input className="h-8 text-xs" value={form.method_other} onChange={e => setForm({ ...form, method_other: e.target.value })}/>
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-[10px]">Referência</Label>
              <Input className="h-8 text-xs" placeholder="Nº transação / IBAN parcial" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}/>
            </div>
            <div className="col-span-full">
              <Label className="text-[10px]">Notas</Label>
              <Textarea className="text-xs min-h-[40px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => addMut.mutate()} disabled={addMut.isPending}>Registar</Button>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold mb-2">Histórico</div>
          {payments.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">Sem registos</div>
          ) : (
            <div className="space-y-1">
              {payments.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs border rounded p-2">
                  <div className={`w-1 h-8 rounded ${p.kind === "payment" ? "bg-green-500" : "bg-orange-500"}`}/>
                  <div className="flex-1">
                    <div className="font-medium">
                      {p.kind === "payment" ? "+" : "−"}{Number(p.amount).toFixed(2)}€ · {methodLabel[p.method]}{p.method === "other" && p.method_other ? ` (${p.method_other})` : ""}
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      {p.paid_at}{p.reference ? ` · ${p.reference}` : ""}{p.notes ? ` · ${p.notes}` : ""}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delMut.mutate(p.id)}>
                    <Trash2 className="h-3 w-3"/>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function usePaymentsSummary(leadId: string) {
  return useQuery({
    queryKey: ["lead_payments_summary", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_payments")
        .select("kind, amount")
        .eq("lead_id", leadId);
      if (error) throw error;
      const paid = (data || []).filter((p: any) => p.kind === "payment").reduce((s: number, p: any) => s + Number(p.amount), 0);
      const refund = (data || []).filter((p: any) => p.kind === "refund").reduce((s: number, p: any) => s + Number(p.amount), 0);
      return { paid, refund, net: paid - refund, count: (data || []).length };
    },
    enabled: !!leadId,
  });
}
