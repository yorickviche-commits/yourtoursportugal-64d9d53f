import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, FileText, ClipboardList, Eye, FileIcon, Mail, Clock, Loader2, ChevronDown, Plus, Copy } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useLeads } from '@/hooks/useLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import TagSelect from '@/components/TagSelect';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadStatus } from '@/types/leads';
import EditableItinerary, { ItineraryDay } from '@/components/trip/EditableItinerary';
import ItineraryEditor from '@/components/itinerary/ItineraryEditor';
import EditableCostingTable, { CostingDayData, CostingItem } from '@/components/trip/EditableCostingTable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EmailComposerDialog from '@/components/leads/EmailComposerDialog';

type DetailTab = 'dados_gerais' | 'travel_planner' | 'custos' | 'itinerario' | 'operacoes';

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'dados_gerais', label: 'Dados Gerais' },
  { key: 'travel_planner', label: 'Travel Planner' },
  { key: 'custos', label: 'Custos' },
  { key: 'itinerario', label: 'Itinerário' },
  { key: 'operacoes', label: 'Operações' },
];

const CATEGORIAS = ['Premium & Boutique', 'Standard', 'Luxury', 'Budget', 'Adventure'];
const DESTINOS = ['Porto & Douro Valley', 'Lisbon & Sintra', 'Algarve', 'Azores', 'Madeira', 'Minho', 'Alentejo', 'Silver Coast'];
const IDIOMAS = ['EN', 'PT', 'FR', 'ES', 'DE', 'IT', 'NL'];
const ORIGENS = ['website', 'AI Simulation', 'referral', 'partner', 'social_media', 'direct'];

// Mock operations data per day
const MOCK_OPS_DAYS = [
  {
    day: 1, date: '15 de maio', title: 'chegada em Lisboa e transfer do grupo para o hotel (só ida)',
    weekday: 'Friday, 15/May/2026',
    items: [
      { id: 'op1', activity: 'Transporte para todo o programa', startTime: '', endTime: '', supplier: 'Cola Limousine', pax: 0, netTotal: 3590, paid: 0, reservation: '-', payment: '-', invoice: '-' },
    ],
  },
  {
    day: 2, date: '16 de maio', title: 'city tour de dia inteiro com guia pela cidade de Lisboa',
    weekday: 'Saturday, 16/May/2026',
    items: [
      { id: 'op2', activity: 'Guia local FD', startTime: '', endTime: '', supplier: '', pax: 0, netTotal: 200, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op3', activity: 'Almoço Guia', startTime: '', endTime: '', supplier: '', pax: 0, netTotal: 20, paid: 0, reservation: '-', payment: '-', invoice: '-' },
    ],
  },
  {
    day: 3, date: '17 de maio', title: 'tour visitando Sintra, Cascais e Estoril',
    weekday: 'Sunday, 17/May/2026',
    items: [
      { id: 'op4', activity: 'Entrada Palácio Nacional de Pena', startTime: '', endTime: '', supplier: 'Parques de Sintra', pax: 10, netTotal: 200, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op5', activity: 'Transfer Palácio Nacional de Pena', startTime: '', endTime: '', supplier: 'Parques de Sintra', pax: 10, netTotal: 45, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op6', activity: 'Almoço Guia', startTime: '', endTime: '', supplier: '', pax: 0, netTotal: 15, paid: 0, reservation: '-', payment: '-', invoice: '-' },
      { id: 'op7', activity: 'Guia local FD', startTime: '', endTime: '', supplier: 'Your Tours', pax: 0, netTotal: 200, paid: 0, reservation: '-', payment: '-', invoice: '-' },
    ],
  },
];

const OperacoesTab = ({ activeVersion }: { activeVersion: number }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const toggleCheck = (id: string) => setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Operações</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Baseado na versão aceite (V{activeVersion})</span>
          <Button variant="outline" size="sm" className="text-xs gap-1"><ClipboardList className="h-3 w-3" /> Briefing FSEs</Button>
          <Button variant="outline" size="sm" className="text-xs gap-1"><FileText className="h-3 w-3" /> Briefing Cliente</Button>
        </div>
      </div>
      {MOCK_OPS_DAYS.map(day => (
        <div key={day.day} className="bg-card rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold text-[hsl(var(--info))]">Dia {day.day}.</p>
            <p className="text-sm font-bold text-[hsl(var(--info))]">{day.date} – {day.title}</p>
            <p className="text-[10px] text-muted-foreground">{day.weekday}</p>
          </div>
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
                      <input type="checkbox" checked={!!checkedItems[item.id]} onChange={() => toggleCheck(item.id)} className="h-3.5 w-3.5 rounded border-border" />
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
                    <td className="px-3 py-3 text-center"><Input className="h-6 text-[10px] w-16 mx-auto" defaultValue={item.paid} /></td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{item.reservation}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{item.payment}</td>
                    <td className="px-3 py-3 text-center"><Eye className="h-3.5 w-3.5 text-[hsl(var(--info))] mx-auto cursor-pointer" /></td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
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
  const navigate = useNavigate();
  const { leads, updateLead, addLead, generateId, removeLead } = useLeads();
  const lead = leads.find(l => l.id === id);
  const [activeTab, setActiveTab] = useState<DetailTab>('dados_gerais');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, any>>({});
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([]);
  const [costingDays, setCostingDays] = useState<CostingDayData[]>([]);
  const [finalPrice, setFinalPrice] = useState(0);
  const { toast } = useToast();

  // Editable form state - initialized from lead
  const [formState, setFormState] = useState(() => ({
    clientName: lead?.clientName || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    travelDates: lead?.travelDates || '',
    travelEndDate: lead?.travelEndDate || '',
    numberOfDays: lead?.numberOfDays || 0,
    datesType: lead?.datesType || 'estimated' as 'concrete' | 'estimated' | 'flexible',
    pax: lead?.pax || 2,
    paxChildren: lead?.paxChildren || 0,
    paxInfants: lead?.paxInfants || 0,
    budgetLevel: lead?.budgetLevel || '',
    notes: lead?.notes || '',
    salesOwner: lead?.salesOwner || '',
  }));

  const [leadStatus, setLeadStatus] = useState<LeadStatus>(lead?.status || 'new');
  const [categoria, setCategoria] = useState<string[]>(lead?.comfortLevel ? [lead.comfortLevel] : []);
  const [destino, setDestino] = useState<string[]>(lead?.destination ? lead.destination.split(', ').filter(Boolean) : []);
  const [idioma, setIdioma] = useState<string[]>(['EN']);
  const [origem, setOrigem] = useState<string[]>(lead?.source === 'ai_simulation' ? ['AI Simulation'] : lead?.source ? [lead.source] : []);
  const [travelStyles, setTravelStyles] = useState<string[]>(lead?.travelStyle || []);
  const [activeVersion, setActiveVersion] = useState(lead?.activeVersion || 0);

  const updateFormField = (key: string, value: any) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };

  // Save / Update lead
  const handleSave = useCallback(() => {
    if (!lead) return;
    updateLead(lead.id, {
      clientName: formState.clientName,
      email: formState.email,
      phone: formState.phone || undefined,
      travelDates: formState.travelDates,
      travelEndDate: formState.travelEndDate || undefined,
      numberOfDays: formState.numberOfDays || undefined,
      datesType: formState.datesType,
      pax: formState.pax,
      paxChildren: formState.paxChildren,
      paxInfants: formState.paxInfants,
      budgetLevel: formState.budgetLevel,
      notes: formState.notes || undefined,
      salesOwner: formState.salesOwner,
      status: leadStatus,
      destination: destino.join(', ') || 'A definir',
      comfortLevel: categoria[0] || undefined,
      travelStyle: travelStyles,
      source: (origem[0]?.toLowerCase().replace(/ /g, '_') || lead.source) as any,
    });
    toast({ title: 'Simulação guardada!', description: `${formState.clientName} atualizado com sucesso.` });
  }, [lead, formState, leadStatus, destino, categoria, travelStyles, origem, updateLead, toast]);

  // Duplicate - creates a new lead with a new ID and all the same data
  const handleDuplicate = useCallback(() => {
    if (!lead) return;
    const newId = generateId();
    addLead({
      ...lead,
      id: newId,
      createdAt: new Date().toISOString(),
      activeVersion: 0,
    });
    toast({ title: `Lead duplicada!`, description: `Nova simulação ${newId} criada.` });
    navigate(`/leads/${newId}`);
  }, [lead, generateId, addLead, navigate, toast]);

  // New version - increments version within the same lead
  const handleNewVersion = useCallback(() => {
    if (!lead) return;
    const newVersion = activeVersion + 1;
    setActiveVersion(newVersion);
    updateLead(lead.id, { activeVersion: newVersion });
    toast({ title: `Versão V${newVersion} criada`, description: 'Dados da versão anterior copiados.' });
  }, [lead, activeVersion, updateLead, toast]);

  // Remove lead
  const handleRemove = useCallback(() => {
    if (!lead) return;
    removeLead(lead.id);
    toast({ title: 'Simulação removida' });
    navigate('/leads');
  }, [lead, removeLead, navigate, toast]);

  const generateAI = async (type: 'travel_planner' | 'budget' | 'digital_itinerary') => {
    if (!lead) return;
    setAiLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          leadData: {
            clientName: formState.clientName,
            destination: destino.join(', '),
            travelDates: formState.travelDates + (formState.travelEndDate ? ` - ${formState.travelEndDate}` : ''),
            pax: formState.pax,
            travelStyles: travelStyles,
            comfortLevel: categoria[0] || '',
            budgetLevel: formState.budgetLevel,
            magicQuestion: lead.magicQuestion,
            notes: formState.notes,
            numberOfDays: formState.numberOfDays || undefined,
          },
          type,
        },
      });
      if (error) throw error;
      setAiResults(prev => ({ ...prev, [type]: data.result }));

      if (type === 'travel_planner' && data.result.days) {
        setItineraryDays(data.result.days.map((d: any, i: number) => ({
          day: d.day || i + 1,
          title: d.title || '',
          description: d.description || '',
          images: [],
          activities: d.activities || [],
        })));
      }
      if (type === 'budget' && data.result.days) {
        setCostingDays(data.result.days.map((d: any, i: number) => ({
          day: d.day || i + 1,
          title: `Dia ${d.day || i + 1}`,
          items: (d.items || []).map((item: any, j: number) => {
            const netCost = item.netCost || 0;
            const marginPercent = item.marginPercent || 30;
            const pvp = netCost * (1 + marginPercent / 100);
            return {
              id: `cost-${i}-${j}`,
              activity: item.activity || '',
              supplier: item.supplier || '',
              nrPeople: formState.pax || 1,
              netCost,
              marginPercent,
              pvp: Math.round(pvp * 100) / 100,
              totalPrice: Math.round(pvp * formState.pax * 100) / 100,
              pricePerPerson: Math.round(pvp * 100) / 100,
            };
          }),
        })));
        if (data.result.summary?.totalPVP) setFinalPrice(data.result.summary.totalPVP);
      }

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
                {lead.id} - {formState.email} - {destino.join(', ') || lead.destination} - adt:{formState.pax} - chl:{formState.paxChildren} - inf:{formState.paxInfants}
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
                NOT PAID 0€ - {formState.budgetLevel}
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
            <EmailComposerDialog lead={{
              clientName: formState.clientName,
              email: formState.email,
              phone: formState.phone,
              destination: destino.join(', '),
              travelDates: formState.travelDates,
              pax: formState.pax,
              status: leadStatus,
              budgetLevel: formState.budgetLevel,
              travelStyle: travelStyles,
              comfortLevel: categoria[0],
              magicQuestion: lead.magicQuestion,
              notes: formState.notes,
              leadId: lead.id,
            }}>
              <button className="text-xs text-[hsl(var(--info))] hover:text-foreground transition-colors font-medium flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </button>
            </EmailComposerDialog>
            {['Tasks', 'Notas'].map(tab => (
              <button key={tab} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{tab}</button>
            ))}
          </div>
        </div>

        {/* Dados Gerais */}
        {activeTab === 'dados_gerais' && (
          <div className="space-y-6">
            {/* Version selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: activeVersion + 1 }, (_, i) => i).map(v => (
                  <button key={v} onClick={() => setActiveVersion(v)}
                    className={cn("px-2.5 py-1 text-xs rounded border transition-colors",
                      activeVersion === v ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground hover:text-foreground"
                    )}>
                    V{v}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">🔒 Versão · V{activeVersion}</span>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleDuplicate}>
                <Copy className="h-3 w-3" /> Duplicar
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleNewVersion}>
                <Plus className="h-3 w-3" /> Nova Versão
              </Button>
            </div>

            {/* Informação geral */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Informação geral</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº VI</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.id} readOnly />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Criador da Simulação</label>
                  <Input className="h-8 text-xs mt-1" value={formState.salesOwner} onChange={e => updateFormField('salesOwner', e.target.value)} />
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
                  <Input className="h-8 text-xs mt-1" value={formState.clientName} onChange={e => updateFormField('clientName', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">E-mail</label>
                  <Input className="h-8 text-xs mt-1" type="email" value={formState.email} onChange={e => updateFormField('email', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Telefone</label>
                  <Input className="h-8 text-xs mt-1" value={formState.phone} onChange={e => updateFormField('phone', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Dados da viagem */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados da viagem</h3>
              <div className="grid grid-cols-3 gap-4">
                <TagSelect label="Categoria" value={categoria} options={CATEGORIAS} onChange={setCategoria} />
                <TagSelect label="Destino" value={destino} options={DESTINOS} onChange={setDestino} multiple />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Tipo de Datas</label>
                  <div className="flex gap-1 mt-1">
                    {(['concrete', 'estimated', 'flexible'] as const).map(dt => (
                      <button key={dt} onClick={() => updateFormField('datesType', dt)}
                        className={cn("px-2.5 py-1.5 text-[10px] rounded border transition-colors",
                          formState.datesType === dt
                            ? dt === 'concrete' ? "bg-[hsl(var(--success))] text-white border-[hsl(var(--success))]"
                            : dt === 'estimated' ? "bg-[hsl(var(--warning))] text-white border-[hsl(var(--warning))]"
                            : "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]"
                            : "border-border text-muted-foreground"
                        )}>
                        {dt === 'concrete' ? 'Concretas' : dt === 'estimated' ? 'Estimadas' : 'Flexível (dias)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date fields - conditional */}
              <div className="grid grid-cols-3 gap-4 mt-3">
                {formState.datesType !== 'flexible' ? (
                  <>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Data Início</label>
                      <Input className="h-8 text-xs mt-1" type="date" value={formState.travelDates} onChange={e => updateFormField('travelDates', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Data Fim</label>
                      <Input className="h-8 text-xs mt-1" type="date" value={formState.travelEndDate} onChange={e => updateFormField('travelEndDate', e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nº de Dias</label>
                    <Input className="h-8 text-xs mt-1" type="number" min={1} value={formState.numberOfDays} onChange={e => updateFormField('numberOfDays', parseInt(e.target.value) || 0)} />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de adultos</label>
                  <Input className="h-8 text-xs mt-1" type="number" value={formState.pax} onChange={e => updateFormField('pax', parseInt(e.target.value) || 1)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de jovens</label>
                  <Input className="h-8 text-xs mt-1" type="number" value={formState.paxChildren} onChange={e => updateFormField('paxChildren', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de crianças</label>
                  <Input className="h-8 text-xs mt-1" type="number" value={formState.paxInfants} onChange={e => updateFormField('paxInfants', parseInt(e.target.value) || 0)} />
                </div>
                <TagSelect label="Idioma" value={idioma} options={IDIOMAS} onChange={setIdioma} />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Budget total da viagem (€)</label>
                  <Input className="h-8 text-xs mt-1" value={formState.budgetLevel} onChange={e => updateFormField('budgetLevel', e.target.value)} />
                </div>
                <TagSelect label="Origem do Itinerário" value={origem} options={ORIGENS} onChange={setOrigem} />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Desconto</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
              </div>
            </div>

            {/* Travel styles */}
            <TagSelect label="Estilos de viagem" value={travelStyles}
              options={['Food & Wine', 'Culture & History', 'Nature & Adventure', 'Beach & Relax', 'City Break', 'Road Trip', 'Wellness', 'Photography']}
              onChange={setTravelStyles} multiple />

            {/* Magic question */}
            {lead.magicQuestion && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">✨ O que tornaria esta viagem inesquecível?</h3>
                <p className="text-sm text-foreground italic">"{lead.magicQuestion}"</p>
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Preferências / Notas</label>
              <Textarea className="mt-1 text-xs" rows={3} value={formState.notes} onChange={e => updateFormField('notes', e.target.value)} />
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
              <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={handleRemove}>
                <Trash2 className="h-3 w-3" /> Remover
              </Button>
              <Button size="sm" className="text-xs gap-1" onClick={handleSave}>
                <Save className="h-3 w-3" /> Guardar
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
                {aiLoading === 'travel_planner' ? <><Loader2 className="h-3 w-3 animate-spin" /> A gerar...</> : '🤖 Gerar com AI'}
              </Button>
            </div>
            {/* Context summary */}
            <div className="bg-muted/50 rounded-lg border p-3 text-xs space-y-1">
              <p><span className="font-medium">Cliente:</span> {formState.clientName} · <span className="font-medium">Destino:</span> {destino.join(', ') || 'A definir'}</p>
              <p><span className="font-medium">Datas:</span> {formState.datesType === 'flexible' ? `${formState.numberOfDays} dias` : `${formState.travelDates}${formState.travelEndDate ? ` → ${formState.travelEndDate}` : ''}`} · <span className="font-medium">Pax:</span> {formState.pax} adt + {formState.paxChildren} chl</p>
              <p><span className="font-medium">Estilos:</span> {travelStyles.join(', ') || '—'} · <span className="font-medium">Categoria:</span> {categoria[0] || '—'}</p>
            </div>
            {itineraryDays.length > 0 ? (
              <EditableItinerary days={itineraryDays} onChange={setItineraryDays} />
            ) : (
              <div className="bg-card rounded-lg border p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">O Travel Planner será gerado automaticamente pela AI</p>
                <p className="text-xs text-muted-foreground">Com base nos dados do lead, discovery form e base de dados YT.</p>
                <p className="text-xs text-muted-foreground mt-2">Ou adicione dias manualmente:</p>
                <Button variant="outline" size="sm" className="text-xs gap-1 mt-2" onClick={() => setItineraryDays([{ day: 1, title: '', description: '', images: [] }])}>
                  <Plus className="h-3 w-3" /> Começar Itinerário
                </Button>
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
            {costingDays.length > 0 ? (
              <EditableCostingTable days={costingDays} onChange={setCostingDays} finalPrice={finalPrice} onFinalPriceChange={setFinalPrice} />
            ) : (
              <div className="bg-card rounded-lg border p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Orçamentação detalhada por dia</p>
                <p className="text-xs text-muted-foreground">AI consulta a base de dados de custos e calcula margens automaticamente.</p>
                <Button variant="outline" size="sm" className="text-xs gap-1 mt-2" onClick={() => setCostingDays([{ day: 1, title: 'Dia 1', items: [] }])}>
                  <Plus className="h-3 w-3" /> Começar Costing Manual
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Itinerário */}
        {activeTab === 'itinerario' && (
          <ItineraryEditor
            leadId={lead.id}
            clientName={formState.clientName}
            destination={destino.join(', ') || lead.destination}
            travelDates={formState.travelDates}
            travelPlannerDays={itineraryDays.length > 0 ? itineraryDays : undefined}
          />
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
