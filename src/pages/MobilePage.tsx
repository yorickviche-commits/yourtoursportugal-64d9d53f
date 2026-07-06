import { useState, useMemo } from 'react';
import { Plus, Send, Sparkles, Calculator, Loader2, ChevronRight, Search, LogOut, ArrowLeft, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLeadsQuery, useLeadQuery, type DbLead } from '@/hooks/useLeadsQuery';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import NewLeadDialog from '@/components/NewLeadDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { displayLeadCode } from '@/lib/leadCode';

/**
 * Minimal mobile-first cockpit for the team in the field.
 * Only the daily-critical flow: New Lead → Generate Itinerary → Auto-cost → Send proposal.
 * Lives at /mobile and reuses the same auth/data as the desktop app.
 */
const MobilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useLeadsQuery();

  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          !search ||
          l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
          l.lead_code?.toLowerCase().includes(search.toLowerCase()) ||
          l.yt_id?.toLowerCase().includes(search.toLowerCase()) ||
          l.destination?.toLowerCase().includes(search.toLowerCase()),
      ),
    [leads, search],
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-slate-600">Inicia sessão para continuar</p>
          <Button onClick={() => navigate('/login')} className="rounded-full">Entrar</Button>
        </div>
      </div>
    );
  }

  if (selectedId) {
    return <MobileLeadDetail leadId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0a2540] text-white px-4 pt-4 pb-3 shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/60">Your Tours · Mobile</p>
            <h1 className="text-lg font-semibold">Sales Cockpit</h1>
          </div>
          <button onClick={() => signOut()} className="p-2 -mr-2 rounded-full hover:bg-white/10">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar lead, código, destino…"
            className="w-full pl-9 pr-3 py-2.5 rounded-full bg-white/95 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </header>

      {/* List */}
      <main className="px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">Sem leads</div>
        ) : (
          filtered.map((l) => <LeadCard key={l.id} lead={l} onOpen={() => setSelectedId(l.id)} />)
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setNewLeadOpen(true)}
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-[#0a2540] text-white shadow-2xl flex items-center justify-center active:scale-95 transition"
      >
        <Plus className="h-6 w-6" />
      </button>

      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </div>
  );
};

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-sky-100 text-sky-700',
  qualified: 'bg-amber-100 text-amber-700',
  proposal_sent: 'bg-violet-100 text-violet-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
};

const LeadCard = ({ lead, onOpen }: { lead: DbLead; onOpen: () => void }) => (
  <button
    onClick={onOpen}
    className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm active:scale-[0.99] transition text-left"
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[10px] font-mono text-slate-400">{displayLeadCode(lead)}</span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLOR[lead.status] || 'bg-slate-100 text-slate-600')}>
          {lead.status}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-800 truncate">{lead.client_name || '—'}</p>
      <p className="text-xs text-slate-500 truncate">
        {lead.destination || 'A definir'} · {lead.pax || 0} pax
      </p>
    </div>
    <ChevronRight className="h-4 w-4 text-slate-300" />
  </button>
);

/* ─────────── Lead detail ─────────── */

const MobileLeadDetail = ({ leadId, onBack }: { leadId: string; onBack: () => void }) => {
  const { data: lead, isLoading } = useLeadQuery(leadId);
  const { toast } = useToast();

  const [genLoading, setGenLoading] = useState(false);
  const [costLoading, setCostLoading] = useState(false);
  const [plan, setPlan] = useState<any | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const handleGenerate = async () => {
    if (!lead) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-travel-plan', {
        body: {
          leadData: {
            client_name: lead.client_name,
            destination: lead.destination,
            travel_dates: lead.travel_dates,
            travel_end_date: lead.travel_end_date,
            number_of_days: lead.number_of_days,
            pax: lead.pax,
            language: 'EN',
            notes: lead.notes,
            travel_style: lead.travel_style,
            comfort_level: lead.comfort_level,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPlan(data.result);
      toast({ title: '✨ Itinerário gerado', description: `${data.result?.days?.length || 0} dias` });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setGenLoading(false);
    }
  };

  const handleAutoCost = async () => {
    if (!lead) return;
    setCostLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-fulfill-budget', {
        body: { leadId: lead.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: '💰 Custos calculados', description: 'Ver detalhe no desktop para revisão fina.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setCostLoading(false);
    }
  };

  if (isLoading || !lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="sticky top-0 z-20 bg-[#0a2540] text-white px-4 pt-4 pb-4 shadow">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-[10px] font-mono text-white/60">{displayLeadCode(lead)}</span>
        </div>
        <h1 className="text-lg font-semibold truncate">{lead.client_name}</h1>
        <p className="text-xs text-white/70 truncate">{lead.destination} · {lead.pax} pax · {lead.travel_dates}</p>
      </header>

      <main className="px-3 py-4 space-y-3">
        <ActionCard
          icon={<Sparkles className="h-5 w-5" />}
          title="Gerar Itinerário"
          subtitle="AI cria plano dia-a-dia"
          loading={genLoading}
          onClick={handleGenerate}
          accent="bg-violet-500"
        />
        <ActionCard
          icon={<Calculator className="h-5 w-5" />}
          title="Calcular Custos"
          subtitle="Auto-fulfill via protocolos FSE"
          loading={costLoading}
          onClick={handleAutoCost}
          accent="bg-emerald-500"
        />
        <ActionCard
          icon={<Send className="h-5 w-5" />}
          title="Enviar Proposta"
          subtitle={lead.email || 'Sem email'}
          onClick={() => setComposerOpen(true)}
          accent="bg-[#0a2540]"
          disabled={!lead.email}
        />

        {plan && (
          <div className="bg-white rounded-2xl p-4 mt-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Pré-visualização</p>
            <p className="text-sm font-semibold text-slate-800 mb-1">{plan.trip_title}</p>
            <p className="text-xs text-slate-500 mb-3 line-clamp-3">{plan.narrative}</p>
            <div className="space-y-1.5">
              {plan.days?.slice(0, 6).map((d: any) => (
                <div key={d.day_number} className="flex items-start gap-2 text-xs">
                  <span className="font-mono text-slate-400">D{d.day_number}</span>
                  <span className="text-slate-700 truncate">{d.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-4">
          <button
            onClick={() => window.open(`/leads/${lead.id}`, '_blank')}
            className="text-xs text-slate-500 underline"
          >
            Abrir versão completa
          </button>
        </div>
      </main>

      {composerOpen && (
        <MobileComposer lead={lead} onClose={() => setComposerOpen(false)} />
      )}
    </div>
  );
};

const ActionCard = ({
  icon, title, subtitle, onClick, loading, accent, disabled,
}: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; loading?: boolean; accent: string; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={cn(
      'w-full bg-white rounded-2xl px-4 py-4 flex items-center gap-4 shadow-sm active:scale-[0.99] transition text-left',
      disabled && 'opacity-50',
    )}
  >
    <div className={cn('h-11 w-11 rounded-xl text-white flex items-center justify-center shrink-0', accent)}>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 truncate">{subtitle}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-slate-300" />
  </button>
);

/* ─────────── Email composer (mobile) ─────────── */

const MobileComposer = ({ lead, onClose }: { lead: DbLead; onClose: () => void }) => {
  const { toast } = useToast();
  const [to, setTo] = useState(lead.email || '');
  const [subject, setSubject] = useState(`Your tailored Travel Plan — ${lead.destination || 'Portugal'}`);
  const [body, setBody] = useState(
    `Dear ${lead.client_name || 'traveller'},\n\nIt's been a pleasure putting this together. Please find your tailored Travel Plan below — every day has been hand-designed to balance signature experiences with quiet local moments.\n\nWe can of course refine anything: pacing, accommodation style, or activity mix.\n\nWarmly,\nYour Tours Portugal\nreservas@yourtours.pt`,
  );
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) return toast({ title: 'Destinatário em falta', variant: 'destructive' });
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-booking-email', {
        body: { to, subject, body, attachments: [] },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Falha');

      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from('booking_emails_log').insert({
        lead_id: lead.id,
        supplier_email: to,
        subject,
        body,
        email_category: 'sales_proposal',
        sent_by: user?.id || null,
      });

      toast({ title: 'Email enviado', description: to });
      onClose();
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      <header className="bg-[#0a2540] text-white px-4 py-3 flex items-center gap-2 shadow">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Mail className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Enviar proposta</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div>
          <Label className="text-[10px] uppercase text-slate-500">Para</Label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-10" />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-slate-500">Assunto</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 h-10" />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-slate-500">Corpo</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="mt-1 text-sm font-mono" />
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11 rounded-full">Cancelar</Button>
        <Button onClick={handleSend} disabled={sending} className="flex-1 h-11 rounded-full bg-[#0a2540] hover:bg-[#0a2540]/90">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Enviar</>}
        </Button>
      </div>
    </div>
  );
};

export default MobilePage;
