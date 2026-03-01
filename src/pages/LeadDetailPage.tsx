import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, FileText, ClipboardList, Eye, FileIcon, Mail, Clock, Loader2, ChevronDown } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { mockLeads } from '@/data/mockLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import TagSelect from '@/components/TagSelect';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadStatus } from '@/types/leads';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type DetailTab = 'dados_gerais' | 'travel_planner' | 'custos' | 'itinerario' | 'operacoes';

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'dados_gerais', label: 'Dados Gerais' },
  { key: 'travel_planner', label: 'Travel Planner' },
  { key: 'custos', label: 'Custos' },
  { key: 'itinerario', label: 'Itinerário' },
  { key: 'operacoes', label: 'Operações' },
];

const RIGHT_TABS = ['Email', 'Tasks', 'Notas'];

const CATEGORIAS = ['Premium & Boutique', 'Standard', 'Luxury', 'Budget', 'Adventure'];
const DESTINOS = ['Porto & Douro Valley', 'Lisbon & Sintra', 'Algarve', 'Azores', 'Madeira', 'Minho', 'Alentejo', 'Silver Coast'];
const IDIOMAS = ['EN', 'PT', 'FR', 'ES', 'DE', 'IT', 'NL'];
const ORIGENS = ['website', 'AI Simulation', 'referral', 'partner', 'social_media', 'direct'];

// Mock operations data per day
const MOCK_OPS_DAYS = [
  {
    day: 1,
    date: '15 de maio',
    title: 'chegada em Lisboa e transfer do grupo para o hotel (só ida)',
    weekday: 'Friday, 15/May/2026',
    items: [
      { id: 'op1', activity: 'Transporte para todo o programa', startTime: '', endTime: '', supplier: 'Cola Limousine', pax: 0, netTotal: 3590, paid: 0, reservation: '-', payment: '-', invoice: '-' },
    ],
  },
  {
    day: 2,
    date: '16 de maio',
    title: 'city tour de dia inteiro com guia pela cidade de Lisboa',
    weekday: 'Saturday, 16/May/2026',
    items: [
      { id: 'op2', activity: 'Guia local FD', startTime: '', endTime: '', supplier: '', pax: 0, netTotal: 200, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op3', activity: 'Almoço Guia', startTime: '', endTime: '', supplier: '', pax: 0, netTotal: 20, paid: 0, reservation: '-', payment: '-', invoice: '-' },
    ],
  },
  {
    day: 3,
    date: '17 de maio',
    title: 'tour visitando Sintra, Cascais e Estoril',
    weekday: 'Sunday, 17/May/2026',
    items: [
      { id: 'op4', activity: 'Entrada Palácio Nacional de Pena', startTime: '', endTime: '', supplier: 'Parques de Sintra', pax: 10, netTotal: 200, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op5', activity: 'Transfer Palácio Nacional de Pena', startTime: '', endTime: '', supplier: 'Parques de Sintra', pax: 10, netTotal: 45, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op6', activity: 'Almoço Guia', startTime: '', endTime: '', supplier: '', pax: 0, netTotal: 15, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op7', activity: 'Guia local FD', startTime: '', endTime: '', supplier: 'Your Tours', pax: 0, netTotal: 200, paid: 0, reservation: '-', payment: '-', invoice: '-' },
    ],
  },
];

const PAYMENT_STATUSES = [
  { label: 'CONTA MENSAL', color: 'text-[hsl(var(--info))]' },
  { label: 'PAGO PELO BACKOFFICE', color: 'text-[hsl(var(--info))]' },
  { label: 'PAGO PELO GUIA', color: 'text-[hsl(var(--info))]' },
  { label: 'PAGO PARCIALMENTE', color: 'text-[hsl(var(--warning))]' },
  { label: 'A MARCAR PELO GUIA', color: 'text-[hsl(var(--warning))]' },
  { label: 'A PAGAR PELO BACKOFFICE', color: 'text-[hsl(var(--warning))]' },
  { label: 'NÃO PAGO', color: 'text-[hsl(var(--urgent))]' },
];

const OperacoesTab = ({ activeVersion }: { activeVersion: number }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Operações</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Baseado na versão aceite (V{activeVersion})</span>
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <ClipboardList className="h-3 w-3" /> Briefing FSEs
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1">
            <FileText className="h-3 w-3" /> Briefing Cliente
          </Button>
        </div>
      </div>

      {MOCK_OPS_DAYS.map(day => (
        <div key={day.day} className="bg-card rounded-lg border overflow-hidden">
          {/* Day header */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold text-[hsl(var(--info))]">Dia {day.day}.</p>
            <p className="text-sm font-bold text-[hsl(var(--info))]">{day.date} – {day.title}</p>
            <p className="text-[10px] text-muted-foreground">{day.weekday}</p>
          </div>

          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="text-left px-3 py-2 font-medium">Atividade</th>
                  <th className="text-left px-3 py-2 font-medium">Início/Fim</th>
                  <th className="text-left px-3 py-2 font-medium">Fornecedor</th>
                  <th className="text-center px-3 py-2 font-medium">Nº de Pessoas</th>
                  <th className="text-right px-3 py-2 font-medium">Valor NET Total</th>
                  <th className="text-center px-3 py-2 font-medium">Pago</th>
                  <th className="text-center px-3 py-2 font-medium">Reserva</th>
                  <th className="text-center px-3 py-2 font-medium">Pagamento</th>
                  <th className="text-center px-3 py-2 font-medium">Fatura</th>
                  <th className="text-center px-3 py-2 font-medium">FSE</th>
                </tr>
              </thead>
              <tbody>
                {day.items.map(item => (
                  <tr key={item.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[item.id]}
                        onChange={() => toggleCheck(item.id)}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                    </td>
                    <td className="px-3 py-3 text-foreground">{item.activity}</td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <Input className="h-6 text-[10px] w-24" placeholder="--:--" defaultValue={item.startTime} />
                        <Input className="h-6 text-[10px] w-24" placeholder="--:--" defaultValue={item.endTime} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[hsl(var(--info))]">{item.supplier || <span className="text-muted-foreground">null</span>}</td>
                    <td className="px-3 py-3 text-center font-medium text-[hsl(var(--urgent))]">{item.pax}</td>
                    <td className="px-3 py-3 text-right font-medium">{item.netTotal} €</td>
                    <td className="px-3 py-3 text-center">
                      <Input className="h-6 text-[10px] w-16 mx-auto" defaultValue={item.paid} />
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{item.reservation}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{item.payment}</td>
                    <td className="px-3 py-3 text-center">
                      <Eye className="h-3.5 w-3.5 text-[hsl(var(--info))] mx-auto cursor-pointer" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileIcon className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                        <FileIcon className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                        <Mail className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'Novo', color: 'bg-muted text-muted-foreground' },
  { value: 'contacted', label: 'Contactado', color: 'bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]' },
  { value: 'qualified', label: 'Qualificado', color: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' },
  { value: 'proposal_sent', label: 'Proposta Enviada', color: 'bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]' },
  { value: 'negotiation', label: 'Negociação', color: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' },
  { value: 'won', label: 'Ganho ✓', color: 'bg-[hsl(var(--stable)/0.15)] text-[hsl(var(--stable))]' },
  { value: 'lost', label: 'Perdido', color: 'bg-destructive/15 text-destructive' },
];

const LeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const lead = mockLeads.find(l => l.id === id);
  const [activeTab, setActiveTab] = useState<DetailTab>('dados_gerais');
  const [leadStatus, setLeadStatus] = useState<LeadStatus>(lead?.status || 'new');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, any>>({});
  const { toast } = useToast();

  // Tag select states
  const [categoria, setCategoria] = useState<string[]>(lead?.comfortLevel ? [lead.comfortLevel] : []);
  const [destino, setDestino] = useState<string[]>(lead?.destination ? [lead.destination] : []);
  const [idioma, setIdioma] = useState<string[]>(['EN']);
  const [origem, setOrigem] = useState<string[]>(lead?.source === 'ai_simulation' ? ['AI Simulation'] : lead?.source ? [lead.source] : []);
  const [travelStyles, setTravelStyles] = useState<string[]>(lead?.travelStyle || []);
  const [activeVersion, setActiveVersion] = useState(1);

  const generateAI = async (type: 'travel_planner' | 'budget' | 'digital_itinerary') => {
    if (!lead) return;
    setAiLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          leadData: {
            clientName: lead.clientName,
            destination: lead.destination,
            travelDates: lead.travelDates,
            pax: lead.pax,
            travelStyles: lead.travelStyle || [],
            comfortLevel: lead.comfortLevel || '',
            budgetLevel: lead.budgetLevel,
            magicQuestion: lead.magicQuestion,
            notes: lead.notes,
          },
          type,
        },
      });
      if (error) throw error;
      setAiResults(prev => ({ ...prev, [type]: data.result }));
      toast({ title: 'AI gerou com sucesso', description: `Modelo usado: ${data.modelUsed}` });
    } catch (e: any) {
      console.error('AI generation error:', e);
      toast({ title: 'Erro na geração AI', description: e.message, variant: 'destructive' });
    } finally {
      setAiLoading(null);
    }
  };

  if (!lead) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Simulação não encontrada</p>
          <Link to="/leads" className="text-[hsl(var(--info))] text-sm hover:underline mt-2 inline-block">Voltar</Link>
        </div>
      </AppLayout>
    );
  }

  const currentStatusConfig = LEAD_STATUSES.find(s => s.value === leadStatus) || LEAD_STATUSES[0];

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <Link to="/leads" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Voltar às simulações
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Nº{lead.id.replace('L-', '')} - {lead.email} - {lead.destination} - adt:{lead.pax} - chl:0 - inf:0
              </h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn("text-sm font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity", currentStatusConfig.color)}>
                    [ {currentStatusConfig.label} ]
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {LEAD_STATUSES.map(s => (
                    <DropdownMenuItem key={s.value} onClick={() => setLeadStatus(s.value)} className={cn("text-xs cursor-pointer", leadStatus === s.value && "font-bold")}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs">Pagamento</Button>
              <div className="bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1.5 rounded">
                NOT PAID 0€ - {lead.budgetLevel}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-0">
            {DETAIL_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab.key
                    ? "border-[hsl(var(--info))] text-[hsl(var(--info))]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {RIGHT_TABS.map(tab => (
              <button key={tab} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Dados Gerais */}
        {activeTab === 'dados_gerais' && (
          <div className="space-y-6">
            {/* Version selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3].map(v => (
                  <button key={v} onClick={() => setActiveVersion(v)}
                    className={cn("px-2.5 py-1 text-xs rounded border transition-colors",
                      activeVersion === v ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground hover:text-foreground"
                    )}>
                    V{v}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">🔒 Versão · {activeVersion}</span>
              <Button variant="outline" size="sm" className="text-xs">Duplicar</Button>
              <Button variant="outline" size="sm" className="text-xs">Nova Versão</Button>
            </div>

            {/* Informação geral */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Informação geral</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº VI</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.id.replace('L-', '')} readOnly />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Criador da Simulação</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.salesOwner} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Data</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={new Date(lead.createdAt).toLocaleString('pt-PT')} readOnly />
                </div>
              </div>
            </div>

            {/* Dados do cliente */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados do cliente</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nome</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.clientName} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">E-mail</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.email} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Telefone</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.phone || ''} />
                </div>
              </div>
            </div>

            {/* Dados da viagem - with tag selects */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados da viagem</h3>
              <div className="grid grid-cols-3 gap-4">
                <TagSelect label="Categoria" value={categoria} options={CATEGORIAS} onChange={setCategoria} />
                <TagSelect label="Destino" value={destino} options={DESTINOS} onChange={setDestino} multiple />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Data inicial</label>
                  <Input className="h-8 text-xs mt-1" type="date" defaultValue={lead.travelDates} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de adultos</label>
                  <Input className="h-8 text-xs mt-1" type="number" defaultValue={lead.pax} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de jovens</label>
                  <Input className="h-8 text-xs mt-1" type="number" defaultValue={0} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de crianças</label>
                  <Input className="h-8 text-xs mt-1" type="number" defaultValue={0} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Budget total da viagem (€)</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Total da Viagem (€)</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
                <TagSelect label="Idioma" value={idioma} options={IDIOMAS} onChange={setIdioma} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <TagSelect label="Origem do Itinerário" value={origem} options={ORIGENS} onChange={setOrigem} />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Valor a Receber Pelo Guia</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Desconto</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
              </div>
            </div>

            {/* Travel styles as tag select */}
            <TagSelect
              label="Estilos de viagem"
              value={travelStyles}
              options={['Food & Wine', 'Culture & History', 'Nature & Adventure', 'Beach & Relax', 'City Break', 'Road Trip', 'Wellness', 'Photography']}
              onChange={setTravelStyles}
              multiple
            />

            {/* Magic question */}
            {lead.magicQuestion && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">✨ O que tornaria esta viagem inesquecível?</h3>
                <p className="text-sm text-foreground italic">"{lead.magicQuestion}"</p>
              </div>
            )}

            {/* Preferências */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Preferências / Notas</label>
              <Textarea className="mt-1 text-xs" rows={3} defaultValue={lead.notes || ''} />
            </div>

            {/* Valor Net + Margem */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Net</p>
                  <p className="text-sm font-semibold text-[hsl(var(--info))]">—</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem</p>
                  <p className="text-sm font-semibold text-foreground">—</p>
                </div>
              </div>
            </div>

            {/* Payment history */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">Histórico de Pagamento</h3>
              <p className="text-xs text-[hsl(var(--urgent))]">Activate Follow-Up</p>
              <Input className="h-8 text-xs mt-1 max-w-xs" placeholder="dd/mm/aaaa --:--" />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="destructive" size="sm" className="text-xs gap-1">
                <Trash2 className="h-3 w-3" /> Remover
              </Button>
              <Button size="sm" className="text-xs gap-1">
                <Save className="h-3 w-3" /> Atualizar
              </Button>
            </div>
          </div>
        )}

        {/* Travel Planner */}
        {activeTab === 'travel_planner' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Travel Planner</h3>
              <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white"
                onClick={() => generateAI('travel_planner')} disabled={aiLoading === 'travel_planner'}>
                {aiLoading === 'travel_planner' ? <><Loader2 className="h-3 w-3 animate-spin" /> A gerar...</> : '🤖 Gerar com Claude AI'}
              </Button>
            </div>
            {aiResults.travel_planner ? (
              <div className="space-y-3">
                {(aiResults.travel_planner.days || []).map((day: any, i: number) => (
                  <div key={i} className="bg-card rounded-lg border p-4">
                    <p className="text-xs font-bold text-[hsl(var(--info))]">Dia {day.day}</p>
                    <p className="text-sm font-semibold text-foreground">{day.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{day.description}</p>
                    {day.activities?.map((act: any, j: number) => (
                      <div key={j} className="mt-2 pl-3 border-l-2 border-border">
                        <p className="text-xs"><span className="font-medium">{act.time}</span> — {act.activity}</p>
                        <p className="text-[11px] text-muted-foreground">{act.details}</p>
                      </div>
                    ))}
                  </div>
                ))}
                {aiResults.travel_planner.raw && (
                  <div className="bg-card rounded-lg border p-4">
                    <pre className="text-xs text-foreground whitespace-pre-wrap">{aiResults.travel_planner.raw}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg border p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">O Travel Planner será gerado automaticamente pelo Claude AI</p>
                <p className="text-xs text-muted-foreground">Com base nos dados do lead, discovery form e base de dados YT.</p>
              </div>
            )}
          </div>
        )}

        {/* Custos */}
        {activeTab === 'custos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Orçamentação & Margens</h3>
              <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white"
                onClick={() => generateAI('budget')} disabled={aiLoading === 'budget'}>
                {aiLoading === 'budget' ? <><Loader2 className="h-3 w-3 animate-spin" /> A calcular...</> : '🤖 Calcular Budget com AI'}
              </Button>
            </div>
            {aiResults.budget ? (
              <div className="space-y-4">
                {aiResults.budget.summary && (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-card rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Total NET</p>
                      <p className="text-lg font-bold text-foreground">€{aiResults.budget.summary.totalNet?.toLocaleString()}</p>
                    </div>
                    <div className="bg-card rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Margem</p>
                      <p className="text-lg font-bold text-[hsl(var(--stable))]">{aiResults.budget.summary.margin}%</p>
                    </div>
                    <div className="bg-card rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">PVP Total</p>
                      <p className="text-lg font-bold text-[hsl(var(--info))]">€{aiResults.budget.summary.totalPVP?.toLocaleString()}</p>
                    </div>
                    <div className="bg-card rounded-lg border p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Lucro</p>
                      <p className="text-lg font-bold text-[hsl(var(--stable))]">€{aiResults.budget.summary.profit?.toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {(aiResults.budget.days || []).map((day: any, i: number) => (
                  <div key={i} className="bg-card rounded-lg border overflow-hidden">
                    <div className="px-4 py-2 border-b bg-muted/50">
                      <p className="text-xs font-bold">Dia {day.day}</p>
                    </div>
                    <table className="w-full text-xs">
                      <thead><tr className="border-b text-muted-foreground">
                        <th className="text-left px-3 py-2">Atividade</th>
                        <th className="text-left px-3 py-2">Fornecedor</th>
                        <th className="text-right px-3 py-2">NET</th>
                        <th className="text-right px-3 py-2">Margem</th>
                        <th className="text-right px-3 py-2">PVP</th>
                      </tr></thead>
                      <tbody>
                        {(day.items || []).map((item: any, j: number) => (
                          <tr key={j} className="border-t">
                            <td className="px-3 py-2">{item.activity}</td>
                            <td className="px-3 py-2 text-muted-foreground">{item.supplier}</td>
                            <td className="px-3 py-2 text-right">€{item.netCost}</td>
                            <td className="px-3 py-2 text-right">{item.marginPercent}%</td>
                            <td className="px-3 py-2 text-right font-medium">€{item.pvp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {aiResults.budget.raw && (
                  <div className="bg-card rounded-lg border p-4">
                    <pre className="text-xs text-foreground whitespace-pre-wrap">{aiResults.budget.raw}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg border p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Orçamentação detalhada por dia com atividades, fornecedor, preço NET, margem %, PVP, lucro</p>
                <p className="text-xs text-muted-foreground">Claude AI consulta a base de dados de custos e calcula margens automaticamente.</p>
              </div>
            )}
          </div>
        )}

        {/* Itinerário */}
        {activeTab === 'itinerario' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Itinerário Digital (Customer-Facing)</h3>
              <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white"
                onClick={() => generateAI('digital_itinerary')} disabled={aiLoading === 'digital_itinerary'}>
                {aiLoading === 'digital_itinerary' ? <><Loader2 className="h-3 w-3 animate-spin" /> A gerar...</> : '🤖 Gerar Itinerário com AI'}
              </Button>
            </div>
            {aiResults.digital_itinerary ? (
              <div className="space-y-4">
                {aiResults.digital_itinerary.title && (
                  <div className="text-center py-4">
                    <h2 className="text-lg font-bold text-foreground">{aiResults.digital_itinerary.title}</h2>
                    {aiResults.digital_itinerary.subtitle && <p className="text-sm text-muted-foreground">{aiResults.digital_itinerary.subtitle}</p>}
                  </div>
                )}
                {(aiResults.digital_itinerary.days || []).map((day: any, i: number) => (
                  <div key={i} className="bg-card rounded-lg border p-5">
                    <p className="text-xs font-bold text-[hsl(var(--info))] uppercase">Dia {day.day}</p>
                    <p className="text-base font-semibold text-foreground mt-1">{day.title}</p>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{day.narrative}</p>
                    {day.highlights?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {day.highlights.map((h: string, j: number) => (
                          <span key={j} className="text-[10px] bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))] px-2 py-0.5 rounded-full">✨ {h}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {aiResults.digital_itinerary.raw && (
                  <div className="bg-card rounded-lg border p-4">
                    <pre className="text-xs text-foreground whitespace-pre-wrap">{aiResults.digital_itinerary.raw}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg border p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Itinerário digital customer-facing com imagens, gerado pelo Claude AI</p>
                <p className="text-xs text-muted-foreground">Versão comercial, inspiracional e visual para envio ao cliente.</p>
              </div>
            )}
          </div>
        )}

        {/* Operações */}
        {activeTab === 'operacoes' && (
          <OperacoesTab activeVersion={activeVersion} />
        )}
      </div>
    </AppLayout>
  );
};

export default LeadDetailPage;
