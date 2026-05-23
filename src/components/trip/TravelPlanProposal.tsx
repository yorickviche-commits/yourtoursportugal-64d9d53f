import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, RefreshCw, Save, FileText, ArrowRight, Loader2, Edit3, Eye, AlertTriangle, Clock, Plus, X, Send, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import ProposalImagePicker from './ProposalImagePicker';
import { useUsedPhotos, extractPhotoId } from '@/hooks/useUsedPhotos';

// ─── Types ───────────────────────────────────────────────
export interface ProposalImage {
  url: string;
  caption?: string;
}

export interface ProposalBullet {
  text: string;
  durationValue?: number;
  durationUnit?: 'hours' | 'minutes' | 'days' | 'night';
  startTime?: string;
  endTime?: string;
}

export interface ProposalDay {
  day_number: number;
  title: string;
  date: string;
  subtitle: string;
  bullets: (string | ProposalBullet)[];
  overnight: string;
  images?: ProposalImage[];
}

export interface TravelPlanData {
  trip_title: string;
  narrative: string;
  cover_image?: ProposalImage;
  days: ProposalDay[];
}

interface TravelPlanProposalProps {
  leadId: string;
  leadCode: string;
  clientName: string;
  destination: string;
  travelDates: string;
  travelEndDate?: string;
  numberOfDays?: number;
  datesType?: string;
  pax: number;
  paxChildren?: number;
  paxInfants?: number;
  travelStyles: string[];
  comfortLevel: string;
  budgetLevel: string;
  magicQuestion?: string;
  notes?: string;
  defaultLanguage?: string;
  onGoToCosting?: () => void;
}

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'PT', label: 'PT' },
  { value: 'EN', label: 'EN' },
  { value: 'ES', label: 'ESP' },
  { value: 'FR', label: 'FR' },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function toBulletObj(b: string | ProposalBullet): ProposalBullet {
  if (typeof b === 'string') {
    // Parse legacy duration string like "2h", "45min"
    const hMatch = b.match(/duration[:\s]*(\d+)\s*h/i);
    return { text: b };
  }
  // Migrate old string duration format
  if ((b as any).duration && !b.durationValue) {
    const d = (b as any).duration as string;
    const hMatch = d.match(/(\d+)\s*h/i);
    const mMatch = d.match(/(\d+)\s*m/i);
    const dMatch = d.match(/(\d+)\s*d/i);
    if (dMatch) return { ...b, durationValue: parseInt(dMatch[1]), durationUnit: 'days' };
    if (hMatch) return { ...b, durationValue: parseInt(hMatch[1]), durationUnit: 'hours' };
    if (mMatch) return { ...b, durationValue: parseInt(mMatch[1]), durationUnit: 'minutes' };
  }
  return b;
}

function formatDuration(b: ProposalBullet): string {
  if (!b.durationValue) return '';
  const u = b.durationUnit || 'hours';
  if (u === 'hours') return `${b.durationValue}h`;
  if (u === 'minutes') return `${b.durationValue}min`;
  return `${b.durationValue}d`;
}

// ─── Smart Suggestions ──────────────────────────────────
function getSuggestions(section: string, plan: TravelPlanData | null, destination: string): string[] {
  if (section === 'narrative') {
    return [
      'Torna mais emotivo e sensorial',
      'Menciona gastronomia e vinhos',
      'Adiciona referência à história local',
      'Encurta para 2 frases',
    ];
  }
  if (section === 'summary') {
    return [
      'Títulos mais evocativos',
      'Adiciona emoji aos títulos',
      'Simplifica os títulos',
    ];
  }
  if (section.startsWith('day_') && plan) {
    const dayNum = parseInt(section.replace('day_', ''));
    const day = plan.days.find(d => d.day_number === dayNum);
    const city = day?.overnight || '';
    return [
      city ? `Mais experiências em ${city}` : 'Mais experiências',
      'Troca por programa alternativo',
      'Adiciona experiência gastronómica',
      'Torna mais cultural',
      'Adiciona tempo livre',
    ];
  }
  return ['Regenerar conteúdo'];
}

// ─── AI Chat Panel ──────────────────────────────────────
function AIChatPanel({
  section,
  plan,
  destination,
  loading,
  onSend,
  onClose,
}: {
  section: string;
  plan: TravelPlanData | null;
  destination: string;
  loading: boolean;
  onSend: (message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const suggestions = getSuggestions(section, plan, destination);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');

    try {
      await onSend(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: '✅ Secção atualizada! Podes continuar a refinar ou fechar.' }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${e.message}` }]);
    }

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sectionLabel = section === 'narrative' ? 'Intro & Narrativa'
    : section === 'summary' ? 'Resumo'
    : section.startsWith('day_') ? `Dia ${section.replace('day_', '')}`
    : section;

  return (
    <div className="border border-[hsl(var(--info))]/30 rounded-lg bg-[hsl(var(--info))]/5 p-3 space-y-2 print:hidden animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[hsl(var(--info))] flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" /> AI Assistant — {sectionLabel}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
      </div>

      {/* Smart suggestions */}
      <div className="flex gap-1.5 flex-wrap">
        {suggestions.map(s => (
          <button
            key={s}
            className="px-2 py-1 text-[10px] rounded-full border border-[hsl(var(--info))]/30 bg-background text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/10 transition-colors"
            onClick={() => handleSend(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chat history */}
      {messages.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1.5 border-t border-[hsl(var(--info))]/20 pt-2">
          {messages.map((msg, i) => (
            <div key={i} className={cn("text-[11px] px-2 py-1 rounded", msg.role === 'user' ? 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] ml-8' : 'bg-muted text-foreground mr-8')}>
              {msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-1.5">
        <Input
          className="text-xs flex-1 h-7 bg-background"
          placeholder="Ex: 'Troca Braga por Gerês', 'Adiciona visita a caves de vinho'..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend(input)}
          disabled={loading}
        />
        <Button size="sm" className="h-7 w-7 p-0" onClick={() => handleSend(input)} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Duration Selector ──────────────────────────────────
function DurationSelector({
  value,
  unit,
  onValueChange,
  onUnitChange,
}: {
  value: number | undefined;
  unit: 'hours' | 'minutes' | 'days' | 'night';
  onValueChange: (v: number) => void;
  onUnitChange: (u: 'hours' | 'minutes' | 'days' | 'night') => void;
}) {
  const [localVal, setLocalVal] = useState(value?.toString() || '');

  useEffect(() => {
    setLocalVal(value?.toString() || '');
  }, [value]);

  return (
    <div className="flex items-center gap-0.5">
      <Input
        className="h-7 text-xs w-12 rounded-r-none text-center"
        type="text"
        inputMode="numeric"
        value={unit === 'night' ? '1' : localVal}
        disabled={unit === 'night'}
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, '');
          setLocalVal(raw);
          if (raw) onValueChange(parseInt(raw));
        }}
        onBlur={() => {
          if (!localVal) { setLocalVal(''); onValueChange(0); }
        }}
        placeholder="—"
      />
      <Select value={unit} onValueChange={v => onUnitChange(v as 'hours' | 'minutes' | 'days' | 'night')}>
        <SelectTrigger className="h-7 text-[10px] w-16 rounded-l-none border-l-0 px-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hours" className="text-xs">hrs</SelectItem>
          <SelectItem value="minutes" className="text-xs">min</SelectItem>
          <SelectItem value="days" className="text-xs">dias</SelectItem>
          <SelectItem value="night" className="text-xs">noite</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Section AI Button ──────────────────────────────────
function SectionAIButton({ label, active, loading, onClick }: { label: string; active: boolean; loading: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "text-[10px] gap-1 h-6 px-2",
        active
          ? "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]"
          : "text-[hsl(var(--info))] hover:text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/10"
      )}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {label}
    </Button>
  );
}

// ─── Main Component ─────────────────────────────────────
const TravelPlanProposal = ({
  leadId, leadCode, clientName, destination, travelDates, travelEndDate,
  numberOfDays, datesType, pax, paxChildren, paxInfants,
  travelStyles, comfortLevel, budgetLevel, magicQuestion, notes,
  defaultLanguage,
  onGoToCosting,
}: TravelPlanProposalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [plan, setPlan] = useState<TravelPlanData | null>(null);
  const [extraInstructions, setExtraInstructions] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [sectionLoading, setSectionLoading] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const normalizedDefaultLang = (defaultLanguage || 'EN').toUpperCase();
  const initialLang = LANGUAGE_OPTIONS.some(o => o.value === normalizedDefaultLang) ? normalizedDefaultLang : 'EN';
  const [language, setLanguage] = useState<string>(initialLang);

  // Load saved plan from DB
  const { data: savedPlan, isLoading: loadingSaved } = useQuery({
    queryKey: ['travel_plan', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travel_plans').select('*').eq('lead_id', leadId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  // Load costing data to compute total PVP for the proposal
  const { data: costingDaysData } = useQuery({
    queryKey: ['lead_costing_data_proposal', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_costing_data').select('items, day_number, version')
        .eq('lead_id', leadId)
        .order('version', { ascending: false })
        .order('day_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });

  const totalPVP = (() => {
    if (!costingDaysData || costingDaysData.length === 0) return 0;
    // Use latest version only
    const latestVersion = costingDaysData[0]?.version ?? 0;
    const rows = costingDaysData.filter((d: any) => d.version === latestVersion);
    let total = 0;
    rows.forEach((d: any) => {
      const items = Array.isArray(d.items) ? d.items : [];
      items.forEach((it: any) => {
        if (it.status === 'inactive' || it.status === 'rejected') return;
        total += Number(it.pvpTotal || 0);
      });
    });
    return Math.round(total);
  })();

  const hydratedRef = useRef(false);
  if (savedPlan && !plan && !hydratedRef.current) {
    hydratedRef.current = true;
    const days = Array.isArray(savedPlan.days) ? savedPlan.days as unknown as ProposalDay[] : [];
    // Restore cover_image from extra_instructions metadata
    let cover_image: ProposalImage | undefined;
    try {
      const meta = savedPlan.extra_instructions ? JSON.parse(savedPlan.extra_instructions) : null;
      if (meta?.cover_image) cover_image = meta.cover_image;
    } catch { /* not JSON, ignore */ }
    setPlan({ trip_title: savedPlan.trip_title || '', narrative: savedPlan.narrative || '', cover_image, days });
  }

  const missingFields: string[] = [];
  if (!destination) missingFields.push('Destino');
  if (!numberOfDays && !travelEndDate) missingFields.push('Nº de dias ou data fim');
  if (!pax) missingFields.push('Nº de participantes');
  const canGenerate = missingFields.length === 0;

  const leadData = {
    clientName, fileId: leadCode, destination, travelDates,
    travelEndDate, numberOfDays, datesType, pax, paxChildren,
    paxInfants, travelStyles, comfortLevel, budgetLevel, magicQuestion, notes,
    language,
  };

  // Dedup registry scope (lead-based)
  const { getUsedPhotoIds, registerPhotos, clearUsedPhotos } = useUsedPhotos(
    { type: 'lead', id: leadId || '' }
  );

  // Auto-fetch images for a plan with dedup
  const autoFetchImages = useCallback(async (planData: TravelPlanData) => {
    try {
      const usedIds = await getUsedPhotoIds();
      const excludeSet = new Set<string>(usedIds);
      const toRegister: { photo_id: string; photo_url: string; used_in: string }[] = [];

      async function fetchUnique(
        query: string,
        count: number,
        usedIn: string
      ): Promise<{ url: string; caption: string }[]> {
        const { data, error } = await supabase.functions.invoke('search-destination-images', {
          body: {
            query,
            count,
            mode: 'search',
            excludePhotoIds: [...excludeSet],
          },
        });
        if (error || !data?.images?.length) return [];
        const images = data.images as { url: string; caption: string; photo_id: string }[];
        for (const img of images) {
          const pid = img.photo_id || extractPhotoId(img.url);
          excludeSet.add(pid);
          toRegister.push({ photo_id: pid, photo_url: img.url, used_in: usedIn });
        }
        return images.map(i => ({ url: i.url, caption: i.caption }));
      }

      // 1. Cover image
      const coverImages = await fetchUnique(
        `${destination} Portugal travel landscape scenic`,
        1,
        'cover'
      );
      const coverImg = coverImages[0];

      // 2. Day images (sequential to maintain exclusion integrity)
      const dayImages: { url: string; caption: string }[][] = [];
      for (let i = 0; i < planData.days.length; i++) {
        const day = planData.days[i];
        const dayContext = `${day.overnight || destination} ${day.subtitle || day.title} Portugal travel`;
        const imgs = await fetchUnique(dayContext, 2, `day_${i + 1}`);
        dayImages.push(imgs);
      }

      if (toRegister.length > 0) {
        await registerPhotos(toRegister);
      }

      setPlan(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cover_image: coverImg ? { url: coverImg.url, caption: coverImg.caption } : prev.cover_image,
          days: prev.days.map((d, i) => ({
            ...d,
            images: dayImages[i]?.length ? dayImages[i] : d.images,
          })),
        };
      });
    } catch (e) {
      console.error('Auto-fetch images (dedup) failed:', e);
    }
  }, [destination, getUsedPhotoIds, registerPhotos]);

  // Generate full plan
  const handleGenerate = useCallback(async (extra?: string, langOverride?: string) => {
    setGenerating(true);
    try {
      if (leadId) await clearUsedPhotos();
      const effectiveLang = langOverride || language;
      const { data, error } = await supabase.functions.invoke('generate-travel-plan', {
        body: { leadData: { ...leadData, language: effectiveLang }, extraInstructions: extra || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data.result as TravelPlanData;
      setPlan(result);
      setViewMode('preview');
      setShowRegenInput(false);
      toast({ title: '✨ Plano gerado!', description: `${result.days?.length || 0} dias criados em ${effectiveLang}. A carregar imagens...` });
      autoFetchImages(result);
    } catch (e: any) {
      toast({ title: 'Erro na geração', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [leadData, leadId, language, toast, clearUsedPhotos, autoFetchImages]);

  // Language change with confirmation + auto-regenerate
  const handleLanguageChange = useCallback((newLang: string) => {
    if (newLang === language) return;
    const hasPlan = !!(plan || savedPlan);
    if (!hasPlan) {
      setLanguage(newLang);
      return;
    }
    const labelMap: Record<string, string> = { PT: 'Português', EN: 'Inglês', ES: 'Espanhol', FR: 'Francês' };
    const ok = window.confirm(`Mudar idioma para ${labelMap[newLang] || newLang}?\n\nTodo o conteúdo do plano (e do PDF) será regenerado neste idioma.`);
    if (!ok) return;
    setLanguage(newLang);
    handleGenerate(undefined, newLang);
  }, [language, plan, savedPlan, handleGenerate]);

  // Section regen via chat
  const handleSectionChat = useCallback(async (section: string, userMessage: string) => {
    if (!plan) throw new Error('No plan');
    setSectionLoading(section);
    try {
      // Build context-aware instruction
      let contextInfo = '';
      if (section.startsWith('day_')) {
        const dayNum = parseInt(section.replace('day_', ''));
        const day = plan.days.find(d => d.day_number === dayNum);
        if (day) {
          contextInfo = `\nCurrent Day ${dayNum} content:\nTitle: "${day.title}"\nSubtitle: "${day.subtitle}"\nBullets: ${day.bullets.map(b => toBulletObj(b).text).join(' | ')}\nOvernight: ${day.overnight}`;
        }
      } else if (section === 'narrative') {
        contextInfo = `\nCurrent title: "${plan.trip_title}"\nCurrent narrative: "${plan.narrative}"`;
      }

      const sectionInstruction = section === 'narrative'
        ? `Regenerate ONLY the trip_title and narrative based on this instruction: "${userMessage}". Keep all days exactly as they are.${contextInfo}`
        : section === 'summary'
          ? `Regenerate ONLY the day titles and subtitles based on this instruction: "${userMessage}". Keep all bullet content.`
          : section.startsWith('day_')
            ? `Regenerate ONLY Day ${section.replace('day_', '')} based on this instruction: "${userMessage}". Keep all other days exactly as they are.${contextInfo}`
            : userMessage;

      const { data, error } = await supabase.functions.invoke('generate-travel-plan', {
        body: { leadData, extraInstructions: sectionInstruction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data.result as TravelPlanData;

      if (section === 'narrative') {
        setPlan(p => p ? { ...p, trip_title: result.trip_title, narrative: result.narrative } : p);
      } else if (section === 'summary') {
        setPlan(p => {
          if (!p) return p;
          const newDays = p.days.map((d, i) => ({
            ...d,
            title: result.days[i]?.title || d.title,
            subtitle: result.days[i]?.subtitle || d.subtitle,
          }));
          return { ...p, days: newDays };
        });
      } else if (section.startsWith('day_')) {
        const dayNum = parseInt(section.replace('day_', ''));
        const newDay = result.days.find(d => d.day_number === dayNum);
        if (newDay) {
          setPlan(p => {
            if (!p) return p;
            return { ...p, days: p.days.map(d => d.day_number === dayNum ? { ...d, ...newDay } : d) };
          });
        }
      }
    } finally {
      setSectionLoading(null);
    }
  }, [plan, leadData]);

  // Save
  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const startDate = plan.days[0]?.date || travelDates || null;
      const endDate = plan.days[plan.days.length - 1]?.date || travelEndDate || null;
      const paxStr = `${pax} adult${pax > 1 ? 's' : ''}${paxChildren ? ` + ${paxChildren} children` : ''}`;
      await supabase.from('travel_plans').delete().eq('lead_id', leadId);
      // Store cover_image in extra_instructions as JSON metadata
      const metadata = JSON.stringify({ cover_image: plan.cover_image || null });
      const { error } = await supabase.from('travel_plans').insert({
        lead_id: leadId, file_id: leadCode, trip_title: plan.trip_title,
        client_name: clientName, start_date: startDate, end_date: endDate,
        pax: paxStr, narrative: plan.narrative, days: plan.days as any,
        extra_instructions: metadata, status: 'draft',
      });
      if (error) throw error;

      // Auto-create/update proposal from travel plan
      const token = `ytp-${leadCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const dateRange = startDate && endDate ? `${startDate} — ${endDate}` : startDate || '';
      const proposalDays = plan.days.map((d, i) => ({
        day_number: d.day_number,
        date_label: d.date || `Jour ${d.day_number}`,
        title: d.title,
        subtitle: d.subtitle || '',
        cover_image_url: d.images?.[0]?.url || '',
        images: (d.images || []).map(img => ({ url: img.url, caption: img.caption || '' })),
        items: d.bullets.map(b => typeof b === 'string' ? b : b.text),
        accommodation: d.overnight ? { label: d.overnight, hotel_name: d.overnight, note: '' } : null,
      }));

      // Check if proposal already exists for this lead
      const { data: existingProposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (existingProposal) {
        await supabase.from('proposals').update({
          title: plan.trip_title,
          client_name: clientName,
          date_range: dateRange,
          participants: paxStr,
          hero_image_url: plan.cover_image?.url || '',
          summary_text: plan.narrative,
          days: proposalDays as any,
        }).eq('id', existingProposal.id);
      } else {
        await supabase.from('proposals').insert({
          public_token: token,
          lead_id: leadId,
          title: plan.trip_title,
          client_name: clientName,
          date_range: dateRange,
          participants: paxStr,
          hero_image_url: plan.cover_image?.url || '',
          summary_text: plan.narrative,
          days: proposalDays as any,
          map_stops: [] as any,
          language: 'fr',
          status: 'draft',
        });
        console.log(`[YTP] Proposal created — public URL: /proposal/${token}`);
      }

      queryClient.invalidateQueries({ queryKey: ['travel_plan', leadId] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: 'Plano guardado!', description: 'Proposta cliente atualizada automaticamente.' });
    } catch (e: any) {
      toast({ title: 'Erro ao guardar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [plan, leadId, leadCode, clientName, pax, paxChildren, travelDates, travelEndDate, toast, queryClient]);

  // Edit helpers
  const updateDay = (dayIdx: number, updates: Partial<ProposalDay>) => {
    if (!plan) return;
    const newDays = [...plan.days];
    newDays[dayIdx] = { ...newDays[dayIdx], ...updates };
    setPlan({ ...plan, days: newDays });
  };

  const updateBulletField = (dayIdx: number, bulletIdx: number, field: keyof ProposalBullet, value: any) => {
    if (!plan) return;
    const newDays = [...plan.days];
    const bullets = [...newDays[dayIdx].bullets];
    const obj = toBulletObj(bullets[bulletIdx]);
    bullets[bulletIdx] = { ...obj, [field]: value };
    newDays[dayIdx] = { ...newDays[dayIdx], bullets };
    setPlan({ ...plan, days: newDays });
  };

  const addBullet = (dayIdx: number) => {
    if (!plan) return;
    const newDays = [...plan.days];
    newDays[dayIdx] = { ...newDays[dayIdx], bullets: [...newDays[dayIdx].bullets, { text: '' }] };
    setPlan({ ...plan, days: newDays });
  };

  const removeBullet = (dayIdx: number, bulletIdx: number) => {
    if (!plan) return;
    const newDays = [...plan.days];
    newDays[dayIdx] = { ...newDays[dayIdx], bullets: newDays[dayIdx].bullets.filter((_, i) => i !== bulletIdx) };
    setPlan({ ...plan, days: newDays });
  };

  const toggleChat = (section: string) => {
    setActiveChat(prev => prev === section ? null : section);
  };

  // Calc day duration
  const getDayDuration = (day: ProposalDay): string => {
    let totalMinutes = 0;
    day.bullets.forEach(b => {
      const obj = toBulletObj(b);
      const val = obj.durationValue || 0;
      const unit = obj.durationUnit || 'hours';
      if (unit === 'hours') totalMinutes += val * 60;
      else if (unit === 'minutes') totalMinutes += val;
      else totalMinutes += val * 480; // day = 8h
    });
    if (totalMinutes === 0) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  };

  // ─── No plan yet ───
  if (!plan && !loadingSaved) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase text-muted-foreground">Resumo do Perfil</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{clientName}</span></div>
              <div><span className="text-muted-foreground">File ID:</span> <span className="font-medium">{leadCode}</span></div>
              <div><span className="text-muted-foreground">Destino:</span> <span className="font-medium">{destination || '—'}</span></div>
              <div><span className="text-muted-foreground">Pax:</span> <span className="font-medium">{pax} adt{paxChildren ? ` + ${paxChildren} chl` : ''}</span></div>
              <div><span className="text-muted-foreground">Datas:</span> <span className="font-medium">{travelDates || '—'}{travelEndDate ? ` → ${travelEndDate}` : ''}</span></div>
              <div><span className="text-muted-foreground">Dias:</span> <span className="font-medium">{numberOfDays || '—'}</span></div>
              <div><span className="text-muted-foreground">Categoria:</span> <span className="font-medium">{comfortLevel || '—'}</span></div>
              <div><span className="text-muted-foreground">Budget:</span> <span className="font-medium">{budgetLevel || '—'}</span></div>
            </div>
            {travelStyles.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {travelStyles.map(s => (
                  <span key={s} className="px-2 py-0.5 text-[10px] rounded-full bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] font-medium">{s}</span>
                ))}
              </div>
            )}
            {magicQuestion && <p className="text-xs italic text-muted-foreground">✨ "{magicQuestion}"</p>}
          </CardContent>
        </Card>

        {!canGenerate && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-[hsl(var(--warning))]">Campos obrigatórios em falta:</p>
              <p className="text-xs text-muted-foreground">{missingFields.join(', ')}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Idioma</span>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="h-8 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="lg" disabled={!canGenerate || generating} onClick={() => handleGenerate()}
            className="text-sm gap-2 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white px-8 py-3 h-auto shadow-lg hover:shadow-xl transition-shadow">
            {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> O nosso travel designer está a criar o seu plano...</> : <><Sparkles className="h-4 w-4" /> Gerar Plano de Viagem</>}
          </Button>
        </div>
      </div>
    );
  }

  if (loadingSaved) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">A carregar plano...</span>
      </div>
    );
  }

  const displayPlan = plan || (savedPlan ? (() => {
    let cover_image: ProposalImage | undefined;
    try {
      const meta = savedPlan.extra_instructions ? JSON.parse(savedPlan.extra_instructions) : null;
      if (meta?.cover_image) cover_image = meta.cover_image;
    } catch { /* ignore */ }
    return {
      trip_title: savedPlan.trip_title, narrative: savedPlan.narrative || '', cover_image,
      days: (Array.isArray(savedPlan.days) ? savedPlan.days : []) as unknown as ProposalDay[],
    };
  })() : null);

  if (!displayPlan) return null;

  return (
    <div className="space-y-4 print:space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between print:hidden">
        <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)} className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="preview" className="text-xs gap-1 px-3"><Eye className="h-3 w-3" /> Pré-visualização</TabsTrigger>
            <TabsTrigger value="edit" className="text-xs gap-1 px-3"><Edit3 className="h-3 w-3" /> Edição</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="h-8 w-[80px] text-xs" title="Idioma do plano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowRegenInput(!showRegenInput)}>
            <RefreshCw className="h-3 w-3" /> Regenerar Tudo
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => window.print()}>
            <FileText className="h-3 w-3" /> PDF
          </Button>
          <Button size="sm" className="text-xs gap-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white" onClick={onGoToCosting}>
            <ArrowRight className="h-3 w-3" /> Costing
          </Button>
        </div>
      </div>

      {showRegenInput && (
        <div className="flex gap-2 print:hidden">
          <Input className="text-xs flex-1" placeholder="Ex: 'Add one more day in Porto', 'Replace Coimbra with Óbidos'..."
            value={extraInstructions} onChange={e => setExtraInstructions(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate(extraInstructions)} />
          <Button size="sm" className="text-xs gap-1" onClick={() => handleGenerate(extraInstructions)} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Gerar
          </Button>
        </div>
      )}

      {/* ─── PROPOSAL ─── */}
      <div data-print-root className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none">
        {/* COVER IMAGE */}
        {viewMode === 'edit' && (
          <div className="p-4 pb-0 print:hidden">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Imagem de Capa (Landscape)</p>
            <ProposalImagePicker
              currentUrl={displayPlan.cover_image?.url}
              onSelect={url => setPlan(p => p ? { ...p, cover_image: { url, caption: destination } } : p)}
              onRemove={() => setPlan(p => p ? { ...p, cover_image: undefined } : p)}
              searchContext={`${destination} Portugal panoramic travel`}
              className="max-h-48"
              aspectRatio="landscape"
              dedupScope={leadId ? { type: 'lead', id: leadId } : undefined}
            />
          </div>
        )}
        {viewMode === 'preview' && displayPlan.cover_image?.url && (
          <div className="w-full aspect-[21/9] overflow-hidden">
            <img src={displayPlan.cover_image.url} alt={destination} className="w-full h-full object-cover" />
          </div>
        )}

        {/* HERO / COVER */}
        <div className="relative">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white p-8 md:p-12">
            {viewMode === 'edit' ? (
              <div className="space-y-3 pr-28">
                <Input className="text-2xl font-serif font-bold bg-white/10 border-white/20 text-white placeholder:text-white/50 h-auto py-2"
                  value={displayPlan.trip_title} onChange={e => setPlan(p => p ? { ...p, trip_title: e.target.value } : p)} />
                <p className="text-sm text-white/70">{clientName}</p>
                <Textarea className="text-sm bg-white/10 border-white/20 text-white/90 placeholder:text-white/40 min-h-[60px]"
                  value={displayPlan.narrative} onChange={e => setPlan(p => p ? { ...p, narrative: e.target.value } : p)} />
              </div>
            ) : (
              <div className="pr-28">
                <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-tight">{displayPlan.trip_title}</h1>
                <p className="text-lg text-white/80 mt-1">{clientName}</p>
                <div className="flex items-center gap-3 mt-4 text-sm text-white/60">
                  <span>ID: {leadCode}</span><span>·</span>
                  <span>{displayPlan.days[0]?.date} – {displayPlan.days[displayPlan.days.length - 1]?.date}</span><span>·</span>
                  <span>{pax} adult{pax > 1 ? 's' : ''}{paxChildren ? ` + ${paxChildren} children` : ''}</span>
                </div>
                <p className="text-sm text-white/80 mt-4 leading-relaxed max-w-3xl">{displayPlan.narrative}</p>
              </div>
            )}
          </div>
          <div className="absolute top-2 right-2 print:hidden">
            <SectionAIButton label="AI" active={activeChat === 'narrative'} loading={sectionLoading === 'narrative'} onClick={() => toggleChat('narrative')} />
          </div>
        </div>
        {activeChat === 'narrative' && (
          <div className="px-6 py-3">
            <AIChatPanel section="narrative" plan={displayPlan} destination={destination} loading={sectionLoading === 'narrative'}
              onSend={msg => handleSectionChat('narrative', msg)} onClose={() => setActiveChat(null)} />
          </div>
        )}

        {/* SUMMARY INDEX */}
        <div className="relative border-b p-6 bg-slate-50">
          <div className="pr-16">
            <h2 className="text-lg font-serif font-bold text-slate-800 mb-3">Summary & Day-by-Day</h2>
            <div className="space-y-1">
              {displayPlan.days.map(d => (
                <p key={d.day_number} className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Day {d.day_number}</span> — {d.title}
                </p>
              ))}
            </div>
          </div>
          <div className="absolute top-2 right-2 print:hidden">
            <SectionAIButton label="AI" active={activeChat === 'summary'} loading={sectionLoading === 'summary'} onClick={() => toggleChat('summary')} />
          </div>
        </div>
        {activeChat === 'summary' && (
          <div className="px-6 py-3 bg-slate-50 border-b">
            <AIChatPanel section="summary" plan={displayPlan} destination={destination} loading={sectionLoading === 'summary'}
              onSend={msg => handleSectionChat('summary', msg)} onClose={() => setActiveChat(null)} />
          </div>
        )}

        {/* FULL DAY-BY-DAY */}
        <div className="divide-y">
          {displayPlan.days.map((day, dayIdx) => {
            const dayDuration = getDayDuration(day);
            const chatKey = `day_${day.day_number}`;
            return (
              <div key={day.day_number}>
                <div className="relative p-6 md:p-8">
                  <div className="absolute top-2 right-2 print:hidden">
                    <SectionAIButton label="AI" active={activeChat === chatKey} loading={sectionLoading === chatKey} onClick={() => toggleChat(chatKey)} />
                  </div>

                  {viewMode === 'edit' ? (
                    <div className="space-y-3 pr-16">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[hsl(var(--info))]">Day {day.day_number}</span>
                        <span className="text-xs text-muted-foreground">—</span>
                        <Input className="text-sm font-bold flex-1 h-8" value={day.title}
                          onChange={e => updateDay(dayIdx, { title: e.target.value })} />
                      </div>
                      <div className="flex gap-2 items-center">
                        <Input className="h-7 text-xs w-32" value={day.date}
                          onChange={e => updateDay(dayIdx, { date: e.target.value })} placeholder="DD-Mon-YYYY" />
                        <Input className="h-7 text-xs flex-1" value={day.subtitle}
                          onChange={e => updateDay(dayIdx, { subtitle: e.target.value })} placeholder="Subtitle..." />
                        {dayDuration && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 rounded-full whitespace-nowrap shrink-0">
                            <Clock className="h-3 w-3" /> {dayDuration}
                          </span>
                        )}
                      </div>

                      {/* Bullets with duration selector */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                          <span className="w-4" />
                          <span className="flex-1">Itinerary & Included</span>
                          <span className="w-[108px] text-center">Duração</span>
                          <span className="w-16 text-center">Início</span>
                          <span className="w-16 text-center">Fim</span>
                          <span className="w-5" />
                        </div>
                        {day.bullets.map((bullet, bi) => {
                          const obj = toBulletObj(bullet);
                          return (
                            <div key={bi} className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-4 text-center shrink-0">{bi + 1}.</span>
                              <Input className="h-7 text-xs flex-1" value={obj.text}
                                onChange={e => updateBulletField(dayIdx, bi, 'text', e.target.value)} placeholder="Experience..." />
                              <DurationSelector
                                value={obj.durationValue}
                                unit={obj.durationUnit || 'hours'}
                                onValueChange={v => updateBulletField(dayIdx, bi, 'durationValue', v)}
                                onUnitChange={u => updateBulletField(dayIdx, bi, 'durationUnit', u)}
                              />
                              <Input className="h-7 text-xs w-16" value={obj.startTime || ''} type="time"
                                onChange={e => updateBulletField(dayIdx, bi, 'startTime', e.target.value)} />
                              <Input className="h-7 text-xs w-16" value={obj.endTime || ''} type="time"
                                onChange={e => updateBulletField(dayIdx, bi, 'endTime', e.target.value)} />
                              <button onClick={() => removeBullet(dayIdx, bi)} className="text-destructive hover:text-destructive/80 shrink-0"><X className="h-3 w-3" /></button>
                            </div>
                          );
                        })}
                        <button onClick={() => addBullet(dayIdx)} className="text-[10px] text-[hsl(var(--info))] hover:underline flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Adicionar item
                        </button>
                      </div>
                      <Input className="h-7 text-xs w-48" value={day.overnight}
                        onChange={e => updateDay(dayIdx, { overnight: e.target.value })} placeholder="Overnight city..." />
                    </div>
                  ) : (
                    <div className="pr-16">
                      <div className="mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-serif font-bold text-slate-800">Day {day.day_number} — {day.title}</h3>
                          {dayDuration && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <Clock className="h-3 w-3" /> {dayDuration}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{day.date}</p>
                        <p className="text-sm italic text-slate-600 mt-1">{day.subtitle}</p>
                      </div>
                      <div className="mb-3">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-2">Itinerary & Included:</p>
                        <ul className="space-y-1.5">
                          {day.bullets.map((bullet, bi) => {
                            const obj = toBulletObj(bullet);
                            const dur = formatDuration(obj);
                            return (
                              <li key={bi} className="text-sm text-slate-700 flex items-start gap-2">
                                <span className="text-slate-400 mt-0.5">•</span>
                                <span className="flex-1">{obj.text}</span>
                                {(dur || obj.startTime) && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                    {obj.startTime && <span>{obj.startTime}{obj.endTime ? `–${obj.endTime}` : ''}</span>}
                                    {dur && <span className="bg-muted px-1.5 py-0.5 rounded">{dur}</span>}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      {day.overnight && (
                        <p className="text-sm font-medium text-slate-600 mt-4 pt-3 border-t border-dashed border-slate-200">
                          {day.day_number === displayPlan.days.length ? `Departure from ${day.overnight}` : `Night in ${day.overnight}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Day Images (2 per day) */}
                  <div className="px-6 md:px-8 pb-4">
                    {viewMode === 'edit' ? (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Imagens do Dia {day.day_number}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[0, 1].map(imgIdx => {
                            const img = day.images?.[imgIdx];
                            const imgContext = `${day.overnight || destination} ${day.subtitle || day.title} Portugal travel`;
                            return (
                              <ProposalImagePicker
                                key={imgIdx}
                                currentUrl={img?.url}
                                onSelect={url => {
                                  setPlan(p => {
                                    if (!p) return p;
                                    const newDays = [...p.days];
                                    const imgs = [...(newDays[dayIdx].images || [])];
                                    imgs[imgIdx] = { url, caption: day.subtitle };
                                    // Ensure array has no gaps
                                    while (imgs.length < imgIdx + 1) imgs.push({ url: '', caption: '' });
                                    newDays[dayIdx] = { ...newDays[dayIdx], images: imgs };
                                    return { ...p, days: newDays };
                                  });
                                }}
                                onRemove={() => {
                                  setPlan(p => {
                                    if (!p) return p;
                                    const newDays = [...p.days];
                                    const imgs = [...(newDays[dayIdx].images || [])];
                                    imgs[imgIdx] = { url: '', caption: '' };
                                    newDays[dayIdx] = { ...newDays[dayIdx], images: imgs.filter(i => i.url) };
                                    return { ...p, days: newDays };
                                  });
                                }}
                                searchContext={imgContext}
                                aspectRatio="landscape"
                                dedupScope={leadId ? { type: 'lead', id: leadId } : undefined}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      day.images && day.images.filter(i => i.url).length > 0 && (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          {day.images.filter(i => i.url).map((img, i) => (
                            <div key={i} className="rounded-lg overflow-hidden aspect-[16/10]">
                              <img src={img.url} alt={img.caption || day.title} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* AI Chat panel for this day */}
                {activeChat === chatKey && (
                  <div className="px-6 pb-4">
                    <AIChatPanel section={chatKey} plan={displayPlan} destination={destination} loading={sectionLoading === chatKey}
                      onSend={msg => handleSectionChat(chatKey, msg)} onClose={() => setActiveChat(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* PRICING & CONDITIONS — Client-facing closing section */}
        <div className="border-t-2 border-slate-200 bg-slate-50 p-6 md:p-10 space-y-6 print:break-before-page">
          {/* Price Header */}
          <div className="text-center pb-4 border-b border-slate-200">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Total Price</p>
            <p className="text-4xl font-serif font-bold text-slate-900">
              {totalPVP > 0 ? `€ ${totalPVP.toLocaleString('en-US')}` : '— € —'}
            </p>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-slate-600">
              <span>{pax} adult{pax > 1 ? 's' : ''}{paxChildren ? ` + ${paxChildren} child${paxChildren > 1 ? 'ren' : ''}` : ''}{paxInfants ? ` + ${paxInfants} infant${paxInfants > 1 ? 's' : ''}` : ''}</span>
              <span className="text-slate-300">·</span>
              <span>{displayPlan.days[0]?.date} – {displayPlan.days[displayPlan.days.length - 1]?.date}</span>
              <span className="text-slate-300">·</span>
              <span>{displayPlan.days.length} day{displayPlan.days.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* What's Included — Day by Day Summary */}
          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-3">What's Included</h3>
            <div className="space-y-2.5">
              {displayPlan.days.map(d => (
                <div key={d.day_number} className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Day {d.day_number} — {d.title}</p>
                  <ul className="mt-1 ml-3 space-y-0.5">
                    {d.bullets.slice(0, 6).map((b, i) => {
                      const obj = toBulletObj(b);
                      return <li key={i} className="text-slate-600">• {obj.text}</li>;
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Reservation & Payment */}
          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-2">Reservation & Payment Conditions</h3>
            <ul className="text-xs text-slate-700 space-y-1 ml-3">
              <li>• <strong>Deposit:</strong> 25% of the total amount to formalize the booking.</li>
              <li>• <strong>Final Payment:</strong> The remaining 75% must be settled up to 30 days before the tour date.</li>
            </ul>
          </div>

          {/* Cancellations */}
          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-2">Cancellations & Refund Conditions</h3>
            <ul className="text-xs text-slate-700 space-y-1 ml-3">
              <li>• Free cancellation with 100% refund up to 7 days prior to the tour date.</li>
              <li>• For cancellations made less than 30 days before the tour date, the total amount is non-refundable.</li>
            </ul>
          </div>

          {/* Important Notes */}
          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-2">Important Notes</h3>
            <ul className="text-xs text-slate-600 space-y-1 ml-3">
              <li>• The rates presented include all the itinerary and experiences mentioned in the proposition.</li>
              <li>• The rates presented have been calculated and are valid for a group of <strong>{pax}{paxChildren ? ` + ${paxChildren}` : ''}</strong> guests, respectively.</li>
              <li>• The presented rates are valid on the date this proposal is sent. Up until your final confirmation, there's the possibility of price/availability/conditions changes beyond our process. Therefore, we suggest you may confirm as soon as possible.</li>
              <li>• The rates include all taxes and personal accident insurance.</li>
              <li>• Terms and Conditions referring to all our products/services are available publicly on our website.</li>
            </ul>
          </div>

          {/* Closing Message */}
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-700 space-y-3 leading-relaxed">
            <p>That said, we await your feedback and your thoughts on the program and proposal.</p>
            <p>If helpful, we suggest scheduling a short video call with our team to walk through the experience together, clarify any details, and fine-tune the plan according to your vision. We can book directly in our agenda at your best convenience: <a href="https://url-shortener.me/BT2R" className="text-[hsl(var(--info))] underline">https://url-shortener.me/BT2R</a></p>
            <p>Please let us know if the proposal aligns with your expectations so we can move confidently to the next steps.</p>
            <p className="italic text-slate-500">*No reservation has been made at this time.</p>
            <p className="font-serif font-semibold text-slate-800 pt-2">Best regards from Portugal,<br/>Your Tours Portugal</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TravelPlanProposal;
