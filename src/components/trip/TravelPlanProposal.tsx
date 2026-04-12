import { useState, useCallback, useRef } from 'react';
import { Sparkles, RefreshCw, Save, FileText, ArrowRight, Loader2, Edit3, Eye, AlertTriangle, Clock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────
export interface ProposalBullet {
  text: string;
  duration?: string;    // e.g. "2h", "45min"
  startTime?: string;   // e.g. "09:00"
  endTime?: string;     // e.g. "11:00"
}

export interface ProposalDay {
  day_number: number;
  title: string;
  date: string;
  subtitle: string;
  bullets: (string | ProposalBullet)[];
  overnight: string;
}

export interface TravelPlanData {
  trip_title: string;
  narrative: string;
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
}

// Helper to normalize bullets (support both string and object)
function getBulletText(b: string | ProposalBullet): string {
  return typeof b === 'string' ? b : b.text;
}
function toBulletObj(b: string | ProposalBullet): ProposalBullet {
  return typeof b === 'string' ? { text: b } : b;
}

// ─── AI Section Regeneration ─────────────────────────────
function SectionAIButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-[10px] gap-1 h-6 px-2 text-[hsl(var(--info))] hover:text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/10"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {label}
    </Button>
  );
}

// ─── Component ───────────────────────────────────────────
const TravelPlanProposal = ({
  leadId, leadCode, clientName, destination, travelDates, travelEndDate,
  numberOfDays, datesType, pax, paxChildren, paxInfants,
  travelStyles, comfortLevel, budgetLevel, magicQuestion, notes,
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

  // Load saved plan from DB
  const { data: savedPlan, isLoading: loadingSaved } = useQuery({
    queryKey: ['travel_plan', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travel_plans')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  // Hydrate plan from saved data
  const hydratedRef = useRef(false);
  if (savedPlan && !plan && !hydratedRef.current) {
    hydratedRef.current = true;
    const days = Array.isArray(savedPlan.days) ? savedPlan.days as unknown as ProposalDay[] : [];
    setPlan({
      trip_title: savedPlan.trip_title || '',
      narrative: savedPlan.narrative || '',
      days,
    });
  }

  // Check missing fields
  const missingFields: string[] = [];
  if (!destination) missingFields.push('Destino');
  if (!numberOfDays && !travelEndDate) missingFields.push('Nº de dias ou data fim');
  if (!pax) missingFields.push('Nº de participantes');
  const canGenerate = missingFields.length === 0;

  const leadData = {
    clientName, fileId: leadCode, destination, travelDates,
    travelEndDate, numberOfDays, datesType, pax, paxChildren,
    paxInfants, travelStyles, comfortLevel, budgetLevel,
    magicQuestion, notes,
  };

  // Generate full plan
  const handleGenerate = useCallback(async (extra?: string) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-travel-plan', {
        body: { leadData, extraInstructions: extra || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPlan(data.result);
      setViewMode('preview');
      setShowRegenInput(false);
      toast({ title: '✨ Plano de viagem gerado!', description: `${data.result.days?.length || 0} dias criados.` });
    } catch (e: any) {
      toast({ title: 'Erro na geração', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [leadData, toast]);

  // Regenerate a specific section
  const handleSectionRegen = useCallback(async (section: string, instruction?: string) => {
    if (!plan) return;
    setSectionLoading(section);
    try {
      const sectionInstruction = section === 'narrative'
        ? `Regenerate ONLY the trip_title and narrative. Keep all days exactly as they are. ${instruction || ''}`
        : section === 'summary'
          ? `Regenerate ONLY the day titles and subtitles for a better summary index. Keep all bullet content. ${instruction || ''}`
          : section.startsWith('day_')
            ? `Regenerate ONLY Day ${section.replace('day_', '')}. Keep all other days exactly as they are. ${instruction || ''}`
            : instruction || '';

      const { data, error } = await supabase.functions.invoke('generate-travel-plan', {
        body: {
          leadData,
          extraInstructions: sectionInstruction,
        },
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
            const newDays = p.days.map(d => d.day_number === dayNum ? { ...d, ...newDay } : d);
            return { ...p, days: newDays };
          });
        }
      }

      toast({ title: '✨ Secção regenerada!' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSectionLoading(null);
    }
  }, [plan, leadData, toast]);

  // Save plan to DB
  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const startDate = plan.days[0]?.date || travelDates || null;
      const endDate = plan.days[plan.days.length - 1]?.date || travelEndDate || null;
      const paxStr = `${pax} adult${pax > 1 ? 's' : ''}${paxChildren ? ` + ${paxChildren} children` : ''}`;
      await supabase.from('travel_plans').delete().eq('lead_id', leadId);
      const { error } = await supabase.from('travel_plans').insert({
        lead_id: leadId, file_id: leadCode, trip_title: plan.trip_title,
        client_name: clientName, start_date: startDate, end_date: endDate,
        pax: paxStr, narrative: plan.narrative, days: plan.days as any, status: 'draft',
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['travel_plan', leadId] });
      toast({ title: 'Plano guardado!' });
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

  const updateBullet = (dayIdx: number, bulletIdx: number, field: keyof ProposalBullet, value: string) => {
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

  const handleExportPDF = useCallback(() => { window.print(); }, []);

  // ─── No plan yet — generation UI ───
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

        <div className="flex justify-center">
          <Button
            size="lg" disabled={!canGenerate || generating} onClick={() => handleGenerate()}
            className="text-sm gap-2 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white px-8 py-3 h-auto shadow-lg hover:shadow-xl transition-shadow"
          >
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

  const displayPlan = plan || (savedPlan ? {
    trip_title: savedPlan.trip_title,
    narrative: savedPlan.narrative || '',
    days: (Array.isArray(savedPlan.days) ? savedPlan.days : []) as unknown as ProposalDay[],
  } : null);

  if (!displayPlan) return null;

  // Calculate total day duration from bullet durations
  const getDayDuration = (day: ProposalDay): string => {
    let totalMinutes = 0;
    day.bullets.forEach(b => {
      const obj = toBulletObj(b);
      if (obj.duration) {
        const hMatch = obj.duration.match(/(\d+)\s*h/i);
        const mMatch = obj.duration.match(/(\d+)\s*m/i);
        if (hMatch) totalMinutes += parseInt(hMatch[1]) * 60;
        if (mMatch) totalMinutes += parseInt(mMatch[1]);
      }
    });
    if (totalMinutes === 0) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  };

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
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowRegenInput(!showRegenInput)}>
            <RefreshCw className="h-3 w-3" /> Regenerar Tudo
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleExportPDF}>
            <FileText className="h-3 w-3" /> PDF
          </Button>
          <Button size="sm" className="text-xs gap-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white">
            <ArrowRight className="h-3 w-3" /> Avançar para Costing
          </Button>
        </div>
      </div>

      {/* Regen input */}
      {showRegenInput && (
        <div className="flex gap-2 print:hidden">
          <Input className="text-xs flex-1" placeholder="Instrução adicional: ex. 'Add one more day in Porto', 'Replace Coimbra with Óbidos'..."
            value={extraInstructions} onChange={e => setExtraInstructions(e.target.value)} />
          <Button size="sm" className="text-xs gap-1" onClick={() => handleGenerate(extraInstructions)} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Gerar
          </Button>
        </div>
      )}

      {/* ─── PROPOSAL ─── */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-0">
        {/* HERO / COVER */}
        <div className="relative">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white p-8 md:p-12">
            {viewMode === 'edit' ? (
              <div className="space-y-3">
                <Input className="text-2xl font-serif font-bold bg-white/10 border-white/20 text-white placeholder:text-white/50 h-auto py-2"
                  value={displayPlan.trip_title} onChange={e => setPlan(p => p ? { ...p, trip_title: e.target.value } : p)} placeholder="Trip Title..." />
                <p className="text-sm text-white/70">{clientName}</p>
                <Textarea className="text-sm bg-white/10 border-white/20 text-white/90 placeholder:text-white/40 min-h-[60px]"
                  value={displayPlan.narrative} onChange={e => setPlan(p => p ? { ...p, narrative: e.target.value } : p)} placeholder="Narrative description..." />
              </div>
            ) : (
              <>
                <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-tight">{displayPlan.trip_title}</h1>
                <p className="text-lg text-white/80 mt-1">{clientName}</p>
                <div className="flex items-center gap-3 mt-4 text-sm text-white/60">
                  <span>ID: {leadCode}</span><span>·</span>
                  <span>{displayPlan.days[0]?.date} – {displayPlan.days[displayPlan.days.length - 1]?.date}</span><span>·</span>
                  <span>{pax} adult{pax > 1 ? 's' : ''}{paxChildren ? ` + ${paxChildren} children` : ''}</span>
                </div>
                <p className="text-sm text-white/80 mt-4 leading-relaxed max-w-3xl">{displayPlan.narrative}</p>
              </>
            )}
          </div>
          {/* AI button for hero/narrative */}
          <div className="absolute top-2 right-2 print:hidden">
            <SectionAIButton label="Regenerar Intro" loading={sectionLoading === 'narrative'} onClick={() => handleSectionRegen('narrative')} />
          </div>
        </div>

        {/* SUMMARY INDEX */}
        <div className="relative border-b p-6 bg-slate-50">
          <h2 className="text-lg font-serif font-bold text-slate-800 mb-3">Summary & Day-by-Day</h2>
          <div className="space-y-1">
            {displayPlan.days.map(d => (
              <p key={d.day_number} className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Day {d.day_number}</span> — {d.title}
              </p>
            ))}
          </div>
          <div className="absolute top-2 right-2 print:hidden">
            <SectionAIButton label="Regenerar Resumo" loading={sectionLoading === 'summary'} onClick={() => handleSectionRegen('summary')} />
          </div>
        </div>

        {/* FULL DAY-BY-DAY */}
        <div className="divide-y">
          {displayPlan.days.map((day, dayIdx) => {
            const dayDuration = getDayDuration(day);
            return (
              <div key={day.day_number} className="relative p-6 md:p-8">
                {/* Per-day AI button */}
                <div className="absolute top-2 right-2 print:hidden">
                  <SectionAIButton
                    label={`Regenerar Dia ${day.day_number}`}
                    loading={sectionLoading === `day_${day.day_number}`}
                    onClick={() => handleSectionRegen(`day_${day.day_number}`)}
                  />
                </div>

                {viewMode === 'edit' ? (
                  <div className="space-y-3 pr-28">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[hsl(var(--info))]">Day {day.day_number}</span>
                      <span className="text-xs text-muted-foreground">—</span>
                      <Input className="text-sm font-bold flex-1 h-8" value={day.title}
                        onChange={e => updateDay(dayIdx, { title: e.target.value })} placeholder="Day title..." />
                    </div>
                    <div className="flex gap-2">
                      <Input className="h-7 text-xs w-32" value={day.date}
                        onChange={e => updateDay(dayIdx, { date: e.target.value })} placeholder="DD-Mon-YYYY" />
                      <Input className="h-7 text-xs flex-1" value={day.subtitle}
                        onChange={e => updateDay(dayIdx, { subtitle: e.target.value })} placeholder="Subtitle..." />
                      {dayDuration && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 rounded-full whitespace-nowrap">
                          <Clock className="h-3 w-3" /> {dayDuration}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Itinerary & Included:</p>
                      {day.bullets.map((bullet, bi) => {
                        const obj = toBulletObj(bullet);
                        return (
                          <div key={bi} className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground w-4 text-center shrink-0">{bi + 1}.</span>
                            <Input className="h-7 text-xs flex-1" value={obj.text}
                              onChange={e => updateBullet(dayIdx, bi, 'text', e.target.value)} placeholder="Experience..." />
                            <Input className="h-7 text-xs w-16" value={obj.duration || ''}
                              onChange={e => updateBullet(dayIdx, bi, 'duration', e.target.value)} placeholder="Dur." title="Duração (ex: 2h, 45min)" />
                            <Input className="h-7 text-xs w-16" value={obj.startTime || ''} type="time"
                              onChange={e => updateBullet(dayIdx, bi, 'startTime', e.target.value)} title="Hora início" />
                            <Input className="h-7 text-xs w-16" value={obj.endTime || ''} type="time"
                              onChange={e => updateBullet(dayIdx, bi, 'endTime', e.target.value)} title="Hora fim" />
                            <button onClick={() => removeBullet(dayIdx, bi)} className="text-destructive hover:text-destructive/80 text-xs px-1 shrink-0"><X className="h-3 w-3" /></button>
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
                  <div className="pr-28">
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
                          return (
                            <li key={bi} className="text-sm text-slate-700 flex items-start gap-2">
                              <span className="text-slate-400 mt-0.5">•</span>
                              <span className="flex-1">{obj.text}</span>
                              {(obj.duration || obj.startTime) && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                  {obj.startTime && <span>{obj.startTime}{obj.endTime ? `–${obj.endTime}` : ''}</span>}
                                  {obj.duration && <span className="bg-muted px-1.5 py-0.5 rounded">{obj.duration}</span>}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TravelPlanProposal;
