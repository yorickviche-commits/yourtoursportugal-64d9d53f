import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, FileText, ClipboardList, Eye, FileIcon, Mail, Clock, Loader2, ChevronDown, ChevronRight, Plus, Copy, Upload, ExternalLink } from 'lucide-react';
// AgentPipelineButton removed from header
import AppLayout from '@/components/AppLayout';
import { useLeadQuery, useUpdateLead, useCreateLead, useDeleteLead } from '@/hooks/useLeadsQuery';
import { logActivity } from '@/hooks/useActivityLog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import TagSelect from '@/components/TagSelect';
import { normalizeClientType } from '@/components/ClientTypeBadge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadStatus } from '@/types/leads';
import TravelPlannerEditor, { PlannerDay, PlannerItem, PeriodKey, emptyPeriods, genId } from '@/components/trip/TravelPlannerEditor';
import TravelPlanProposal from '@/components/trip/TravelPlanProposal';
import LeadAgentsAssignment from '@/components/LeadAgentsAssignment';
import { LeadContextAttachments } from '@/components/leads/LeadContextAttachments';
import { useProposalsListQuery, useProposalAnnotations } from '@/hooks/useProposalsQuery';
import { toast as sonnerToast } from 'sonner';
// ItineraryEditor removed — replaced by Propostas tab
import EditableCostingTable, { CostingDayData, CostingItem } from '@/components/trip/EditableCostingTable';
import LeadCostingEditor, { LeadCostingDay, LeadCostItem } from '@/components/trip/LeadCostingEditor';
import { useUndoable } from '@/hooks/useUndoable';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// EmailComposerDialog now embedded inside CommunicationsTab
import { PaymentsDialog, usePaymentsSummary } from '@/components/leads/PaymentsDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ItemNotesDialog from '@/components/trip/ItemNotesDialog';
import BookingRequestDialog from '@/components/trip/BookingRequestDialog';
import { useLeadOperationsQuery, useUpsertLeadOperation, DbLeadOperation } from '@/hooks/useLeadOperationsQuery';
import LeadOperationsEditor from '@/components/leads/LeadOperationsEditor';

import BookingEmailHistory from '@/components/trip/BookingEmailHistory';
import CommunicationsTab from '@/components/communications/CommunicationsTab';
import { getProposalShareUrl } from '@/lib/proposalShare';
import { displayLeadCode } from '@/lib/leadCode';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { triggerCalendarSync } from '@/hooks/useCalendarSync';
import CalendarSyncBadge from '@/components/CalendarSyncBadge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
} from '@/components/ui/alert-dialog';

type DetailTab = 'dados_gerais' | 'travel_planner' | 'custos' | 'propostas' | 'operacoes' | 'comunicacoes';

const BASE_DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'dados_gerais', label: 'Dados Gerais' },
  { key: 'travel_planner', label: 'Travel Planner' },
  { key: 'custos', label: 'Custos' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'comunicacoes', label: 'Comunicações' },
];

const getDetailTabs = (status: string, mode: 'lead' | 'booking' = 'lead'): { key: DetailTab; label: string }[] => {
  if (mode === 'booking') {
    return [
      { key: 'dados_gerais', label: 'Dados Gerais' },
      { key: 'travel_planner', label: 'Travel Plan' },
      { key: 'custos', label: 'Custos' },
      { key: 'operacoes', label: 'Operações' },
      { key: 'comunicacoes', label: 'Comunicações' },
    ];
  }
  if (status === 'won') {
    return [
      ...BASE_DETAIL_TABS.slice(0, 4),
      { key: 'operacoes', label: 'Operações' },
      ...BASE_DETAIL_TABS.slice(4),
    ];
  }
  return BASE_DETAIL_TABS;
};

const CATEGORIAS = ['Premium & Boutique', 'Standard', 'Luxury', 'Budget', 'Adventure'];
const DESTINOS = ['Porto & Douro Valley', 'Lisbon & Sintra', 'Algarve', 'Azores', 'Madeira', 'Minho', 'Alentejo', 'Silver Coast'];
const IDIOMAS = ['EN', 'PT', 'FR', 'ES', 'DE', 'IT', 'NL'];
const ORIGENS = ['website', 'AI Simulation', 'referral', 'partner', 'social_media', 'direct'];

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function MonthYearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Parse existing value — could be "2026-05" or a date string or "Maio 2026"
  const now = new Date();
  let selectedMonth = now.getMonth();
  let selectedYear = now.getFullYear();

  if (value) {
    // Try YYYY-MM format
    const ym = value.match(/^(\d{4})-(\d{2})/);
    if (ym) { selectedYear = parseInt(ym[1]); selectedMonth = parseInt(ym[2]) - 1; }
    else {
      // Try "Month Year" format
      const mi = MONTHS.findIndex(m => value.toLowerCase().includes(m.toLowerCase()));
      if (mi >= 0) selectedMonth = mi;
      const yr = value.match(/\d{4}/);
      if (yr) selectedYear = parseInt(yr[0]);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);

  return (
    <div className="flex gap-1.5">
      <select
        className="h-8 text-xs border rounded-md px-2 bg-background flex-1"
        value={selectedMonth}
        onChange={e => {
          const m = parseInt(e.target.value);
          onChange(`${selectedYear}-${String(m + 1).padStart(2, '0')}`);
        }}
      >
        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select
        className="h-8 text-xs border rounded-md px-2 bg-background w-[80px]"
        value={selectedYear}
        onChange={e => {
          const y = parseInt(e.target.value);
          onChange(`${y}-${String(selectedMonth + 1).padStart(2, '0')}`);
        }}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

const OperacoesTab = LeadOperationsEditor;


const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'Novo', color: 'bg-muted text-muted-foreground' },
  { value: 'contacted', label: 'Contactado', color: 'bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]' },
  { value: 'qualified', label: 'Qualificado', color: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' },
  { value: 'proposal_sent', label: 'Proposta Enviada', color: 'bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]' },
  { value: 'negotiation', label: 'Negociação', color: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]' },
  { value: 'won', label: 'Ganho ✓', color: 'bg-[hsl(var(--stable)/0.15)] text-[hsl(var(--stable))]' },
  { value: 'lost', label: 'Perdido', color: 'bg-destructive/15 text-destructive' },
];

const statusColors: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  revision_requested: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-purple-100 text-purple-700',
};
const statusLabels: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviada', approved: 'Aprovada',
  revision_requested: 'Alterações pedidas', confirmed: 'Confirmada',
};

const ProposalAnnotationsPreview = ({ proposalId }: { proposalId: string }) => {
  const { data: annotations = [] } = useProposalAnnotations(proposalId);
  const unresolved = annotations.filter(a => !a.is_resolved && !a.parent_id);
  const clientNotes = unresolved.filter(a => a.author_type === 'client');
  const teamNotes = unresolved.filter(a => a.author_type === 'ytp_team');

  if (annotations.length === 0) return <p className="text-xs text-muted-foreground italic">Sem comentários</p>;

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center gap-3 text-xs">
        {clientNotes.length > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {clientNotes.length} nota{clientNotes.length > 1 ? 's' : ''} do cliente
          </span>
        )}
        {teamNotes.length > 0 && (
          <span className="flex items-center gap-1 text-blue-600">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {teamNotes.length} resposta{teamNotes.length > 1 ? 's' : ''} YTP
          </span>
        )}
        {unresolved.length === 0 && annotations.length > 0 && (
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Tudo resolvido
          </span>
        )}
      </div>
      {clientNotes.slice(0, 3).map(a => (
        <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-amber-800">{a.author_name}</span>
            <span className="text-amber-500 text-[10px]">{new Date(a.created_at).toLocaleDateString('pt-PT')}</span>
          </div>
          <p className="text-amber-900 line-clamp-2">{a.content}</p>
          {a.level !== 'proposal' && (
            <span className="text-[10px] mt-1 inline-block bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              {a.level === 'day' ? `Dia ${(a.target_day_index ?? 0) + 1}` : `Dia ${(a.target_day_index ?? 0) + 1} › Item ${(a.target_item_index ?? 0) + 1}`}
            </span>
          )}
        </div>
      ))}
      {clientNotes.length > 3 && (
        <p className="text-[10px] text-muted-foreground">+{clientNotes.length - 3} mais comentários...</p>
      )}
    </div>
  );
};

const LeadProposalsTab = ({ leadId, clientName }: { leadId: string; clientName: string }) => {
  const { data: allProposals = [], isLoading } = useProposalsListQuery();
  const proposals = allProposals.filter(p => p.lead_id === leadId);
  const navigate = useNavigate();

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getProposalShareUrl(token));
    sonnerToast.success('Link copiado!');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Links & Feedback do Cliente</h2>
      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">A carregar...</div>
      ) : proposals.length === 0 ? (
        <div className="bg-muted/30 rounded-xl border border-border p-6 text-center space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Nenhuma proposta gerada ainda.</p>
          <p className="text-xs text-muted-foreground">Guarda o Travel Planner para gerar automaticamente o link público da proposta.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <div key={p.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[p.status] || statusColors.draft)}>
                      {statusLabels[p.status] || p.status}
                    </span>
                    {p.sent_at && <span className="text-[10px] text-muted-foreground">Enviada {new Date(p.sent_at).toLocaleDateString('pt-PT')}</span>}
                  </div>
                  <h3 className="text-sm font-semibold truncate">{p.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {p.date_range && <span>{p.date_range}</span>}
                    {p.participants && <span>• {p.participants}</span>}
                  </div>
                </div>
              </div>

              {/* Public link — prominent */}
              <div className="mt-3 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                <ExternalLink className="h-4 w-4 text-primary shrink-0" />
                <code className="text-[11px] text-primary truncate flex-1 font-medium">{getProposalShareUrl(p.public_token)}</code>
                <button onClick={() => copyLink(p.public_token)} className="p-1.5 hover:bg-primary/10 rounded-md shrink-0" title="Copiar link">
                  <Copy className="h-3.5 w-3.5 text-primary" />
                </button>
                <a href={getProposalShareUrl(p.public_token)} target="_blank" rel="noopener" className="p-1.5 hover:bg-primary/10 rounded-md shrink-0" title="Abrir proposta">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                </a>
              </div>

              {/* Annotations preview */}
              <ProposalAnnotationsPreview proposalId={p.id} />

              {/* Actions */}
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate(`/proposals/${p.id}`)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver detalhes & responder
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/proposals/${p.id}/edit`)}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> Editar proposta
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LeadDetailPage = ({ mode = 'lead' }: { mode?: 'lead' | 'booking' } = {}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLeadQuery(id);
  const updateLeadMutation = useUpdateLead();
  const createLeadMutation = useCreateLead();
  const deleteLeadMutation = useDeleteLead();
  const [activeTab, setActiveTab] = useState<DetailTab>('dados_gerais');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, any>>({});
  const [plannerDays, setPlannerDays] = useState<PlannerDay[]>([]);
  const costingUndo = useUndoable<LeadCostingDay[]>([], {
    bindKeyboard: activeTab === 'custos',
    onUndo: () => sonnerToast.info('Alteração desfeita', { description: 'Ctrl+Shift+Z para refazer' }),
    onRedo: () => sonnerToast.info('Alteração refeita'),
  });
  const costingDays = costingUndo.state;
  const setCostingDays = costingUndo.set;
  const [pvpOverride, setPvpOverride] = useState<number | null>(null);
  const costingTotalPVP = useMemo(() => {
    if (pvpOverride != null) return pvpOverride;
    return costingDays.reduce((sum, d) => sum + (d.items || [])
      .filter((i: any) => i.status !== 'eliminar')
      .reduce((s: number, i: any) => s + (Number(i.pvpTotal) || 0), 0), 0);
  }, [costingDays, pvpOverride]);
  // plannerSubTab removed — unified view
  const [finalPrice, setFinalPrice] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load persisted planner data
  const { data: savedPlannerDays } = useQuery({
    queryKey: ['lead_planner', id, lead?.active_version],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('lead_planner_data')
        .select('*')
        .eq('lead_id', id)
        .eq('version', lead?.active_version ?? 0)
        .order('day_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!lead,
  });

  // Accommodation block (Costing day 0) shown to the client when not hidden.
  const proposalAccommodation = useMemo(() => {
    const acc = costingDays.find(d => d.day === 0);
    if (!acc || acc.date === 'hidden') return [];
    return (acc.items || [])
      .filter(i => i.status !== 'eliminar' && (i.description || '').trim())
      .map(i => ({
        name: i.description.trim(),
        nights: i.pricingType === 'per_night' ? Number(i.numAdults) || 0 : 0,
      }));
  }, [costingDays]);

  // Load persisted costing data
  const { data: savedCostingDays } = useQuery({
    queryKey: ['lead_costing', id, lead?.active_version],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('lead_costing_data')
        .select('*')
        .eq('lead_id', id)
        .eq('version', lead?.active_version ?? 0)
        .order('day_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!lead,
  });

  // Hydrate planner from DB
  useEffect(() => {
    if (savedPlannerDays && savedPlannerDays.length > 0 && plannerDays.length === 0) {
      setPlannerDays(savedPlannerDays.map((d: any) => {
        // If saved with period structure
        if (d.activities && typeof d.activities === 'object' && !Array.isArray(d.activities) && d.activities.morning) {
          return {
            day: d.day_number,
            title: d.title || '',
            date: d.description || '',
            periods: {
              morning: { label: 'Manhã', items: (d.activities.morning?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
              lunch: { label: 'Almoço', items: (d.activities.lunch?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
              afternoon: { label: 'Tarde', items: (d.activities.afternoon?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
              night: { label: 'Noite', items: (d.activities.night?.items || []).map((it: any) => ({ ...it, id: it.id || genId() })) },
            },
          };
        }
        // Legacy flat activities format
        const legacyItems = Array.isArray(d.activities) ? d.activities : [];
        return {
          day: d.day_number,
          title: d.title || '',
          date: d.description || '',
          periods: {
            morning: { label: 'Manhã', items: legacyItems.filter((_: any, i: number) => i === 0).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
            lunch: { label: 'Almoço', items: legacyItems.filter((_: any, i: number) => i === 1).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
            afternoon: { label: 'Tarde', items: legacyItems.filter((_: any, i: number) => i === 2).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
            night: { label: 'Noite', items: legacyItems.filter((_: any, i: number) => i >= 3).map((a: any) => ({ id: genId(), title: a.activity || a.title || '', description: a.details || a.description || '', location: a.location || '', duration: a.duration || a.time || '' })) },
          },
        };
      }));
    }
  }, [savedPlannerDays]);

  // Hydrate costing from DB
  useEffect(() => {
    if (savedCostingDays && savedCostingDays.length > 0 && costingDays.length === 0) {
      costingUndo.reset(savedCostingDays.map((d: any) => ({
        day: d.day_number,
        title: d.title || `Dia ${d.day_number}`,
        date: d.description || '',
        items: Array.isArray(d.items) ? d.items.map((item: any) => ({
          id: item.id || `ci-${Math.random().toString(36).slice(2, 7)}`,
          description: item.description || item.activity || '',
          supplier: item.supplier || '',
          pricingType: item.pricingType || 'total',
          numAdults: item.numAdults ?? item.nrPeople ?? 0,
          priceAdults: item.priceAdults ?? item.netCost ?? 0,
          numChildren: item.numChildren ?? 0,
          priceChildren: item.priceChildren ?? 0,
          netTotal: item.netTotal ?? 0,
          marginPercent: item.marginPercent ?? 30,
          pvpTotal: item.pvpTotal ?? item.pvp ?? 0,
          profit: item.profit ?? 0,
          status: item.status || 'neutro',
          notes: item.notes || [],
        })) : [],
      })));
    }
  }, [savedCostingDays]);

  const [formState, setFormState] = useState({
    ytId: '',
    clientName: '', email: '', phone: '', travelDates: '', travelEndDate: '',
    numberOfDays: 0, datesType: 'estimated' as 'concrete' | 'estimated' | 'flexible',
    pax: 2, paxChildren: 0, paxInfants: 0, budgetLevel: '', notes: '', salesOwner: '',
    clientType: 'B2C' as 'B2C' | 'B2B',
  });
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('new');
  const [categoria, setCategoria] = useState<string[]>([]);
  const [destino, setDestino] = useState<string[]>([]);
  const [idioma, setIdioma] = useState<string[]>(['EN']);
  const [origem, setOrigem] = useState<string[]>([]);
  const [travelStyles, setTravelStyles] = useState<string[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);

  // Save planner data to DB
  const savePlannerData = useCallback(async (days: PlannerDay[]) => {
    if (!id || !lead) return;
    try {
      await supabase.from('lead_planner_data').delete().eq('lead_id', id).eq('version', activeVersion);
      if (days.length > 0) {
        await supabase.from('lead_planner_data').insert(
          days.map(d => ({
            lead_id: id,
            version: activeVersion,
            day_number: d.day,
            title: d.title,
            description: d.date || '',
            activities: d.periods as any,
            images: [] as any,
          }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['lead_planner', id] });
    } catch (e) {
      console.error('Failed to save planner data:', e);
    }
  }, [id, lead, activeVersion, queryClient]);

  // Save costing data to DB
  const saveCostingData = useCallback(async (days: LeadCostingDay[]) => {
    if (!id || !lead) return;
    try {
      await supabase.from('lead_costing_data').delete().eq('lead_id', id).eq('version', activeVersion);
      if (days.length > 0) {
        await supabase.from('lead_costing_data').insert(
          days.map(d => ({
            lead_id: id,
            version: activeVersion,
            day_number: d.day,
            title: d.title,
            items: (d.items || []) as any,
          }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['lead_costing', id] });
    } catch (e) {
      console.error('Failed to save costing data:', e);
    }
  }, [id, lead, activeVersion, queryClient]);

  // Sync form from DB lead
  useEffect(() => {
    if (!lead) return;
    setFormState({
      ytId: (lead as any).yt_id || '',
      clientName: lead.client_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      travelDates: lead.travel_dates || '',
      travelEndDate: lead.travel_end_date || '',
      numberOfDays: lead.number_of_days || 0,
      datesType: (lead.dates_type as any) || 'estimated',
      pax: lead.pax || 2,
      paxChildren: lead.pax_children || 0,
      paxInfants: lead.pax_infants || 0,
      budgetLevel: lead.budget_level || '',
      notes: lead.notes || '',
      salesOwner: lead.sales_owner || '',
      clientType: normalizeClientType((lead as any).client_type),
    });
    setLeadStatus((lead.status as LeadStatus) || 'new');
    setCategoria(lead.comfort_level ? [lead.comfort_level] : []);
    setDestino(lead.destination ? lead.destination.split(', ').filter(Boolean) : []);
    setOrigem(lead.source === 'ai_simulation' ? ['AI Simulation'] : lead.source ? [lead.source] : []);
    setTravelStyles(Array.isArray(lead.travel_style) ? lead.travel_style : []);
    setActiveVersion(lead.active_version || 0);
    const savedOverride = (lead as any).pvp_override;
    setPvpOverride(savedOverride != null ? Number(savedOverride) : null);
  }, [lead]);

  const updateFormField = (key: string, value: any) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!lead) return;
    try {
      await updateLeadMutation.mutateAsync({
        id: lead.id,
        updates: {
          client_name: formState.clientName,
          yt_id: formState.ytId || null,
          email: formState.email,
          phone: formState.phone,
          travel_dates: formState.travelDates,
          travel_end_date: formState.travelEndDate,
          number_of_days: formState.numberOfDays,
          dates_type: formState.datesType,
          pax: formState.pax,
          pax_children: formState.paxChildren,
          pax_infants: formState.paxInfants,
          budget_level: formState.budgetLevel,
          notes: formState.notes,
          sales_owner: formState.salesOwner,
          client_type: formState.clientType,
          status: leadStatus,
          destination: destino.join(', ') || 'A definir',
          comfort_level: categoria[0] || '',
          travel_style: travelStyles,
          source: (origem[0]?.toLowerCase().replace(/ /g, '_') || lead.source) as any,
          active_version: activeVersion,
        },
      });
      await logActivity('lead_updated', 'lead', lead.id, { client_name: formState.clientName });
      toast({ title: 'Simulação guardada!', description: `${formState.clientName} atualizado com sucesso.` });
      if (leadStatus === 'won') triggerCalendarSync(lead.id, 'update');
    } catch (err: any) {
      toast({ title: 'Erro ao guardar', description: err.message, variant: 'destructive' });
    }
  }, [lead, formState, leadStatus, destino, categoria, travelStyles, origem, activeVersion, updateLeadMutation, toast]);

  // Dirty tracking — deteta alterações por gravar no formulário / tags / versão
  const isDirty = useMemo(() => {
    if (!lead) return false;
    const l: any = lead;
    if ((l.yt_id || '') !== formState.ytId) return true;
    if ((l.client_name || '') !== formState.clientName) return true;
    if ((l.email || '') !== formState.email) return true;
    if ((l.phone || '') !== formState.phone) return true;
    if ((l.travel_dates || '') !== formState.travelDates) return true;
    if ((l.travel_end_date || '') !== formState.travelEndDate) return true;
    if ((l.number_of_days || 0) !== formState.numberOfDays) return true;
    if ((l.dates_type || 'estimated') !== formState.datesType) return true;
    if ((l.pax || 2) !== formState.pax) return true;
    if ((l.pax_children || 0) !== formState.paxChildren) return true;
    if ((l.pax_infants || 0) !== formState.paxInfants) return true;
    if ((l.budget_level || '') !== formState.budgetLevel) return true;
    if ((l.notes || '') !== formState.notes) return true;
    if ((l.sales_owner || '') !== formState.salesOwner) return true;
    if (normalizeClientType((l as any).client_type) !== formState.clientType) return true;
    if ((l.comfort_level || '') !== (categoria[0] || '')) return true;
    const savedDest = (l.destination ? String(l.destination).split(', ').filter(Boolean) : []).join('|');
    if (savedDest !== destino.join('|')) return true;
    const savedStyles = Array.isArray(l.travel_style) ? l.travel_style.join('|') : '';
    if (savedStyles !== travelStyles.join('|')) return true;
    if ((l.active_version || 0) !== activeVersion) return true;
    return false;
  }, [lead, formState, categoria, destino, travelStyles, activeVersion]);

  const guard = useUnsavedChangesGuard(isDirty, handleSave);

  const handleDuplicate = useCallback(async () => {
    if (!lead) return;
    try {
      const newLead = await createLeadMutation.mutateAsync({
        client_name: lead.client_name,
        email: lead.email,
        phone: lead.phone,
        destination: lead.destination,
        travel_dates: lead.travel_dates,
        travel_end_date: lead.travel_end_date,
        number_of_days: lead.number_of_days,
        dates_type: lead.dates_type,
        pax: lead.pax,
        pax_children: lead.pax_children,
        pax_infants: lead.pax_infants,
        status: 'new',
        source: lead.source,
        budget_level: lead.budget_level,
        sales_owner: lead.sales_owner,
        notes: lead.notes,
        travel_style: lead.travel_style as string[],
        comfort_level: lead.comfort_level,
        magic_question: lead.magic_question,
        active_version: 0,
      });
      await logActivity('lead_duplicated', 'lead', newLead.id, { source_lead: lead.id });
      toast({ title: 'Lead duplicada!', description: `Nova simulação ${newLead.lead_code} criada.` });
      navigate(`/leads/${newLead.id}`);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }, [lead, createLeadMutation, navigate, toast]);

  const handleNewVersion = useCallback(async () => {
    if (!lead) return;
    const newVersion = activeVersion + 1;
    setActiveVersion(newVersion);
    await updateLeadMutation.mutateAsync({ id: lead.id, updates: { active_version: newVersion } });
    await logActivity('lead_new_version', 'lead', lead.id, { version: newVersion });
    toast({ title: `Versão V${newVersion} criada` });
  }, [lead, activeVersion, updateLeadMutation, toast]);

  const handleRemove = useCallback(async () => {
    if (!lead) return;
    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      await logActivity('lead_deleted', 'lead', lead.id, { client_name: lead.client_name });
      toast({ title: 'Simulação removida' });
      navigate('/leads');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }, [lead, deleteLeadMutation, navigate, toast]);

  const generateAI = async (type: 'travel_planner' | 'budget' | 'digital_itinerary') => {
    if (!lead) return;
    setAiLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          leadData: {
            clientName: formState.clientName, destination: destino.join(', '),
            travelDates: formState.travelDates,
            travelEndDate: formState.travelEndDate || undefined,
            datesType: formState.datesType,
            numberOfDays: formState.numberOfDays || undefined,
            pax: formState.pax, paxChildren: formState.paxChildren, paxInfants: formState.paxInfants,
            travelStyles, comfortLevel: categoria[0] || '',
            budgetLevel: formState.budgetLevel, magicQuestion: lead.magic_question,
            notes: formState.notes,
          },
          type,
        },
      });
      if (error) throw error;
      setAiResults(prev => ({ ...prev, [type]: data.result }));
      if (type === 'travel_planner' && data.result.days) {
        const newDays: PlannerDay[] = data.result.days.map((d: any, i: number) => ({
          day: d.day || i + 1,
          title: d.title || '',
          date: d.date || '',
          periods: {
            morning: { label: 'Manhã', items: (d.periods?.morning?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
            lunch: { label: 'Almoço', items: (d.periods?.lunch?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
            afternoon: { label: 'Tarde', items: (d.periods?.afternoon?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
            night: { label: 'Noite', items: (d.periods?.night?.items || []).map((it: any) => ({ id: genId(), title: it.title || '', description: it.description || '', location: it.location || '', duration: it.duration || '' })) },
          },
        }));
        setPlannerDays(newDays);
        savePlannerData(newDays);
      }
      if (type === 'budget' && data.result.days) {
        // Budget AI not used — costing mirrors planner structure
      }
      toast({ title: 'AI gerou com sucesso', description: `Modelo usado: ${data.modelUsed}` });
    } catch (e: any) {
      toast({ title: 'Erro na geração AI', description: e.message, variant: 'destructive' });
    } finally {
      setAiLoading(null);
    }
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="ml-2 text-sm text-muted-foreground">A carregar...</span></div></AppLayout>;
  }

  if (!lead) {
    return <AppLayout><div className="text-center py-20"><p className="text-muted-foreground">Simulação não encontrada</p><Link to="/leads" className="text-[hsl(var(--info))] text-sm hover:underline mt-2 inline-block">Voltar</Link></div></AppLayout>;
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
                {displayLeadCode(lead)} - {formState.email} - {destino.join(', ') || lead.destination} - adt:{formState.pax} - chl:{formState.paxChildren} - inf:{formState.paxInfants}
              </h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn("text-sm font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity", currentStatusConfig.color)}>
                    [ {currentStatusConfig.label} ] <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {LEAD_STATUSES.map(s => (
                    <DropdownMenuItem key={s.value} onClick={async () => {
                      const prev = leadStatus;
                      setLeadStatus(s.value);
                      try {
                        await updateLeadMutation.mutateAsync({ id: lead.id, updates: { status: s.value } });
                        await logActivity('lead_status_changed', 'lead', lead.id, { from: prev, to: s.value });
                        toast({ title: 'Estado atualizado', description: s.label });
                        // Trigger calendar sync on status transition
                        if (s.value === 'won') triggerCalendarSync(lead.id, 'create', 500);
                        else if (prev === 'won') triggerCalendarSync(lead.id, 'delete', 500);
                      } catch (err: any) {
                        setLeadStatus(prev);
                        toast({ title: 'Erro ao atualizar estado', description: err.message, variant: 'destructive' });
                      }
                    }} className={cn("text-xs cursor-pointer", leadStatus === s.value && "font-bold")}>{s.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="mt-1"><CalendarSyncBadge leadId={lead.id} leadStatus={leadStatus} /></div>
            </div>
            <PaymentSummaryBar leadId={lead.id} totalPVP={costingTotalPVP} />

          </div>
          <div className="mt-2">
            <LeadAgentsAssignment leadId={lead.id} initial={(lead as any).assigned_agents} />
          </div>

        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-0">
            {getDetailTabs(leadStatus, mode).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px", activeTab === tab.key ? "border-[hsl(var(--info))] text-[hsl(var(--info))]" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3" />

        </div>

        {/* Dados Gerais */}
        {activeTab === 'dados_gerais' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: activeVersion + 1 }, (_, i) => i).map(v => (
                  <button key={v} onClick={() => setActiveVersion(v)} className={cn("px-2.5 py-1 text-xs rounded border transition-colors", activeVersion === v ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground hover:text-foreground")}>V{v}</button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">🔒 Versão · V{activeVersion}</span>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleDuplicate} disabled={createLeadMutation.isPending}>
                <Copy className="h-3 w-3" /> Duplicar
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleNewVersion}>
                <Plus className="h-3 w-3" /> Nova Versão
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Informação geral</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold">ID YT *</label>
                  <Input
                    className="h-8 text-xs mt-1 font-mono"
                    value={formState.ytId}
                    onChange={e => updateFormField('ytId', e.target.value)}
                    placeholder="YT-2026-0123"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">ID Interno (auto)</label>
                  <Input className="h-8 text-xs mt-1 bg-muted/50 font-mono" defaultValue={lead.lead_code} readOnly title="Referência interna auto-gerada — não usada em partilhas nem PDFs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Criador da Simulação</label>
                  <Input className="h-8 text-xs mt-1" value={formState.salesOwner} onChange={e => updateFormField('salesOwner', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold">Tipo de Cliente</label>
                  <div className="flex gap-2 mt-1">
                    {(['B2C', 'B2B'] as const).map(t => (
                      <button key={t} type="button" onClick={() => updateFormField('clientType', t)}
                        className={cn("px-3 py-1.5 text-xs font-bold rounded border transition-colors",
                          formState.clientType === t
                            ? t === 'B2B'
                              ? "bg-[hsl(var(--warning))] text-white border-[hsl(var(--warning))]"
                              : "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]"
                            : "border-border text-muted-foreground hover:text-foreground")}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Data</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={new Date(lead.created_at).toLocaleString('pt-PT')} readOnly />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados do cliente</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-[10px] text-muted-foreground uppercase">Nome</label><Input className="h-8 text-xs mt-1" value={formState.clientName} onChange={e => updateFormField('clientName', e.target.value)} /></div>
                <div><label className="text-[10px] text-muted-foreground uppercase">E-mail</label><Input className="h-8 text-xs mt-1" type="email" value={formState.email} onChange={e => updateFormField('email', e.target.value)} /></div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Telefone</label><Input className="h-8 text-xs mt-1" value={formState.phone} onChange={e => updateFormField('phone', e.target.value)} /></div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados da viagem</h3>
              <div className="grid grid-cols-3 gap-4">
                <TagSelect label="Categoria" value={categoria} options={CATEGORIAS} onChange={setCategoria} />
                <TagSelect label="Destino" value={destino} options={DESTINOS} onChange={setDestino} multiple />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Tipo de Datas</label>
                  <div className="flex gap-1 mt-1">
                    {(['concrete', 'estimated', 'flexible'] as const).map(dt => (
                      <button key={dt} onClick={() => updateFormField('datesType', dt)} className={cn("px-2.5 py-1.5 text-[10px] rounded border transition-colors", formState.datesType === dt ? dt === 'concrete' ? "bg-[hsl(var(--success))] text-white border-[hsl(var(--success))]" : dt === 'estimated' ? "bg-[hsl(var(--warning))] text-white border-[hsl(var(--warning))]" : "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground")}>
                        {dt === 'concrete' ? 'Concretas' : dt === 'estimated' ? 'Estimadas' : 'Flexível (dias)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                {formState.datesType === 'concrete' && (<>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Data Início</label>
                    <Input className="h-8 text-xs mt-1" type="date" value={formState.travelDates} onChange={e => {
                      const startVal = e.target.value;
                      updateFormField('travelDates', startVal);
                      // Auto-calc numberOfDays
                      if (startVal && formState.travelEndDate) {
                        const diff = Math.ceil((new Date(formState.travelEndDate).getTime() - new Date(startVal).getTime()) / 86400000) + 1;
                        if (diff > 0) updateFormField('numberOfDays', diff);
                      }
                    }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Data Fim</label>
                    <Input className="h-8 text-xs mt-1" type="date" value={formState.travelEndDate} onChange={e => {
                      const endVal = e.target.value;
                      updateFormField('travelEndDate', endVal);
                      if (formState.travelDates && endVal) {
                        const diff = Math.ceil((new Date(endVal).getTime() - new Date(formState.travelDates).getTime()) / 86400000) + 1;
                        if (diff > 0) updateFormField('numberOfDays', diff);
                      }
                    }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nº de Dias</label>
                    <Input className="h-8 text-xs mt-1 bg-muted/50" type="number" value={formState.numberOfDays} readOnly />
                  </div>
                </>)}
                {formState.datesType === 'estimated' && (<>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Mês Previsto</label>
                    <div className="mt-1">
                      <MonthYearPicker
                        value={formState.travelDates}
                        onChange={(val) => updateFormField('travelDates', val)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nº de Dias</label>
                    <Input className="h-8 text-xs mt-1" type="number" min={1} value={formState.numberOfDays} onChange={e => updateFormField('numberOfDays', parseInt(e.target.value) || 0)} />
                  </div>
                </>)}
                {formState.datesType === 'flexible' && (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Nº de Dias</label>
                    <Input className="h-8 text-xs mt-1" type="number" min={1} value={formState.numberOfDays} onChange={e => updateFormField('numberOfDays', parseInt(e.target.value) || 0)} />
                  </div>
                )}
                <div><label className="text-[10px] text-muted-foreground uppercase">Nº de adultos</label><Input className="h-8 text-xs mt-1" type="number" value={formState.pax} onChange={e => updateFormField('pax', parseInt(e.target.value) || 1)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">Nº de jovens</label><Input className="h-8 text-xs mt-1" type="number" value={formState.paxChildren} onChange={e => updateFormField('paxChildren', parseInt(e.target.value) || 0)} /></div>
                <div><label className="text-[10px] text-muted-foreground uppercase">Nº de crianças</label><Input className="h-8 text-xs mt-1" type="number" value={formState.paxInfants} onChange={e => updateFormField('paxInfants', parseInt(e.target.value) || 0)} /></div>
                <TagSelect label="Idioma" value={idioma} options={IDIOMAS} onChange={setIdioma} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><label className="text-[10px] text-muted-foreground uppercase">Budget total (€)</label><Input className="h-8 text-xs mt-1" value={formState.budgetLevel} onChange={e => updateFormField('budgetLevel', e.target.value)} /></div>
                <TagSelect label="Origem do Itinerário" value={origem} options={ORIGENS} onChange={setOrigem} />
                <div><label className="text-[10px] text-muted-foreground uppercase">Desconto</label><Input className="h-8 text-xs mt-1" defaultValue="" /></div>
              </div>
            </div>

            <TagSelect label="Estilos de viagem" value={travelStyles} options={['Food & Wine', 'Culture & History', 'Nature & Adventure', 'Beach & Relax', 'City Break', 'Road Trip', 'Wellness', 'Photography']} onChange={setTravelStyles} multiple />

            {lead.magic_question && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">✨ O que tornaria esta viagem inesquecível?</h3>
                <p className="text-sm text-foreground italic">"{lead.magic_question}"</p>
              </div>
            )}

            <div><label className="text-[10px] text-muted-foreground uppercase">Preferências / Notas</label><Textarea className="mt-1 text-xs" rows={3} value={formState.notes} onChange={e => updateFormField('notes', e.target.value)} /></div>

            <LeadContextAttachments
              leadId={lead.id}
              routeMapPath={(lead as any).route_map_path}
              exactItineraryPdfPath={(lead as any).exact_itinerary_pdf_path}
            />

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={handleRemove} disabled={deleteLeadMutation.isPending}>
                <Trash2 className="h-3 w-3" /> Remover
              </Button>
              <Button size="sm" className="text-xs gap-1" onClick={handleSave} disabled={updateLeadMutation.isPending}>
                {updateLeadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
              </Button>
            </div>
          </div>
        )}

        {/* Travel Planner */}
        {activeTab === 'travel_planner' && (
          <TravelPlanProposal
            leadId={lead.id}
            leadCode={lead.lead_code}
            ytId={formState.ytId || (lead as any).yt_id || ''}
            clientName={formState.clientName}
            destination={destino.join(', ') || lead.destination || ''}
            travelDates={formState.travelDates}
            travelEndDate={formState.travelEndDate}
            numberOfDays={formState.numberOfDays}
            datesType={formState.datesType}
            pax={formState.pax}
            paxChildren={formState.paxChildren}
            paxInfants={formState.paxInfants}
            travelStyles={travelStyles}
            comfortLevel={categoria[0] || ''}
            budgetLevel={formState.budgetLevel}
            magicQuestion={lead.magic_question || undefined}
            notes={formState.notes}
            defaultLanguage={idioma[0]}
            routeMapPath={(lead as any).route_map_path || undefined}
            exactItineraryPdfPath={(lead as any).exact_itinerary_pdf_path || undefined}
            accommodation={proposalAccommodation}
            netPricing={(lead as any).client_type === 'B2B'}
            onGoToCosting={() => setActiveTab('custos')}
          />
        )}

        {/* Custos */}
        {activeTab === 'custos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Orçamentação & Margens</h3>
            </div>
            <div className="bg-muted/50 rounded-lg border p-3 text-xs space-y-1">
              <p><span className="font-medium">Pax:</span> {formState.pax} adultos + {formState.paxChildren} crianças · <span className="font-medium">Destino:</span> {destino.join(', ') || 'A definir'}</p>
              <p><span className="font-medium">Planner:</span> {plannerDays.length} dias definidos</p>
            </div>
            <LeadCostingEditor
              costingDays={costingDays}
              onChange={setCostingDays}
              onSave={async (days) => {
                await saveCostingData(days);
                toast({ title: 'Custos guardados!', description: `${days.length} dias salvos.` });
              }}
              saving={false}
              plannerDays={plannerDays}
              pax={formState.pax}
              paxChildren={formState.paxChildren}
              destination={destino.join(', ') || lead?.destination || ''}
              leadId={lead?.id}
              leadCode={formState.ytId || (lead as any)?.yt_id || lead?.lead_code}
              clientName={lead?.client_name}
              startDate={/^\d{4}-\d{2}-\d{2}$/.test(formState.travelDates || '') ? formState.travelDates : null}
              endDate={/^\d{4}-\d{2}-\d{2}$/.test(formState.travelEndDate || '') ? formState.travelEndDate : null}
              pvpOverride={pvpOverride}
              onPvpOverrideChange={async (v) => {
                setPvpOverride(v);
                if (lead?.id) {
                  try {
                    await supabase.from('leads').update({ pvp_override: v } as any).eq('id', lead.id);
                    queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
                  } catch (e) { console.error('Failed to persist pvp_override', e); }
                }
              }}
            />
          </div>
        )}

        {/* Propostas */}
        {activeTab === 'propostas' && lead && <LeadProposalsTab leadId={lead.id} clientName={formState.clientName} />}

        {/* Operações — apenas para reservas confirmadas (status = won) */}
        {activeTab === 'operacoes' && lead && (
          <OperacoesTab activeVersion={activeVersion} leadId={lead.id} leadCode={lead.lead_code} pvpTotal={costingTotalPVP} startDate={/^\d{4}-\d{2}-\d{2}$/.test(formState.travelDates || '') ? formState.travelDates : null} />
        )}



        {/* Comunicações */}
        {activeTab === 'comunicacoes' && lead && (
          <CommunicationsTab
            scope={mode === 'booking' ? 'trip' : 'lead'}
            entityId={lead.id}
            recipientEmail={formState.email || lead.email || ''}
            context={{
              client_name: formState.clientName || lead.client_name,
              lead_code: lead.lead_code,
              trip_code: lead.lead_code,
              destination: lead.destination || '',
              travel_dates: formState.travelDates || lead.travel_dates || '',
              pax: formState.pax ?? lead.pax,
              sales_owner: formState.salesOwner || lead.sales_owner || '',
            }}
            leadContext={{
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
              magicQuestion: lead.magic_question,
              notes: formState.notes,
              leadId: lead.id,
            }}
          />
        )}

      </div>

      <AlertDialog open={guard.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem alterações por gravar</AlertDialogTitle>
            <AlertDialogDescription>
              Alterou dados desta simulação que ainda não foram guardados. O que pretende fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={guard.cancel} disabled={guard.saving}>Cancelar</Button>
            <Button variant="ghost" onClick={guard.discard} disabled={guard.saving}>Sair sem guardar</Button>
            <Button onClick={guard.saveAndLeave} disabled={guard.saving}>
              {guard.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar e sair
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

function PaymentSummaryBar({ leadId, totalPVP }: { leadId: string; totalPVP: number }) {
  const { data: pay } = usePaymentsSummary(leadId);
  const { data: prop } = useQuery({
    queryKey: ['lead_proposal_totals', leadId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('proposals')
        .select('total_value_eur, deposit_amount_eur, updated_at')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { total_value_eur: number | null; deposit_amount_eur: number | null } | null;
    },
    enabled: !!leadId,
  });

  // Total YT mirrors the Costing PVP grand total (auto or manual override).
  // Falls back to the latest proposal value if costing has no data yet.
  const total = totalPVP > 0 ? totalPVP : Number(prop?.total_value_eur ?? 0);
  const deposit = Number(prop?.deposit_amount_eur ?? 0);
  const paid = Math.max(0, Number(pay?.net ?? 0));
  const outstanding = Math.max(0, total - paid);
  const fmt = (n: number) => `${n.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}€`;

  const fullyPaid = total > 0 && paid >= total;
  const depositMet = deposit > 0 && paid >= deposit;

  return (
    <PaymentsDialog leadId={leadId}>
      <button className="flex items-stretch gap-1 rounded-md overflow-hidden border border-border hover:opacity-90 transition-opacity text-left">
        <div className="px-3 py-1.5 bg-[#0a2540] text-white">
          <div className="text-[9px] uppercase tracking-wide opacity-80 leading-none">Total YT</div>
          <div className="text-sm font-bold leading-tight">{fmt(total)}</div>
        </div>
        <div className={cn(
          "px-3 py-1.5",
          fullyPaid ? "bg-green-600 text-white" : depositMet ? "bg-yellow-400 text-black" : paid > 0 ? "bg-yellow-400 text-black" : "bg-muted text-muted-foreground"
        )}>
          <div className="text-[9px] uppercase tracking-wide opacity-80 leading-none">{fullyPaid ? 'Pago Total' : 'Depósito/Pago'}</div>
          <div className="text-sm font-bold leading-tight">{fmt(paid)}</div>
        </div>
        <div className={cn(
          "px-3 py-1.5",
          outstanding > 0 ? "bg-destructive text-destructive-foreground" : "bg-green-600 text-white"
        )}>
          <div className="text-[9px] uppercase tracking-wide opacity-80 leading-none">Em Falta</div>
          <div className="text-sm font-bold leading-tight">{fmt(outstanding)}</div>
        </div>
      </button>
    </PaymentsDialog>
  );
}


export default LeadDetailPage;

