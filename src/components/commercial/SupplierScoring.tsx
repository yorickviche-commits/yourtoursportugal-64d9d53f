import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Save, Loader2, Star, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

// ─── Scoring Matrix from OPE-MOD.006.00 ───
const SCORING_CRITERIA: Record<string, { criteria: { key: string; label: string; weight: number; description: string }[] }> = {
  hotel: {
    criteria: [
      { key: 'product_quality', label: 'Qualidade dos Produtos', weight: 15, description: 'Qualidade dos quartos, amenities, instalações gerais.' },
      { key: 'service_quality', label: 'Qualidade no Serviço / Hospitalidade', weight: 15, description: 'Cortesia, simpatia, eficiência, personalização do serviço.' },
      { key: 'team', label: 'Equipa', weight: 10, description: 'Formação, competências e experiência da equipa.' },
      { key: 'responsiveness', label: 'Responsividade Backoffice', weight: 10, description: 'Rapidez e eficiência na resposta a reservas e alterações.' },
      { key: 'vegetarian_options', label: 'Qualidade Opções Vegetarianas', weight: 10, description: 'Qualidade e variedade das opções vegetarianas.' },
      { key: 'accessibility', label: 'Acessibilidade e Estacionamento', weight: 10, description: 'Acesso fácil e seguro, estacionamento disponível.' },
      { key: 'poi_distance', label: 'Distância dos Pontos de Interesse', weight: 10, description: 'Proximidade dos principais pontos turísticos.' },
      { key: 'authenticity', label: 'Autenticidade', weight: 10, description: 'Experiência autêntica e genuína da cultura local.' },
      { key: 'reviews', label: 'Reviews', weight: 10, description: 'Avaliações de consumidores em plataformas online.' },
    ],
  },
  restaurant: {
    criteria: [
      { key: 'product_quality', label: 'Qualidade dos Produtos', weight: 20, description: 'Frescura, qualidade dos ingredientes, apresentação, variedade.' },
      { key: 'service_quality', label: 'Qualidade no Serviço / Hospitalidade', weight: 10, description: 'Cortesia, simpatia, eficiência do serviço.' },
      { key: 'team', label: 'Equipa', weight: 5, description: 'Formação e competências da equipa.' },
      { key: 'responsiveness', label: 'Responsividade Backoffice', weight: 10, description: 'Rapidez na resposta a pedidos e reservas.' },
      { key: 'vegetarian_options', label: 'Qualidade Opções Vegetarianas', weight: 15, description: 'Qualidade, variedade e criatividade dos pratos vegetarianos.' },
      { key: 'accessibility', label: 'Acessibilidade e Estacionamento', weight: 10, description: 'Acesso fácil e seguro, estacionamento.' },
      { key: 'poi_distance', label: 'Distância dos Pontos de Interesse', weight: 5, description: 'Proximidade dos principais pontos turísticos.' },
      { key: 'authenticity', label: 'Autenticidade', weight: 15, description: 'Experiência autêntica da gastronomia local.' },
      { key: 'reviews', label: 'Reviews', weight: 10, description: 'Avaliações em plataformas online.' },
    ],
  },
  activity: {
    criteria: [
      { key: 'product_quality', label: 'Qualidade dos Produtos', weight: 10, description: 'Qualidade da experiência/atividade e seus equipamentos.' },
      { key: 'service_quality', label: 'Qualidade no Serviço / Hospitalidade', weight: 20, description: 'Cortesia, simpatia, personalização do serviço.' },
      { key: 'team', label: 'Equipa', weight: 15, description: 'Formação, competências e experiência da equipa.' },
      { key: 'responsiveness', label: 'Responsividade Backoffice', weight: 10, description: 'Rapidez na resposta a pedidos e reservas.' },
      { key: 'vegetarian_options', label: 'Qualidade Opções Vegetarianas', weight: 10, description: 'Opções vegetarianas quando aplicável.' },
      { key: 'accessibility', label: 'Acessibilidade e Estacionamento', weight: 10, description: 'Acesso fácil e seguro.' },
      { key: 'poi_distance', label: 'Distância dos Pontos de Interesse', weight: 5, description: 'Localização em relação a pontos turísticos.' },
      { key: 'authenticity', label: 'Autenticidade', weight: 10, description: 'Experiência autêntica e imersiva.' },
      { key: 'reviews', label: 'Reviews', weight: 10, description: 'Avaliações em plataformas online.' },
    ],
  },
  winery: {
    criteria: [
      { key: 'product_quality', label: 'Qualidade dos Produtos', weight: 10, description: 'Qualidade dos vinhos e da experiência de prova.' },
      { key: 'service_quality', label: 'Qualidade no Serviço / Hospitalidade', weight: 20, description: 'Cortesia, simpatia, personalização do serviço.' },
      { key: 'team', label: 'Equipa', weight: 15, description: 'Formação, competências e experiência da equipa.' },
      { key: 'responsiveness', label: 'Responsividade Backoffice', weight: 10, description: 'Rapidez na resposta a pedidos e reservas.' },
      { key: 'vegetarian_options', label: 'Qualidade Opções Vegetarianas', weight: 10, description: 'Opções vegetarianas quando aplicável.' },
      { key: 'accessibility', label: 'Acessibilidade e Estacionamento', weight: 10, description: 'Acesso fácil e seguro.' },
      { key: 'poi_distance', label: 'Distância dos Pontos de Interesse', weight: 5, description: 'Localização em relação a pontos turísticos.' },
      { key: 'authenticity', label: 'Autenticidade', weight: 10, description: 'Experiência autêntica da viticultura local.' },
      { key: 'reviews', label: 'Reviews', weight: 10, description: 'Avaliações em plataformas online.' },
    ],
  },
  transport: {
    criteria: [
      { key: 'product_quality', label: 'Qualidade dos Produtos', weight: 25, description: 'Qualidade dos veículos, equipamentos, conforto.' },
      { key: 'service_quality', label: 'Qualidade no Serviço / Hospitalidade', weight: 20, description: 'Cortesia dos motoristas, pontualidade.' },
      { key: 'team', label: 'Equipa', weight: 20, description: 'Experiência e formação dos motoristas.' },
      { key: 'responsiveness', label: 'Responsividade Backoffice', weight: 20, description: 'Rapidez na resposta a pedidos e reservas.' },
      { key: 'accessibility', label: 'Acessibilidade e Estacionamento', weight: 10, description: 'Facilidade de acesso e estacionamento.' },
      { key: 'reviews', label: 'Reviews', weight: 5, description: 'Avaliações em plataformas online.' },
    ],
  },
  guide: {
    criteria: [
      { key: 'service_quality', label: 'Qualidade no Serviço / Hospitalidade', weight: 50, description: 'Qualidade da visita guiada, conhecimento, simpatia, personalização.' },
      { key: 'responsiveness', label: 'Responsividade Backoffice', weight: 30, description: 'Rapidez e eficiência na comunicação e confirmações.' },
      { key: 'reviews', label: 'Reviews', weight: 20, description: 'Avaliações de clientes em plataformas.' },
    ],
  },
  other: {
    criteria: [
      { key: 'product_quality', label: 'Qualidade dos Produtos', weight: 30, description: 'Qualidade dos produtos/serviços fornecidos.' },
      { key: 'service_quality', label: 'Qualidade no Serviço / Hospitalidade', weight: 20, description: 'Qualidade do serviço prestado.' },
      { key: 'team', label: 'Equipa', weight: 20, description: 'Formação e competências da equipa.' },
      { key: 'responsiveness', label: 'Responsividade Backoffice', weight: 10, description: 'Rapidez na resposta.' },
      { key: 'accessibility', label: 'Acessibilidade e Estacionamento', weight: 10, description: 'Facilidade de acesso.' },
      { key: 'reviews', label: 'Reviews', weight: 10, description: 'Avaliações em plataformas.' },
    ],
  },
};

const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Mau', color: 'text-destructive' },
  2: { label: 'Fraco', color: 'text-urgent' },
  3: { label: 'Suficiente', color: 'text-warning' },
  4: { label: 'Bom', color: 'text-success' },
  5: { label: 'Excelente', color: 'text-primary' },
};

function getClassification(avg: number): { class: string; qual: string; selected: boolean; color: string } {
  if (avg >= 4) return { class: 'Classe A', qual: 'Qualificado', selected: true, color: 'text-success' };
  if (avg >= 3) return { class: 'Classe A', qual: 'Qualificado', selected: true, color: 'text-success' };
  if (avg >= 2) return { class: 'Classe B', qual: 'Qualificado c/ Melhoria', selected: false, color: 'text-warning' };
  return { class: 'Classe C', qual: 'Desqualificado', selected: false, color: 'text-destructive' };
}

function getQualByOccurrences(occurrences: number): { qual: string; color: string } {
  if (occurrences <= 15) return { qual: 'Classe A — Qualificado', color: 'text-success' };
  if (occurrences <= 24) return { qual: 'Classe B — Qualificado c/ Melhoria', color: 'text-warning' };
  return { qual: 'Classe C — Desqualificado', color: 'text-destructive' };
}

interface SupplierScoringProps {
  supplierId: string;
  supplierName: string;
  supplierCategory: string;
  services: any[];
  links: any[];
}

export default function SupplierScoring({ supplierId, supplierName, supplierCategory, services, links }: SupplierScoringProps) {
  const { toast } = useToast();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [occurrences, setOccurrences] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoScoring, setAutoScoring] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const categoryConfig = SCORING_CRITERIA[supplierCategory] || SCORING_CRITERIA.other;

  useEffect(() => {
    loadScores();
  }, [supplierId]);

  const loadScores = async () => {
    const { data } = await supabase
      .from('supplier_scores' as any)
      .select('*')
      .eq('supplier_id', supplierId)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setScores((d.scores as Record<string, number>) || {});
      setOccurrences(d.occurrences || 0);
      setNotes(d.notes || '');
      setExistingId(d.id);
    }
  };

  const totalWeight = categoryConfig.criteria.reduce((s, c) => s + c.weight, 0);
  const weightedAvg = categoryConfig.criteria.reduce((sum, c) => {
    const score = scores[c.key] || 0;
    return sum + (score * c.weight);
  }, 0) / (totalWeight || 1);

  const allScored = categoryConfig.criteria.every(c => scores[c.key] && scores[c.key] > 0);
  const classification = allScored ? getClassification(weightedAvg) : null;
  const qualByOcc = getQualByOccurrences(occurrences);

  const handleScoreChange = (key: string, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      supplier_id: supplierId,
      scores,
      weighted_average: Math.round(weightedAvg * 100) / 100,
      classification: classification?.class || 'Não Avaliado',
      qualification: classification?.qual || 'Não Avaliado',
      occurrences,
      is_selected: classification?.selected || false,
      notes,
      updated_at: new Date().toISOString(),
    };

    if (existingId) {
      await (supabase.from('supplier_scores') as any).update(payload).eq('id', existingId);
    } else {
      await (supabase.from('supplier_scores') as any).insert({ ...payload, scored_by: 'manual' });
    }
    toast({ title: 'Scoring guardado' });
    setSaving(false);
    loadScores();
  };

  const handleAutoScore = async () => {
    setAutoScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-score-supplier', {
        body: {
          supplier_id: supplierId,
          name: supplierName,
          category: supplierCategory,
          services: services.map(s => ({ name: s.name, description: s.description, price: s.price, category: s.category })),
          links: links.map(l => ({ name: l.name, url: l.url })),
          criteria: categoryConfig.criteria.map(c => ({ key: c.key, label: c.label, weight: c.weight, description: c.description })),
        },
      });
      if (error) throw error;
      if (data?.scores) {
        setScores(data.scores);
        setOccurrences(data.occurrences || 0);
        if (data.notes) setNotes(data.notes);
        toast({ title: 'Scoring AI aplicado', description: 'Revisa os valores antes de guardar.' });
      }
    } catch (err: any) {
      toast({ title: 'Erro no auto-scoring', description: err.message, variant: 'destructive' });
    }
    setAutoScoring(false);
  };

  return (
    <div className="space-y-4">
      {/* Header with AI button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-warning" />
          <span className="text-sm font-medium text-foreground">
            Matriz: {supplierCategory.charAt(0).toUpperCase() + supplierCategory.slice(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({categoryConfig.criteria.length} critérios)
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleAutoScore} disabled={autoScoring}>
          {autoScoring ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          {autoScoring ? 'A avaliar...' : 'Auto-Score AI'}
        </Button>
      </div>

      {/* Summary card */}
      {allScored && classification && (
        <Card className="border-l-4" style={{ borderLeftColor: classification.color === 'text-success' ? 'hsl(var(--success))' : classification.color === 'text-warning' ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {classification.selected
                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                  : <XCircle className="h-5 w-5 text-destructive" />
                }
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Média Ponderada: <span className={classification.color}>{weightedAvg.toFixed(1)}/5.0</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {classification.class} — {classification.qual}
                    {classification.selected ? ' ✓ Selecionado' : ' ✗ Não Selecionado'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Ocorrências (NC/Reclamações)</p>
                <p className={`text-sm font-semibold ${qualByOcc.color}`}>{occurrences} — {qualByOcc.qual}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Criteria scoring */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Parâmetros de Seleção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categoryConfig.criteria.map(c => {
            const score = scores[c.key] || 0;
            const scoreInfo = score > 0 ? SCORE_LABELS[score] : null;
            return (
              <div key={c.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{c.label}</p>
                    <p className="text-[10px] text-muted-foreground">{c.description}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {c.weight}%
                    </Badge>
                    {scoreInfo && (
                      <span className={`text-[10px] font-medium ${scoreInfo.color} min-w-[60px] text-right`}>
                        {scoreInfo.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      onClick={() => handleScoreChange(c.key, v)}
                      className={`flex-1 h-8 rounded text-xs font-medium transition-all border ${
                        score === v
                          ? v <= 2
                            ? 'bg-destructive/20 border-destructive text-destructive'
                            : v === 3
                              ? 'bg-warning/20 border-warning text-warning'
                              : 'bg-success/20 border-success text-success'
                          : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Occurrences & Notes */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nº Ocorrências (NC / Reclamações)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={occurrences}
                onChange={e => setOccurrences(parseInt(e.target.value) || 0)}
                className="w-20 h-8 px-2 rounded border border-border bg-background text-sm text-foreground"
              />
              <Badge variant="outline" className={`text-[10px] ${qualByOcc.color}`}>
                {qualByOcc.qual}
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Notas de Avaliação</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observações sobre a qualificação deste fornecedor..."
              rows={2}
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? 'A guardar...' : 'Guardar Scoring'}
      </Button>
    </div>
  );
}
