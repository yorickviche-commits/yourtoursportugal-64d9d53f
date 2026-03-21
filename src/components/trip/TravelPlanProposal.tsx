import { useState, useCallback, useRef } from 'react';
import { Sparkles, RefreshCw, Save, FileText, ArrowRight, Loader2, ChevronDown, ChevronRight, Edit3, Eye, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────
export interface ProposalDay {
  day_number: number;
  title: string;
  date: string;
  subtitle: string;
  bullets: string[];
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

  // Generate plan
  const handleGenerate = useCallback(async (extra?: string) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-travel-plan', {
        body: {
          leadData: {
            clientName, fileId: leadCode, destination, travelDates,
            travelEndDate, numberOfDays, datesType, pax, paxChildren,
            paxInfants, travelStyles, comfortLevel, budgetLevel,
            magicQuestion, notes,
          },
          extraInstructions: extra || undefined,
        },
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
  }, [clientName, leadCode, destination, travelDates, travelEndDate, numberOfDays, datesType, pax, paxChildren, paxInfants, travelStyles, comfortLevel, budgetLevel, magicQuestion, notes, toast]);

  // Save plan to DB
  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const startDate = plan.days[0]?.date || travelDates || null;
      const endDate = plan.days[plan.days.length - 1]?.date || travelEndDate || null;
      const paxStr = `${pax} adult${pax > 1 ? 's' : ''}${paxChildren ? ` + ${paxChildren} children` : ''}`;

      // Upsert — delete old, insert new
      await supabase.from('travel_plans').delete().eq('lead_id', leadId);
      const { error } = await supabase.from('travel_plans').insert({
        lead_id: leadId,
        file_id: leadCode,
        trip_title: plan.trip_title,
        client_name: clientName,
        start_date: startDate,
        end_date: endDate,
        pax: paxStr,
        narrative: plan.narrative,
        days: plan.days as any,
        status: 'draft',
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['travel_plan', leadId] });
      toast({ title: 'Plano guardado!', description: 'Travel Plan salvo com sucesso.' });
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

  const updateBullet = (dayIdx: number, bulletIdx: number, value: string) => {
    if (!plan) return;
    const newDays = [...plan.days];
    const bullets = [...newDays[dayIdx].bullets];
    bullets[bulletIdx] = value;
    newDays[dayIdx] = { ...newDays[dayIdx], bullets };
    setPlan({ ...plan, days: newDays });
  };

  const addBullet = (dayIdx: number) => {
    if (!plan) return;
    const newDays = [...plan.days];
    newDays[dayIdx] = { ...newDays[dayIdx], bullets: [...newDays[dayIdx].bullets, ''] };
    setPlan({ ...plan, days: newDays });
  };

  const removeBullet = (dayIdx: number, bulletIdx: number) => {
    if (!plan) return;
    const newDays = [...plan.days];
    newDays[dayIdx] = { ...newDays[dayIdx], bullets: newDays[dayIdx].bullets.filter((_, i) => i !== bulletIdx) };
    setPlan({ ...plan, days: newDays });
  };

  // PDF export
  const handleExportPDF = useCallback(() => {
    window.print();
  }, []);

  // ─── Render ────────────────────────────────────────────
  // No plan yet — show generation UI
  if (!plan && !loadingSaved) {
    return (
      <div className="space-y-6">
        {/* Lead Profile Summary */}
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
            {magicQuestion && (
              <p className="text-xs italic text-muted-foreground">✨ "{magicQuestion}"</p>
            )}
          </CardContent>
        </Card>

        {/* Missing fields warning */}
        {!canGenerate && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-[hsl(var(--warning))]">Campos obrigatórios em falta:</p>
              <p className="text-xs text-muted-foreground">{missingFields.join(', ')}</p>
            </div>
          </div>
        )}

        {/* Generate button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!canGenerate || generating}
            onClick={() => handleGenerate()}
            className="text-sm gap-2 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white px-8 py-3 h-auto shadow-lg hover:shadow-xl transition-shadow"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> O nosso travel designer está a criar o seu plano...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Gerar Plano de Viagem</>
            )}
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

  // Display saved plan if no in-memory plan
  const displayPlan = plan || (savedPlan ? {
    trip_title: savedPlan.trip_title,
    narrative: savedPlan.narrative || '',
    days: (Array.isArray(savedPlan.days) ? savedPlan.days : []) as unknown as ProposalDay[],
  } : null);

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
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowRegenInput(!showRegenInput)}>
            <RefreshCw className="h-3 w-3" /> Regenerar
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar Plano
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleExportPDF}>
            <FileText className="h-3 w-3" /> Exportar PDF
          </Button>
          <Button size="sm" className="text-xs gap-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white">
            <ArrowRight className="h-3 w-3" /> Avançar para Costing
          </Button>
        </div>
      </div>

      {/* Regen input */}
      {showRegenInput && (
        <div className="flex gap-2 print:hidden">
          <Input
            className="text-xs flex-1"
            placeholder="Instrução adicional: ex. 'Add one more day in Porto', 'Replace Coimbra with Óbidos'..."
            value={extraInstructions}
            onChange={e => setExtraInstructions(e.target.value)}
          />
          <Button size="sm" className="text-xs gap-1" onClick={() => handleGenerate(extraInstructions)} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Gerar
          </Button>
        </div>
      )}

      {/* ─── PROPOSAL PREVIEW ─── */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-0">
        {/* HERO / COVER */}
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
                <span>ID: {leadCode}</span>
                <span>·</span>
                <span>{displayPlan.days[0]?.date} – {displayPlan.days[displayPlan.days.length - 1]?.date}</span>
                <span>·</span>
                <span>{pax} adult{pax > 1 ? 's' : ''}{paxChildren ? ` + ${paxChildren} children` : ''}</span>
              </div>
              <p className="text-sm text-white/80 mt-4 leading-relaxed max-w-3xl">{displayPlan.narrative}</p>
            </>
          )}
        </div>

        {/* SUMMARY INDEX */}
        <div className="border-b p-6 bg-slate-50">
          <h2 className="text-lg font-serif font-bold text-slate-800 mb-3">Summary & Day-by-Day</h2>
          <div className="space-y-1">
            {displayPlan.days.map(d => (
              <p key={d.day_number} className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Day {d.day_number}</span> — {d.title}
              </p>
            ))}
          </div>
        </div>

        {/* FULL DAY-BY-DAY */}
        <div className="divide-y">
          {displayPlan.days.map((day, dayIdx) => (
            <div key={day.day_number} className="p-6 md:p-8">
              {viewMode === 'edit' ? (
                <div className="space-y-3">
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
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Itinerary & Included:</p>
                    {day.bullets.map((bullet, bi) => (
                      <div key={bi} className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-4 text-center">{bi + 1}.</span>
                        <Input className="h-7 text-xs flex-1" value={bullet}
                          onChange={e => updateBullet(dayIdx, bi, e.target.value)} />
                        <button onClick={() => removeBullet(dayIdx, bi)} className="text-destructive hover:text-destructive/80 text-xs px-1">✕</button>
                      </div>
                    ))}
                    <button onClick={() => addBullet(dayIdx)} className="text-[10px] text-[hsl(var(--info))] hover:underline">+ Adicionar bullet</button>
                  </div>
                  <Input className="h-7 text-xs w-48" value={day.overnight}
                    onChange={e => updateDay(dayIdx, { overnight: e.target.value })} placeholder="Overnight city..." />
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <h3 className="text-lg font-serif font-bold text-slate-800">
                      Day {day.day_number} — {day.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">{day.date}</p>
                    <p className="text-sm italic text-slate-600 mt-1">{day.subtitle}</p>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase text-slate-400 mb-2">Itinerary & Included:</p>
                    <ul className="space-y-1.5">
                      {day.bullets.map((bullet, bi) => (
                        <li key={bi} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="text-slate-400 mt-0.5">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {day.overnight && (
                    <p className="text-sm font-medium text-slate-600 mt-4 pt-3 border-t border-dashed border-slate-200">
                      {day.day_number === displayPlan.days.length
                        ? `Departure from ${day.overnight}`
                        : `Night in ${day.overnight}`}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TravelPlanProposal;
