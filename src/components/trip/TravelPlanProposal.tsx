import { useState, useCallback, useRef, useEffect } from 'react';
import { Package, PlusCircle, Sparkles, RefreshCw, Save, FileText, ArrowRight, Loader2, Edit3, Eye, AlertTriangle, Clock, Plus, X, Send, MessageSquare, ChevronDown, ChevronRight, CreditCard, GripVertical, Image as ImageIcon } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { toast as sonnerToast } from 'sonner';
import { useUndoable } from '@/hooks/useUndoable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichInput, RichTextarea } from '@/components/ui/rich-editable';
import { RichText } from '@/lib/richText';
import { resolveClosingText } from '@/lib/closingTermsI18n';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import ProposalImagePicker from './ProposalImagePicker';
import ProductPickerDialog from './ProductPickerDialog';
import { productToProposalDay, productBullets, imageList } from '@/lib/productToDay';
import type { ImportedProduct } from '@/hooks/useMagpie';
import { useUsedPhotos, extractPhotoId } from '@/hooks/useUsedPhotos';
import { getProposalDict } from '@/lib/proposalI18n';
import { getPdfDict } from '@/lib/proposalPdfI18n';
import reviewsBanner from '@/assets/our-reviews-banner.png.asset.json';
import foundersAsset from '@/assets/founders.png.asset.json';

const ALL_REVIEWS_URL = 'https://yourtoursportugal.com/our-reviews/';

const REVIEWS_CTA = {
  en: 'Read all reviews',
  pt: 'Ver todas as avaliações',
  es: 'Ver todas las opiniones',
  fr: 'Voir tous les avis',
  it: 'Leggi tutte le recensioni',
  de: 'Alle Bewertungen lesen',
} as const;

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
  mapUrl?: string;
}

import { toMapEmbedSrc, parseGoogleMapsUrl } from '@/lib/mapEmbed';
import { buildRouteMapImage } from '@/lib/staticRouteMap';
import { downloadProposalPdf } from '@/lib/proposalPdf';
import { getProposalAppUrl } from '@/lib/proposalShare';
import { uploadDataUrlImage, isDataUrl, uploadImageFile, removeWhiteBackground } from '@/lib/uploadDataUrlImage';

export { toMapEmbedSrc };

export interface TravelPlanData {
  trip_title: string;
  narrative: string;
  cover_image?: ProposalImage;
  brand_logo?: string;
  days: ProposalDay[];
}

interface TravelPlanProposalProps {
  leadId: string;
  leadCode: string;
  ytId?: string;
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
  routeMapPath?: string;
  exactItineraryPdfPath?: string;
  onGoToCosting?: () => void;
  /** Accommodation block from Costing (day 0), shown to the client when enabled. */
  accommodation?: { name: string; nights: number }[];
  /** B2B leads see "TOTAL NET PRICE" instead of "TOTAL PRICE". */
  netPricing?: boolean;
}

interface ClosingTerms {
  showPricing?: boolean;
  inclusionsOverride?: string;
  payment: string;
  cancellation: string;
  importantNotes: string;
  closingMessage: string;
}

const TERMS_URL = 'https://drive.google.com/file/d/12AkvW2Ob0LtcooaciWY4e-nEx7hlOnQC/view?usp=sharing';

const DEFAULT_CLOSING: ClosingTerms = {
  showPricing: true,
  inclusionsOverride: '',
  payment: '• Deposit: 25% of the total amount to formalize the booking.\n• Final Payment: The remaining 75% must be settled up to 30 days before the tour date.',
  cancellation: '• Free cancellation with 100% refund up to 7 days prior to the tour date.\n• For cancellations made less than 30 days before the tour date, the total amount is non-refundable.',
  importantNotes: '• The rates presented include all the itinerary and experiences mentioned in the proposition.\n• The presented rates are valid on the date this proposal is sent. Up until your final confirmation, there\'s the possibility of price/availability/conditions changes beyond our process.\n• The rates include all taxes and personal accident insurance.\n• Terms and Conditions referring to all our products/services are available publicly on our website.',
  closingMessage: 'That said, we await your feedback and your thoughts on the program and proposal.\n\nIf helpful, we suggest scheduling a short video call with our team to walk through the experience together, clarify any details, and fine-tune the plan according to your vision.\n\nPlease let us know if the proposal aligns with your expectations so we can move confidently to the next steps.',
};

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'PT', label: 'PT' },
  { value: 'EN', label: 'EN' },
  { value: 'ES', label: 'ESP' },
  { value: 'FR', label: 'FR' },
];

type ProposalLabels = {
  summaryDayByDay: string;
  day: string;
  itineraryIncluded: string;
  nightIn: (city: string) => string;
  departureFrom: (city: string) => string;
  totalPrice: string;
  dayUnit: (n: number) => string;
  adult: (n: number) => string;
  child: (n: number) => string;
  infant: (n: number) => string;
  whatsIncluded: string;
  paymentConditions: string;
  cancellationConditions: string;
  importantNotes: string;
  noReservationNote: string;
  bestRegards: string;
};

const LABELS: Record<string, ProposalLabels> = {
  EN: {
    summaryDayByDay: 'Summary & Day-by-Day',
    day: 'Day',
    itineraryIncluded: 'Itinerary & Included',
    nightIn: (c) => `Night in ${c}`,
    departureFrom: (c) => `Departure from ${c}`,
    totalPrice: 'Total Price',
    dayUnit: (n) => `${n} day${n > 1 ? 's' : ''}`,
    adult: (n) => `${n} adult${n > 1 ? 's' : ''}`,
    child: (n) => `${n} child${n > 1 ? 'ren' : ''}`,
    infant: (n) => `${n} infant${n > 1 ? 's' : ''}`,
    whatsIncluded: "What's Included",
    paymentConditions: 'Reservation & Payment Conditions',
    cancellationConditions: 'Cancellations & Refund Conditions',
    importantNotes: 'Important Notes',
    noReservationNote: '*No reservation has been made at this time.',
    bestRegards: 'Best regards from Portugal,\nYour Tours Portugal',
  },
  PT: {
    summaryDayByDay: 'Resumo e Dia-a-Dia',
    day: 'Dia',
    itineraryIncluded: 'Itinerário e Incluído',
    nightIn: (c) => `Noite em ${c}`,
    departureFrom: (c) => `Partida de ${c}`,
    totalPrice: 'Preço Total',
    dayUnit: (n) => `${n} dia${n > 1 ? 's' : ''}`,
    adult: (n) => `${n} adulto${n > 1 ? 's' : ''}`,
    child: (n) => `${n} criança${n > 1 ? 's' : ''}`,
    infant: (n) => `${n} bebé${n > 1 ? 's' : ''}`,
    whatsIncluded: 'O Que Está Incluído',
    paymentConditions: 'Condições de Reserva e Pagamento',
    cancellationConditions: 'Condições de Cancelamento e Reembolso',
    importantNotes: 'Notas Importantes',
    noReservationNote: '*Nenhuma reserva foi efetuada nesta fase.',
    bestRegards: 'Cumprimentos de Portugal,\nYour Tours Portugal',
  },
  ES: {
    summaryDayByDay: 'Resumen y Día a Día',
    day: 'Día',
    itineraryIncluded: 'Itinerario e Incluido',
    nightIn: (c) => `Noche en ${c}`,
    departureFrom: (c) => `Salida desde ${c}`,
    totalPrice: 'Precio Total',
    dayUnit: (n) => `${n} día${n > 1 ? 's' : ''}`,
    adult: (n) => `${n} adulto${n > 1 ? 's' : ''}`,
    child: (n) => `${n} niño${n > 1 ? 's' : ''}`,
    infant: (n) => `${n} bebé${n > 1 ? 's' : ''}`,
    whatsIncluded: 'Qué Está Incluido',
    paymentConditions: 'Condiciones de Reserva y Pago',
    cancellationConditions: 'Condiciones de Cancelación y Reembolso',
    importantNotes: 'Notas Importantes',
    noReservationNote: '*No se ha realizado ninguna reserva en esta fase.',
    bestRegards: 'Saludos desde Portugal,\nYour Tours Portugal',
  },
  FR: {
    summaryDayByDay: 'Résumé et Jour par Jour',
    day: 'Jour',
    itineraryIncluded: 'Itinéraire et Inclus',
    nightIn: (c) => `Nuit à ${c}`,
    departureFrom: (c) => `Départ de ${c}`,
    totalPrice: 'Prix Total',
    dayUnit: (n) => `${n} jour${n > 1 ? 's' : ''}`,
    adult: (n) => `${n} adulte${n > 1 ? 's' : ''}`,
    child: (n) => `${n} enfant${n > 1 ? 's' : ''}`,
    infant: (n) => `${n} bébé${n > 1 ? 's' : ''}`,
    whatsIncluded: 'Ce Qui Est Inclus',
    paymentConditions: 'Conditions de Réservation et Paiement',
    cancellationConditions: 'Conditions d’Annulation et Remboursement',
    importantNotes: 'Notes Importantes',
    noReservationNote: '*Aucune réservation n’a été effectuée à ce stade.',
    bestRegards: 'Cordialement du Portugal,\nYour Tours Portugal',
  },
};

const getLabels = (lang: string): ProposalLabels => LABELS[lang?.toUpperCase()] || LABELS.EN;

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const details = await error.context.json();
      return details?.error || details?.message || error.message;
    } catch {
      try {
        const text = await error.context.text();
        return text || error.message;
      } catch {
        return error.message;
      }
    }
  }
  return error instanceof Error ? error.message : String(error || 'Erro desconhecido');
}

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
  leadId, leadCode, ytId, clientName, destination, travelDates, travelEndDate,
  numberOfDays, datesType, pax, paxChildren, paxInfants,
  travelStyles, comfortLevel, budgetLevel, magicQuestion, notes,
  defaultLanguage,
  routeMapPath, exactItineraryPdfPath,
  onGoToCosting,
  accommodation = [],
  netPricing = false,
}: TravelPlanProposalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const planUndo = useUndoable<TravelPlanData | null>(null, {
    bindKeyboard: true,
    onUndo: () => sonnerToast.info('Alteração desfeita', { description: 'Ctrl+Shift+Z para refazer' }),
    onRedo: () => sonnerToast.info('Alteração refeita'),
  });
  const plan = planUndo.state;
  const setPlan = planUndo.set;
  const [closing, setClosing] = useState<ClosingTerms>(DEFAULT_CLOSING);
  const [extraInstructions, setExtraInstructions] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [fillingImages, setFillingImages] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [sectionLoading, setSectionLoading] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const normalizedDefaultLang = (defaultLanguage || 'EN').toUpperCase();
  const initialLang = LANGUAGE_OPTIONS.some(o => o.value === normalizedDefaultLang) ? normalizedDefaultLang : 'EN';
  const [language, setLanguage] = useState<string>(initialLang);
  // Keep the fixed closing terms (payment / cancellation / notes / closing message)
  // in the proposal language whenever they were never manually customised.
  useEffect(() => {
    setClosing(prev => {
      const next = { ...prev };
      (['payment', 'cancellation', 'importantNotes', 'closingMessage'] as const).forEach(f => {
        next[f] = resolveClosingText(f, prev[f], language);
      });
      return next;
    });
  }, [language]);
  // Manual mode: product picker target — 'new' appends a new day, number = append into that day
  const [pickerTarget, setPickerTarget] = useState<'new' | number | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const toggleDayCollapse = (dayNum: number) =>
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.has(dayNum) ? next.delete(dayNum) : next.add(dayNum);
      return next;
    });
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [wetravelCheckoutUrl, setWetravelCheckoutUrl] = useState<string | null>(null);
  const [wetravelDepositEur, setWetravelDepositEur] = useState<number | null>(null);

  const buildPdfFilename = useCallback(() => {
    const sanitize = (value: string) => (value || '')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const localeByLanguage: Record<string, string> = {
      EN: 'en-GB', FR: 'fr-FR', ES: 'es-ES', PT: 'pt-PT', IT: 'it-IT', DE: 'de-DE',
    };
    const locale = localeByLanguage[language] || 'en-GB';
    const formatDate = (value?: string) => {
      if (!value) return '';
      const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!iso) return sanitize(value);
      const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
      }).format(date);
    };
    const id = sanitize(ytId || leadCode || 'YT');
    const program = sanitize(plan?.trip_title || destination || 'Travel Plan');
    const start = formatDate(travelDates) || sanitize(plan?.days[0]?.date || '');
    const end = formatDate(travelEndDate) || sanitize(plan?.days[plan.days.length - 1]?.date || '');
    const dates = start && end && start !== end ? `${start} - ${end}` : start || end;

    return [id, sanitize(clientName), program, dates]
      .filter(Boolean)
      .join(' - ')
      .slice(0, 180);
  }, [clientName, destination, language, leadCode, plan, travelDates, travelEndDate, ytId]);

  const handlePrintPdf = useCallback(async () => {
    const filename = buildPdfFilename();
    if (!filename) return;
    const printRoot = document.querySelector<HTMLElement>('[data-print-root]');

    // Google Maps iframes never render when printing, so each day's route map is
    // rasterized to a static image (linked to the original Google Maps route).
    const mapNodes = printRoot
      ? Array.from(printRoot.querySelectorAll<HTMLElement>('[data-map-embed]'))
      : [];
    const mapImages = await Promise.all(
      mapNodes.map(async node => {
        const url = node.getAttribute('data-map-embed') || '';
        if (!url) return null;
        try {
          return await buildRouteMapImage(url);
        } catch {
          return null;
        }
      }),
    );
    const mapReplacements = mapNodes.map((node, i) => {
      const url = node.getAttribute('data-map-embed') || '';
      const img = mapImages[i];
      const link = `<div style="margin-top:6px;font-size:11px;font-weight:600"><a href="${url}" target="_blank" rel="noopener" style="color:#0066cc;text-decoration:none">Open route in Google Maps →</a></div>`;
      if (!img) {
        // Never leave an empty framed box in the PDF: keep only the route link.
        console.warn('Route map image unavailable for', url);
        return `<div style="margin-top:16px">${link}</div>`;
      }
      return `<div style="margin-top:16px"><div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden"><a href="${url}" target="_blank" rel="noopener"><img data-route-map="${i}" alt="Route map" style="display:block;width:100%;height:auto" /></a></div>${link}</div>`;
    });

    // Print the live document in place: the browser keeps the text vectorial
    // (a hidden iframe gets rasterized => blurry) and derives the suggested
    // filename from THIS document's title.
    const previousTitle = document.title;
    document.title = filename;

    const originals = mapNodes.map((node, i) => {
      const html = mapReplacements[i];
      if (!html) return null;
      const holder = document.createElement('div');
      holder.innerHTML = html;
      const replacement = holder.firstElementChild as HTMLElement | null;
      if (!replacement || !node.parentNode) return null;
      replacement.querySelectorAll<HTMLImageElement>('img[data-route-map]').forEach(image => {
        const src = mapImages[Number(image.getAttribute('data-route-map'))]?.dataUrl;
        if (src) image.src = src;
      });
      node.parentNode.replaceChild(replacement, node);
      return { node, replacement };
    });

    // Wait for the injected route maps and webfonts so nothing prints half-drawn.
    const images = printRoot ? Array.from(printRoot.querySelectorAll('img')) : [];
    await Promise.all([
      Promise.all(images.map(image => image.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          }))),
      document.fonts?.ready ?? Promise.resolve(),
    ]);

    const restore = () => {
      originals.forEach(entry => {
        if (entry?.replacement.parentNode) entry.replacement.parentNode.replaceChild(entry.node, entry.replacement);
      });
      document.title = previousTitle;
    };

    window.addEventListener('afterprint', restore, { once: true });
    window.print();
    // Safety net for browsers that never fire `afterprint`.
    window.setTimeout(() => {
      window.removeEventListener('afterprint', restore);
      restore();
    }, 3000);
  }, [buildPdfFilename]);



  // Keep the document title aligned with the custom PDF filename while this
  // view is mounted, so any print path (button, Ctrl+P) saves as
  // "YT#### - Client - Program - Dates".
  useEffect(() => {
    const filename = buildPdfFilename();
    if (!filename) return;
    const previous = document.title;
    document.title = filename;
    return () => {
      document.title = previous;
    };
  }, [buildPdfFilename]);




  // Load WeTravel checkout if already set on the proposal
  useQuery({
    queryKey: ['proposal_wetravel', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('wetravel_checkout_url, deposit_amount_eur')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (data?.wetravel_checkout_url) {
        setWetravelCheckoutUrl(data.wetravel_checkout_url);
        setWetravelDepositEur(data.deposit_amount_eur ?? null);
      }
      return data ?? null;
    },
    enabled: !!leadId,
  });

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

  // Load lead-level PVP override (manual price adjustment)
  const { data: leadPvpOverride } = useQuery({
    queryKey: ['lead_pvp_override', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads').select('pvp_override').eq('id', leadId).maybeSingle();
      if (error) throw error;
      return (data as any)?.pvp_override != null ? Number((data as any).pvp_override) : null;
    },
    enabled: !!leadId,
  });

  const totalPVP = (() => {
    if (leadPvpOverride != null && leadPvpOverride > 0) return Math.round(leadPvpOverride);
    if (!costingDaysData || costingDaysData.length === 0) return 0;
    // Use latest version only
    const latestVersion = costingDaysData[0]?.version ?? 0;
    const rows = costingDaysData.filter((d: any) => d.version === latestVersion);
    let total = 0;
    rows.forEach((d: any) => {
      const items = Array.isArray(d.items) ? d.items : [];
      items.forEach((it: any) => {
        if (it.status === 'inactive' || it.status === 'rejected' || it.status === 'eliminar') return;
        total += Number(it.pvpTotal || 0);
      });
    });
    return Math.round(total);
  })();

  /**
   * Canonical PDF: renders through the SAME builder used for the email
   * attachment (`src/lib/proposalPdf.ts`), so the document the client receives
   * by email is exactly the one downloaded here.
   */
  const handleDownloadPdf = useCallback(async () => {
    if (!plan) return;
    setDownloadingPdf(true);
    try {
      const proposalLang = (language || 'EN').toLowerCase().slice(0, 2);
      const dayLabelByLang: Record<string, string> = { en: 'Day', fr: 'Jour', es: 'Día', pt: 'Dia', it: 'Giorno', de: 'Tag' };
      const startDate = plan.days[0]?.date || travelDates || '';
      const endDate = plan.days[plan.days.length - 1]?.date || travelEndDate || '';
      const days = plan.days.map(d => ({
        day_number: d.day_number,
        date_label: d.date || `${dayLabelByLang[proposalLang] || 'Day'} ${d.day_number}`,
        title: d.title,
        subtitle: d.subtitle || '',
        cover_image_url: d.images?.[0]?.url || '',
        images: (d.images || []).map(img => ({ url: img.url, caption: img.caption || '' })),
        items: d.bullets.map(b => (typeof b === 'string' ? b : b.text)),
        accommodation: d.overnight ? { label: d.overnight, hotel_name: d.overnight, note: '' } : null,
        map_url: d.mapUrl || '',
      }));
      const token = `ytp-${leadCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const name = await downloadProposalPdf(
        {
          id: leadId,
          title: plan.trip_title,
          client_name: clientName,
          date_range: startDate && endDate ? `${startDate} — ${endDate}` : startDate || endDate,
          participants: `${pax}${paxChildren ? ` + ${paxChildren}` : ''}`,
          summary_text: plan.narrative,
          total_value_eur: totalPVP || null,
          public_token: token,
          booking_ref: ytId || leadCode,
          hero_image_url: plan.cover_image?.url || null,
          wetravel_checkout_url: wetravelCheckoutUrl,
          closing_terms: { ...closing, accommodation, netPricing } as any,
          language: proposalLang,
          days,
        },
        getProposalAppUrl(token),
        { idOverride: ytId || leadCode, filenameOverride: buildPdfFilename() },
      );
      toast({ title: 'PDF gerado', description: name });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar PDF', description: e.message, variant: 'destructive' });
    } finally {
      setDownloadingPdf(false);
    }
  }, [plan, language, travelDates, travelEndDate, leadCode, leadId, clientName, pax, paxChildren,
      totalPVP, ytId, wetravelCheckoutUrl, closing, accommodation, netPricing, buildPdfFilename, toast]);

  const hydratedRef = useRef(false);
  if (savedPlan && !plan && !hydratedRef.current) {
    hydratedRef.current = true;
    const days = Array.isArray(savedPlan.days) ? savedPlan.days as unknown as ProposalDay[] : [];
    // Restore cover_image + closing terms from extra_instructions metadata
    let cover_image: ProposalImage | undefined;
    let brand_logo: string | undefined;
    try {
      const meta = savedPlan.extra_instructions ? JSON.parse(savedPlan.extra_instructions) : null;
      if (meta?.cover_image) cover_image = meta.cover_image;
      if (meta?.brand_logo) brand_logo = meta.brand_logo;
      if (meta?.closing) {
        const metaLang = meta?.language ? String(meta.language) : language;
        const merged = { ...DEFAULT_CLOSING, ...meta.closing } as ClosingTerms;
        (['payment', 'cancellation', 'importantNotes', 'closingMessage'] as const).forEach(f => {
          merged[f] = resolveClosingText(f, merged[f], metaLang);
        });
        setClosing(merged);
      }
      if (meta?.language && LANGUAGE_OPTIONS.some(o => o.value === String(meta.language).toUpperCase())) {
        setLanguage(String(meta.language).toUpperCase());
      }
    } catch { /* not JSON, ignore */ }
    setPlan({ trip_title: savedPlan.trip_title || '', narrative: savedPlan.narrative || '', cover_image, brand_logo, days });
  }

  // Auto-sync per-day dates when concrete travel dates change in "Dados Gerais".
  // Ensures the Travel Planner + generated PDF reflect the latest dates.
  useEffect(() => {
    if (!plan || !plan.days || plan.days.length === 0) return;
    if (datesType !== 'concrete' || !travelDates) return;
    // Parse ISO YYYY-MM-DD in UTC to avoid timezone shifts
    const iso = travelDates.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!iso) return;
    const startUTC = Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
    const fmt = (d: Date) => {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${String(d.getUTCDate()).padStart(2,'0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    };
    const newDays = plan.days.map((d, i) => {
      const dt = new Date(startUTC + i * 86400000);
      const computed = fmt(dt);
      return d.date === computed ? d : { ...d, date: computed };
    });
    const changed = newDays.some((d, i) => d.date !== plan.days[i].date);
    if (changed) setPlan({ ...plan, days: newDays });
  }, [plan, travelDates, datesType]);

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
        body: {
          leadData: { ...leadData, language: effectiveLang },
          extraInstructions: extra || undefined,
          routeMapPath, exactItineraryPdfPath,
        },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      const result = data.result as TravelPlanData;
      setPlan(result);
      setViewMode('preview');
      setShowRegenInput(false);
      toast({ title: '✨ Plano gerado!', description: `${result.days?.length || 0} dias criados em ${effectiveLang}. Usa "Preencher Imagens (AI)" para adicionar imagens.` });
    } catch (e: any) {
      toast({ title: 'Erro na geração', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [leadData, leadId, language, toast, clearUsedPhotos, routeMapPath, exactItineraryPdfPath]);

  // Manual: fetch images for the current plan (cover + per-day) using Unsplash + dedup
  const handleFillImages = useCallback(async () => {
    if (!plan || !plan.days?.length) {
      toast({ title: 'Sem plano', description: 'Gera primeiro o Travel Plan.', variant: 'destructive' });
      return;
    }
    setFillingImages(true);
    try {
      if (leadId) await clearUsedPhotos();
      await autoFetchImages(plan);
      toast({ title: '🖼️ Imagens preenchidas', description: 'Cover + 2 imagens por dia carregadas do Unsplash.' });
    } catch (e: any) {
      toast({ title: 'Erro ao preencher imagens', description: e.message, variant: 'destructive' });
    } finally {
      setFillingImages(false);
    }
  }, [plan, leadId, clearUsedPhotos, autoFetchImages, toast]);

  // Language change with confirmation + fast translation (preserves structure & images)
  const handleLanguageChange = useCallback(async (newLang: string) => {
    if (newLang === language) return;
    const currentPlan = plan || (savedPlan ? {
      trip_title: savedPlan.trip_title || '',
      narrative: savedPlan.narrative || '',
      cover_image: undefined,
      days: (Array.isArray(savedPlan.days) ? savedPlan.days : []) as unknown as ProposalDay[],
    } as TravelPlanData : null);

    if (!currentPlan || !currentPlan.days?.length) {
      setLanguage(newLang);
      return;
    }
    const labelMap: Record<string, string> = { PT: 'Português', EN: 'Inglês', ES: 'Espanhol', FR: 'Francês' };
    const ok = window.confirm(`Mudar idioma para ${labelMap[newLang] || newLang}?\n\nTodo o conteúdo textual (planner + PDF) será traduzido, mantendo estrutura e imagens.`);
    if (!ok) return;

    setLanguage(newLang);
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-plan', {
        body: { plan: currentPlan, closing, language: newLang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data.result;
      if (r?.plan) setPlan(r.plan);
      if (r?.closing) setClosing((c) => ({ ...c, ...r.closing }));
      toast({ title: '✓ Traduzido', description: `Conteúdo em ${labelMap[newLang] || newLang}. Guarda para persistir.` });
    } catch (e: any) {
      toast({ title: 'Erro na tradução', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [language, plan, savedPlan, closing, toast]);

  // Section regen via chat
  const handleSectionChat = useCallback(async (section: string, userMessage: string) => {
    if (!plan) throw new Error('No plan');
    setSectionLoading(section);
    try {
      // Fast path: single-day regen via dedicated edge function
      if (section.startsWith('day_')) {
        const dayNum = parseInt(section.replace('day_', ''));
        const day = plan.days.find(d => d.day_number === dayNum);
        if (!day) return;

        const excludePhotoIds = plan.days
          .flatMap(d => d.images || [])
          .map(img => extractPhotoId(img.url))
          .filter(Boolean) as string[];

        const { data, error } = await supabase.functions.invoke('regenerate-day', {
          body: {
            day,
            instruction: userMessage,
            language,
            destination: leadData.destination,
            clientContext: `${leadData.pax} pax, ${leadData.comfortLevel || ''} ${leadData.budgetLevel || ''}, styles: ${(leadData.travelStyles || []).join(', ')}`,
            excludePhotoIds,
            imageCount: Math.max(2, day.images?.length || 2),
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const r = data.result;
        setPlan(p => {
          if (!p) return p;
          return {
            ...p,
            days: p.days.map(d => d.day_number === dayNum ? {
              ...d,
              title: r.title || d.title,
              subtitle: r.subtitle || d.subtitle,
              bullets: r.bullets || d.bullets,
              overnight: r.overnight || d.overnight,
              images: (r.images && r.images.length > 0)
                ? r.images.map((img: any) => ({ url: img.url, caption: img.caption || '' }))
                : d.images,
            } : d),
          };
        });
        return;
      }

      // Narrative / summary → still use full generate-travel-plan
      let contextInfo = '';
      if (section === 'narrative') {
        contextInfo = `\nCurrent title: "${plan.trip_title}"\nCurrent narrative: "${plan.narrative}"`;
      }

      const sectionInstruction = section === 'narrative'
        ? `Regenerate ONLY the trip_title and narrative based on this instruction: "${userMessage}". Keep all days exactly as they are.${contextInfo}`
        : section === 'summary'
          ? `Regenerate ONLY the day titles and subtitles based on this instruction: "${userMessage}". Keep all bullet content.`
          : userMessage;

      const { data, error } = await supabase.functions.invoke('generate-travel-plan', {
        body: { leadData, extraInstructions: sectionInstruction, routeMapPath, exactItineraryPdfPath },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
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
      }
    } finally {
      setSectionLoading(null);
    }
  }, [plan, leadData, language, routeMapPath, exactItineraryPdfPath]);


  // Save
  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    try {
      // ── Normalizar imagens base64 → storage (evita payloads de vários MB) ──
      let planToSave = plan;
      const hasDataUrls =
        isDataUrl(plan.cover_image?.url) ||
        plan.days.some(d => (d.images || []).some(img => isDataUrl(img.url)));
      if (hasDataUrls) {
        const cover = plan.cover_image?.url
          ? { ...plan.cover_image, url: await uploadDataUrlImage(plan.cover_image.url, `leads/${leadCode}`) }
          : plan.cover_image;
        const days = await Promise.all(plan.days.map(async d => ({
          ...d,
          images: await Promise.all((d.images || []).map(async img => ({
            ...img,
            url: await uploadDataUrlImage(img.url, `leads/${leadCode}`),
          }))),
        })));
        planToSave = { ...plan, cover_image: cover, days };
        setPlan(planToSave);
      }

      const startDate = planToSave.days[0]?.date || travelDates || null;
      const endDate = planToSave.days[planToSave.days.length - 1]?.date || travelEndDate || null;
      const proposalLang = (language || 'EN').toLowerCase().slice(0, 2);
      const participantLabels: Record<string, { adult: string; adults: string; child: string; children: string }> = {
        en: { adult: 'adult', adults: 'adults', child: 'child', children: 'children' },
        fr: { adult: 'adulte', adults: 'adultes', child: 'enfant', children: 'enfants' },
        es: { adult: 'adulto', adults: 'adultos', child: 'niño', children: 'niños' },
        pt: { adult: 'adulto', adults: 'adultos', child: 'criança', children: 'crianças' },
        it: { adult: 'adulto', adults: 'adulti', child: 'bambino', children: 'bambini' },
        de: { adult: 'Erwachsener', adults: 'Erwachsene', child: 'Kind', children: 'Kinder' },
      };
      const participantLabel = participantLabels[proposalLang] || participantLabels.en;
      const paxStr = `${pax} ${pax === 1 ? participantLabel.adult : participantLabel.adults}${paxChildren ? ` + ${paxChildren} ${paxChildren === 1 ? participantLabel.child : participantLabel.children}` : ''}`;
      // Store cover_image in extra_instructions as JSON metadata
      const metadata = JSON.stringify({ cover_image: planToSave.cover_image || null, brand_logo: planToSave.brand_logo || null, closing, language });
      const { data: existingPlanRow } = await supabase
        .from('travel_plans').select('id').eq('lead_id', leadId)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const planPayload = {
        lead_id: leadId, file_id: leadCode, trip_title: planToSave.trip_title,
        client_name: clientName, start_date: startDate, end_date: endDate,
        pax: paxStr, narrative: planToSave.narrative, days: planToSave.days as any,
        extra_instructions: metadata, status: 'draft',
      };
      const { error } = existingPlanRow
        ? await supabase.from('travel_plans').update(planPayload).eq('id', existingPlanRow.id)
        : await supabase.from('travel_plans').insert(planPayload);
      if (error) throw error;


      // Auto-create/update proposal from travel plan
      const token = `ytp-${leadCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const dateRange = startDate && endDate ? `${startDate} — ${endDate}` : startDate || '';
      const dayLabelByLang: Record<string, string> = { en: 'Day', fr: 'Jour', es: 'Día', pt: 'Dia', it: 'Giorno', de: 'Tag' };
      const proposalDays = planToSave.days.map((d, i) => ({
        day_number: d.day_number,
        date_label: d.date || `${dayLabelByLang[proposalLang] || 'Day'} ${d.day_number}`,
        title: d.title,
        subtitle: d.subtitle || '',
        cover_image_url: d.images?.[0]?.url || '',
        images: (d.images || []).map(img => ({ url: img.url, caption: img.caption || '' })),
        items: d.bullets.map(b => typeof b === 'string' ? b : b.text),
        accommodation: d.overnight ? { label: d.overnight, hotel_name: d.overnight, note: '' } : null,
        map_url: d.mapUrl || '',
      }));

      // Check if proposal already exists for this lead
      const { data: existingProposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (existingProposal) {
        await supabase.from('proposals').update({
          title: planToSave.trip_title,
          client_name: clientName,
          date_range: dateRange,
          participants: paxStr,
          hero_image_url: planToSave.cover_image?.url || '',
          brand_logo_url: planToSave.brand_logo || null,
          summary_text: planToSave.narrative,
          days: proposalDays as any,
          language: proposalLang,
          total_value_eur: totalPVP || null,
          closing_terms: { ...closing, accommodation, netPricing } as any,
        }).eq('id', existingProposal.id);
      } else {
        await supabase.from('proposals').insert({
          public_token: token,
          lead_id: leadId,
          title: planToSave.trip_title,
          client_name: clientName,
          date_range: dateRange,
          participants: paxStr,
          hero_image_url: planToSave.cover_image?.url || '',
          brand_logo_url: planToSave.brand_logo || null,
          summary_text: planToSave.narrative,
          days: proposalDays as any,
          map_stops: [] as any,
          language: proposalLang,
          status: 'draft',
          total_value_eur: totalPVP || null,
          closing_terms: { ...closing, accommodation, netPricing } as any,
        });
        console.log(`[YTP] Proposal created — public URL: /proposal/${token}`);
      }

      queryClient.invalidateQueries({ queryKey: ['travel_plan', leadId] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: 'Plano guardado!', description: 'Proposta cliente atualizada automaticamente.' });
      setSaving(false);

      // ── WeTravel deposit link (totalmente fora do caminho de gravação) ──
      void (async () => {
        try {
          const [{ data: savedProposal }, { data: tripData }] = await Promise.all([
            supabase.from('proposals').select('id, wetravel_checkout_url, deposit_amount_eur')
              .eq('lead_id', leadId).maybeSingle(),
            supabase.from('trips').select('total_value')
              .eq('lead_id', leadId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
          ]);
          const totalValue = (tripData as any)?.total_value ?? totalPVP ?? 0;
          if (!savedProposal || !(totalValue > 0)) return;
          if (savedProposal.wetravel_checkout_url) {
            setWetravelCheckoutUrl(savedProposal.wetravel_checkout_url);
            setWetravelDepositEur(savedProposal.deposit_amount_eur ?? null);
            return;
          }
          const { data: wt } = await supabase.functions.invoke('create-wetravel-deposit', {
            body: {
              proposal_id: savedProposal.id,
              total_value_eur: totalValue,
              deposit_percent: 50,
              title: planToSave.trip_title,
              description: planToSave.narrative?.slice(0, 500) ?? '',
              start_date: planToSave.days[0]?.date ?? travelDates ?? null,
              end_date: planToSave.days[planToSave.days.length - 1]?.date ?? travelEndDate ?? null,
              cover_image_url: planToSave.cover_image?.url ?? null,
              client_name: clientName,
            },
          });
          if ((wt as any)?.checkout_url) {
            setWetravelCheckoutUrl((wt as any).checkout_url);
            setWetravelDepositEur((wt as any).deposit_amount_eur ?? null);
            toast({
              title: '💳 Book Now link criado',
              description: `Depósito de €${(wt as any).deposit_amount_eur} · 100% reembolsável`,
            });
          }
        } catch (err) {
          console.error('WeTravel (non-blocking):', err);
        }
      })();
    } catch (e: any) {
      toast({ title: 'Erro ao guardar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [plan, closing, leadId, leadCode, clientName, pax, paxChildren, travelDates, travelEndDate, toast, queryClient]);


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

  // ─── Manual mode helpers ─────────────────────────────
  const dateForDayIndex = (index: number): string => {
    const iso = (travelDates || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!iso || datesType !== 'concrete') return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]) + index * 86400000);
    return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  const startManualPlan = () => {
    setPlan({
      trip_title: destination ? `${destination} — ${clientName}` : clientName,
      narrative: '',
      days: [],
    });
    setViewMode('edit');
  };

  const addManualDay = () => {
    setPlan(p => {
      const base = p || { trip_title: destination || clientName, narrative: '', days: [] };
      const index = base.days.length;
      return {
        ...base,
        days: [...base.days, {
          day_number: index + 1,
          title: '',
          date: dateForDayIndex(index),
          subtitle: '',
          bullets: [{ text: '' }],
          overnight: '',
          images: [],
        }],
      };
    });
    setViewMode('edit');
  };

  const handleProductSelected = (product: ImportedProduct) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (target === null) return;
    setPlan(p => {
      const base = p || { trip_title: destination || clientName, narrative: '', days: [] };
      if (target === 'new') {
        const index = base.days.length;
        const day = productToProposalDay(product, { dayNumber: index + 1, date: dateForDayIndex(index) });
        return { ...base, days: [...base.days, day] };
      }
      const days = [...base.days];
      const current = days[target];
      if (!current) return base;
      const extraImages = imageList(product.images, 2);
      const existingImages = (current.images || []).filter(i => i.url);
      days[target] = {
        ...current,
        bullets: [...current.bullets.filter(b => (typeof b === 'string' ? b.trim() : b.text.trim())), ...productBullets(product)],
        images: [...existingImages, ...extraImages].slice(0, 2),
        subtitle: current.subtitle,
      };
      return { ...base, days };
    });
    setViewMode('edit');
    sonnerToast.success('Produto importado', { description: 'Conteúdo preenchido a partir do catálogo YT.' });
  };

  const removeDay = (dayIdx: number) => {
    setPlan(p => {
      if (!p) return p;
      const days = p.days
        .filter((_, i) => i !== dayIdx)
        .map((d, i) => ({ ...d, day_number: i + 1, date: dateForDayIndex(i) || d.date }));
      return { ...p, days };
    });
  };

  const onBulletDragEnd = (result: DropResult) => {
    if (!plan) return;
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const srcDay = parseInt(source.droppableId.replace('day-', ''), 10);
    const dstDay = parseInt(destination.droppableId.replace('day-', ''), 10);
    if (isNaN(srcDay) || isNaN(dstDay)) return;
    const newDays = plan.days.map(d => ({ ...d, bullets: [...d.bullets] }));
    const [moved] = newDays[srcDay].bullets.splice(source.index, 1);
    newDays[dstDay].bullets.splice(destination.index, 0, moved);
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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" disabled={!canGenerate || generating} onClick={() => handleGenerate()}
              className="text-sm gap-2 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white px-8 py-3 h-auto shadow-lg hover:shadow-xl transition-shadow">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> O nosso travel designer está a criar o seu plano...</> : <><Sparkles className="h-4 w-4" /> Gerar Plano de Viagem</>}
            </Button>
            <Button size="lg" variant="outline" disabled={generating} onClick={startManualPlan}
              className="text-sm gap-2 px-6 py-3 h-auto">
              <PlusCircle className="h-4 w-4" /> Criar Manualmente
            </Button>
            <Button size="lg" variant="outline" disabled={generating} onClick={() => setPickerTarget('new')}
              className="text-sm gap-2 px-6 py-3 h-auto">
              <Package className="h-4 w-4" /> Criar a partir de Produto
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center max-w-md">
            Modo manual: constrói o programa dia a dia, do zero ou importando produtos já validados do catálogo YT.
          </p>
        </div>

        <ProductPickerDialog
          open={pickerTarget !== null}
          onOpenChange={o => { if (!o) setPickerTarget(null); }}
          onSelect={handleProductSelected}
        />
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
    let brand_logo: string | undefined;
    try {
      const meta = savedPlan.extra_instructions ? JSON.parse(savedPlan.extra_instructions) : null;
      if (meta?.cover_image) cover_image = meta.cover_image;
      if (meta?.brand_logo) brand_logo = meta.brand_logo;
    } catch { /* ignore */ }
    return {
      trip_title: savedPlan.trip_title, narrative: savedPlan.narrative || '', cover_image, brand_logo,
      days: (Array.isArray(savedPlan.days) ? savedPlan.days : []) as unknown as ProposalDay[],
    };
  })() : null);

  if (!displayPlan) return null;
  const t = getLabels(language);
  const d = getProposalDict(language);
  const displayId = ytId || leadCode;

  // Day-by-day summary sent to the AI image generator
  const programContext = [
    `Trip: ${displayPlan.trip_title || destination}`,
    `Destination: ${destination || '—'} | Days: ${displayPlan.days?.length || numberOfDays || '—'} | Pax: ${pax}${paxChildren ? ` + ${paxChildren} children` : ''}`,
    travelStyles.length ? `Travel styles: ${travelStyles.join(', ')}` : '',
    ...(displayPlan.days || []).map(day => {
      const items = (day.bullets || [])
        .map(b => (typeof b === 'string' ? b : b?.text))
        .filter(Boolean)
        .slice(0, 6)
        .join('; ');
      return `Day ${day.day_number} — ${day.subtitle || day.title}${day.overnight ? ` (overnight: ${day.overnight})` : ''}${items ? `: ${items}` : ''}`;
    }),
  ].filter(Boolean).join('\n');

  const coverBasePrompt = `Create an elegant editorial travel COLLAGE / composite cover image for a luxury private tour in ${destination || 'Portugal'}, titled "${displayPlan.trip_title || ''}". Blend 3 to 5 photorealistic scenes of the destination landscapes, landmarks and the specific experiences included in this program into one harmonious landscape composition (soft blended edges, cohesive warm cinematic light, premium travel magazine quality, rich colors). Personalized to this itinerary. Landscape 21:9 friendly framing. No text, no letters, no logos, no watermark.`;


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
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1 border-[hsl(var(--info))] text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/10"
            onClick={handleFillImages}
            disabled={fillingImages || !plan?.days?.length}
            title="Preencher cover + 2 imagens/dia via Unsplash (sem duplicados)"
          >
            {fillingImages ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
            Preencher Imagens (AI)
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handlePrintPdf}>

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
        {/* BRAND LOGO (B2B branded itineraries) */}
        {viewMode === 'edit' && (
          <div className="p-4 pb-0 print:hidden">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">
              Logótipo (itinerário B2B — canto superior esquerdo)
            </p>
            <div className="flex items-center gap-3">
              {displayPlan.brand_logo ? (
                <img src={displayPlan.brand_logo} alt="Logótipo" className="h-[60px] max-w-[200px] object-contain border rounded p-1" />
              ) : (
                <div className="h-[60px] w-[200px] border border-dashed rounded flex items-center justify-center text-[10px] text-muted-foreground">
                  Sem logótipo
                </div>
              )}
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingLogo(true);
                    try {
                      const clean = await removeWhiteBackground(file);
                      const url = await uploadImageFile(clean, `logos/${leadCode}`);
                      setPlan(p => p ? { ...p, brand_logo: url } : p);
                      toast({ title: 'Logótipo carregado' });
                    } catch (err: any) {
                      toast({ title: 'Erro ao carregar logótipo', description: err.message, variant: 'destructive' });
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                />
                <Button asChild variant="outline" size="sm" className="text-xs gap-1" disabled={uploadingLogo}>
                  <span>
                    {uploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                    {displayPlan.brand_logo ? 'Substituir' : 'Carregar logótipo'}
                  </span>
                </Button>
              </label>
              {displayPlan.brand_logo && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive"
                  onClick={() => setPlan(p => p ? { ...p, brand_logo: undefined } : p)}>
                  Remover
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Aparece no canto superior esquerdo do PDF e do itinerário digital (guardar para aplicar).
            </p>
          </div>
        )}

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
              basePrompt={coverBasePrompt}
              programContext={programContext}
            />

          </div>
        )}
        {viewMode === 'preview' && displayPlan.cover_image?.url && (
          <div className="relative w-full aspect-[21/9] overflow-hidden">
            <img src={displayPlan.cover_image.url} alt={destination} className="w-full h-full object-cover" />
            {displayPlan.brand_logo && (
              <div className="absolute top-3 left-3">
                <img src={displayPlan.brand_logo} alt="Logo" className="h-[50px] max-w-[188px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
              </div>
            )}
          </div>
        )}
        {viewMode === 'preview' && !displayPlan.cover_image?.url && displayPlan.brand_logo && (
          <div className="px-6 pt-5">
            <img src={displayPlan.brand_logo} alt="Logo" className="h-[50px] max-w-[188px] object-contain" />
          </div>
        )}

        {/* HERO / COVER */}
        <div className="relative">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white p-8 md:p-12">
            {viewMode === 'edit' ? (
              <div className="space-y-3 pr-28">
                <RichInput className="text-2xl font-serif font-bold bg-white/10 border-white/20 text-white placeholder:text-white/50 h-auto py-2"
                  value={displayPlan.trip_title} onChange={v => setPlan(p => p ? { ...p, trip_title: v } : p)} />
                <p className="text-sm text-white/70">{clientName}</p>
                <RichTextarea className="text-sm bg-white/10 border-white/20 text-white/90 placeholder:text-white/40 min-h-[60px]"
                  value={displayPlan.narrative} onChange={v => setPlan(p => p ? { ...p, narrative: v } : p)} />
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <div className="flex-1 min-w-0 pr-28 md:pr-0">
                  <RichText as="h1" className="text-2xl md:text-3xl font-serif font-bold tracking-tight" value={displayPlan.trip_title} />
                  <p className="text-lg text-white/80 mt-1">{clientName}</p>
                  <div className="flex items-center gap-3 mt-4 text-sm text-white/60">
                    <span>ID: {displayId}</span><span>·</span>
                    <span>{displayPlan.days[0]?.date} – {displayPlan.days[displayPlan.days.length - 1]?.date}</span><span>·</span>
                    <span>{t.adult(pax)}{paxChildren ? ` + ${t.child(paxChildren)}` : ''}{paxInfants ? ` + ${t.infant(paxInfants)}` : ''}</span>
                  </div>
                  <RichText as="p" className="text-sm text-white/80 mt-4 leading-relaxed" value={displayPlan.narrative} preserveNewlines />
                </div>
                {wetravelCheckoutUrl && (
                  <div className="shrink-0 w-full md:w-[220px] text-left md:text-right">
                    <a
                      href={wetravelCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block w-full text-center px-6 py-3 rounded-md bg-[#0a2540] text-white text-sm font-extrabold tracking-wide border border-white/30"
                    >
                      BOOK NOW
                    </a>
                    <p className="text-[9px] leading-snug text-white/70 mt-2">
                      Book with deposit · 100% refundable if plans change / cancel* —{' '}
                      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline">
                        see terms and conditions
                      </a>
                    </p>
                  </div>
                )}
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
            <h2 className="text-lg font-serif font-bold text-slate-800 mb-3">{t.summaryDayByDay}</h2>
            <div className="space-y-1">
              {displayPlan.days.map(d => (
                <p key={d.day_number} className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{t.day} {d.day_number}</span> — <RichText value={d.title} />
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
        {viewMode === 'edit' && (
          <div className="flex items-center gap-2 px-6 py-2 border-b bg-muted/20 print:hidden">
            <span className="text-xs text-muted-foreground">
              {displayPlan.days.length} dias · {displayPlan.days.reduce((s, d) => s + d.bullets.length, 0)} rubricas
            </span>
            <button type="button" onClick={() => setCollapsedDays(new Set())} className="text-[10px] text-[hsl(var(--info))] hover:underline">Expandir</button>
            <button type="button" onClick={() => setCollapsedDays(new Set(displayPlan.days.map(d => d.day_number)))} className="text-[10px] text-[hsl(var(--info))] hover:underline">Colapsar</button>
          </div>
        )}
        <DragDropContext onDragEnd={onBulletDragEnd}>
        <div className="divide-y">

          {displayPlan.days.map((day, dayIdx) => {
            const dayDuration = getDayDuration(day);
            const dayCollapsed = collapsedDays.has(day.day_number);
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
                        <button type="button" onClick={() => toggleDayCollapse(day.day_number)} className="text-muted-foreground hover:text-[hsl(var(--info))] shrink-0" title={dayCollapsed ? 'Expandir dia' : 'Colapsar dia'}>
                          {dayCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <span className="text-sm font-bold text-[hsl(var(--info))]">Day {day.day_number}</span>
                        <span className="text-xs text-muted-foreground">—</span>
                        <RichInput className="text-sm font-bold flex-1 h-8 py-1" value={day.title}
                          onChange={v => updateDay(dayIdx, { title: v })} />
                        <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{day.bullets.length} rubricas</span>
                      </div>
                      {!dayCollapsed && (
                      <>
                      <div className="flex gap-2 items-center">
                        <Input className="h-7 text-xs w-32" value={day.date}
                          onChange={e => updateDay(dayIdx, { date: e.target.value })} placeholder="DD-Mon-YYYY" />
                        <RichInput className="h-7 text-xs flex-1 py-1" value={day.subtitle}
                          onChange={v => updateDay(dayIdx, { subtitle: v })} placeholder="Subtitle..." />
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
                        <Droppable droppableId={`day-${dayIdx}`}>
                          {(dropProvided, dropSnapshot) => (
                            <div
                              ref={dropProvided.innerRef}
                              {...dropProvided.droppableProps}
                              className={cn("space-y-1.5 rounded transition-colors", dropSnapshot.isDraggingOver && "bg-[hsl(var(--info)/0.06)]")}
                            >
                              {day.bullets.map((bullet, bi) => {
                                const obj = toBulletObj(bullet);
                                return (
                                  <Draggable key={bi} draggableId={`d${dayIdx}-b${bi}`} index={bi}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        className={cn("flex items-center gap-1.5 bg-background", dragSnapshot.isDragging && "shadow-lg ring-1 ring-[hsl(var(--info)/0.3)] rounded")}
                                      >
                                        <span {...dragProvided.dragHandleProps} className="text-muted-foreground/50 hover:text-[hsl(var(--info))] cursor-grab active:cursor-grabbing shrink-0" title="Arrastar">
                                          <GripVertical className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="text-xs text-muted-foreground w-4 text-center shrink-0">{bi + 1}.</span>
                                        <RichInput className="h-7 text-xs flex-1 py-1" value={obj.text}
                                          onChange={v => updateBulletField(dayIdx, bi, 'text', v)} placeholder="Experience..." />
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
                                    )}
                                  </Draggable>
                                );
                              })}
                              {dropProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                        <div className="flex flex-wrap items-center gap-3">
                          <button onClick={() => addBullet(dayIdx)} className="text-[10px] text-[hsl(var(--info))] hover:underline flex items-center gap-1">
                            <Plus className="h-3 w-3" /> Adicionar item
                          </button>
                          <button onClick={() => setPickerTarget(dayIdx)} className="text-[10px] text-[hsl(var(--info))] hover:underline flex items-center gap-1">
                            <Package className="h-3 w-3" /> Importar produto do catálogo
                          </button>
                          <button onClick={() => removeDay(dayIdx)} className="text-[10px] text-destructive hover:underline flex items-center gap-1 ml-auto">
                            <X className="h-3 w-3" /> Remover dia
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input className="h-7 text-xs w-48" value={day.overnight}
                          onChange={e => updateDay(dayIdx, { overnight: e.target.value })} placeholder="Overnight city..." />
                        <Input className="h-7 text-xs flex-1 min-w-[240px]" value={day.mapUrl || ''}
                          onChange={e => updateDay(dayIdx, { mapUrl: e.target.value })}
                          placeholder="Google Maps link (rota do dia)..." />
                      </div>
                      {day.mapUrl && (() => {
                        const embed = toMapEmbedSrc(day.mapUrl);
                        if (!embed) return (
                          <div className="mt-2 p-2 text-[11px] rounded border border-amber-300 bg-amber-50 text-amber-800">
                            Link não embebível. Cola o link completo do google.com/maps (rota <code>/maps/dir/…</code> ou lugar <code>/maps/place/…</code>). Links curtos <code>maps.app.goo.gl</code> não funcionam como iframe.
                          </div>
                        );
                        return (
                          <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 aspect-[16/9]">
                            <iframe
                              src={embed}
                              className="w-full h-full"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title={`Mapa Dia ${day.day_number}`}
                            />
                          </div>
                        );
                      })()}
                      </>
                      )}
                    </div>
                  ) : (
                    <div className="pr-16">
                      <div className="mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-serif font-bold text-slate-800">{t.day} {day.day_number} — <RichText value={day.title} /></h3>
                          {dayDuration && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <Clock className="h-3 w-3" /> {dayDuration}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{day.date}</p>
                        <RichText as="p" className="text-sm italic text-slate-600 mt-1" value={day.subtitle} />
                      </div>
                      {day.images && day.images.filter(i => i.url).length > 0 && (
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {day.images.filter(i => i.url).map((img, i) => (
                            <div key={i} className="rounded-lg overflow-hidden aspect-[16/10]">
                              <img src={img.url} alt={img.caption || day.title} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mb-3">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-2">{t.itineraryIncluded}:</p>
                        <ul className="space-y-1.5">
                          {day.bullets.map((bullet, bi) => {
                            const obj = toBulletObj(bullet);
                            const dur = formatDuration(obj);
                            return (
                              <li key={bi} className="text-sm text-slate-700 flex items-start gap-2">
                                <span className="text-slate-400 mt-0.5">•</span>
                                <RichText as="span" className="flex-1" value={obj.text} />
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
                          {day.day_number === displayPlan.days.length ? t.departureFrom(day.overnight) : t.nightIn(day.overnight)}
                        </p>
                      )}
                      {day.mapUrl && (() => {
                        const embed = toMapEmbedSrc(day.mapUrl);
                        if (!embed) return null;
                        return (
                          <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 aspect-[16/9]" data-map-embed={day.mapUrl}>
                            <iframe
                              src={embed}
                              className="w-full h-full"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title={`Mapa Dia ${day.day_number}`}
                            />
                          </div>
                        );
                      })()}
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
                                 programContext={programContext}

                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
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
        </DragDropContext>

        {viewMode === 'edit' && (
          <div className="border-t border-slate-200 px-6 md:px-8 py-4 flex flex-wrap items-center gap-2 print:hidden">
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={addManualDay}>
              <PlusCircle className="h-3.5 w-3.5" /> Adicionar dia (manual)
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setPickerTarget('new')}>
              <Package className="h-3.5 w-3.5" /> Adicionar dia (produto do catálogo)
            </Button>
          </div>
        )}

        <ProductPickerDialog
          open={pickerTarget !== null}
          onOpenChange={o => { if (!o) setPickerTarget(null); }}
          onSelect={handleProductSelected}
        />


        {/* PRICING & CONDITIONS — Client-facing closing section (toggleable) */}
        {viewMode === 'edit' && (
          <div className="border-t border-slate-200 bg-white px-6 md:px-10 py-3 flex items-center gap-2 print:hidden">
            <input
              id="show-pricing-toggle"
              type="checkbox"
              checked={closing.showPricing !== false}
              onChange={e => setClosing(c => ({ ...c, showPricing: e.target.checked }))}
              className="h-4 w-4 accent-[hsl(var(--info))]"
            />
            <label htmlFor="show-pricing-toggle" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
              Incluir secção de Preço e Termos & Condições na proposta
            </label>
            {closing.showPricing === false && (
              <span className="text-[10px] text-amber-600 ml-2">— Secção oculta no link e no PDF</span>
            )}
          </div>
        )}
        {(viewMode === 'edit' || closing.showPricing !== false) && (
        <div className={`border-t-2 border-slate-200 bg-slate-50 p-6 md:p-10 space-y-6 print:break-before-page ${viewMode === 'edit' && closing.showPricing === false ? 'opacity-50' : ''}`}>
          {/* Price Header */}
          <div className={`pb-4 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-4 ${wetravelCheckoutUrl ? 'sm:justify-between text-center sm:text-left' : 'justify-center text-center'}`}>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{netPricing ? getPdfDict(language).totalPriceNet : t.totalPrice}</p>
              <p className="text-4xl font-serif font-bold text-slate-900">
                {totalPVP > 0 ? `€ ${totalPVP.toLocaleString('en-US')}` : '— € —'}
              </p>
              <div className={`flex items-center gap-3 mt-3 text-xs text-slate-600 ${wetravelCheckoutUrl ? 'justify-center sm:justify-start' : 'justify-center'}`}>
                <span>{t.adult(pax)}{paxChildren ? ` + ${t.child(paxChildren)}` : ''}{paxInfants ? ` + ${t.infant(paxInfants)}` : ''}</span>
                <span className="text-slate-300">·</span>
                <span>{displayPlan.days[0]?.date} – {displayPlan.days[displayPlan.days.length - 1]?.date}</span>
                <span className="text-slate-300">·</span>
                <span>{t.dayUnit(displayPlan.days.length)}</span>
              </div>
            </div>
            {wetravelCheckoutUrl && (
              <a
                href={wetravelCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md bg-[#0a2540] px-8 py-3.5 text-sm font-extrabold uppercase tracking-wider text-white no-underline shadow-sm"
                style={{ backgroundColor: '#0a2540', color: '#ffffff', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}
              >
                BOOK NOW
              </a>
            )}
          </div>


          {/* What's Included — Day by Day Summary or override */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-serif font-bold text-slate-800">{t.whatsIncluded}</h3>
              {viewMode === 'edit' && (
                <button
                  type="button"
                  className="text-[10px] text-[hsl(var(--info))] underline print:hidden"
                  onClick={() => setClosing(c => ({ ...c, inclusionsOverride: c.inclusionsOverride ? '' : displayPlan.days.map(d => `Day ${d.day_number} — ${d.title}\n${d.bullets.slice(0, 6).map(b => `• ${toBulletObj(b).text}`).join('\n')}`).join('\n\n') }))}
                >
                  {closing.inclusionsOverride ? 'Voltar ao auto (dias)' : 'Editar manualmente'}
                </button>
              )}
            </div>
            {viewMode === 'edit' && closing.inclusionsOverride !== undefined && closing.inclusionsOverride !== '' ? (
              <RichTextarea
                className="text-xs font-mono min-h-[180px]"
                value={closing.inclusionsOverride}
                onChange={v => setClosing(c => ({ ...c, inclusionsOverride: v }))}
              />
            ) : closing.inclusionsOverride ? (
              <div className="text-xs text-slate-700 whitespace-pre-wrap">{closing.inclusionsOverride}</div>
            ) : (
              <div className="space-y-2.5">
                {displayPlan.days.map(d => (
                  <div key={d.day_number} className="text-xs text-slate-700">
                    <p className="font-semibold text-slate-800">{t.day} {d.day_number} — {d.title}</p>
                    <ul className="mt-1 ml-3 space-y-0.5">
                      {d.bullets.slice(0, 6).map((b, i) => {
                        const obj = toBulletObj(b);
                        return <li key={i} className="text-slate-600">• {obj.text}</li>;
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reservation & Payment */}
          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-2">{t.paymentConditions}</h3>
            {viewMode === 'edit' ? (
              <RichTextarea
                className="text-xs min-h-[90px]"
                value={closing.payment}
                onChange={v => setClosing(c => ({ ...c, payment: v }))}
              />
            ) : (
              <RichText as="div" className="text-xs text-slate-700 whitespace-pre-wrap ml-3" value={closing.payment} preserveNewlines />
            )}
          </div>

          {/* Cancellations */}
          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-2">{t.cancellationConditions}</h3>
            {viewMode === 'edit' ? (
              <RichTextarea
                className="text-xs min-h-[90px]"
                value={closing.cancellation}
                onChange={v => setClosing(c => ({ ...c, cancellation: v }))}
              />
            ) : (
              <RichText as="div" className="text-xs text-slate-700 whitespace-pre-wrap ml-3" value={closing.cancellation} preserveNewlines />
            )}
          </div>

          {/* Important Notes */}
          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-2">{t.importantNotes}</h3>
            {viewMode === 'edit' ? (
              <RichTextarea
                className="text-xs min-h-[120px]"
                value={closing.importantNotes}
                onChange={v => setClosing(c => ({ ...c, importantNotes: v }))}
              />
            ) : (
              <RichText as="div" className="text-xs text-slate-600 whitespace-pre-wrap ml-3" value={closing.importantNotes} preserveNewlines />
            )}
          </div>

          {/* Closing Message */}
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-700 space-y-3 leading-relaxed">
            {viewMode === 'edit' ? (
              <RichTextarea
                className="text-xs min-h-[140px]"
                value={closing.closingMessage}
                onChange={v => setClosing(c => ({ ...c, closingMessage: v }))}
              />
            ) : (
              <RichText as="div" className="whitespace-pre-wrap" value={closing.closingMessage} preserveNewlines />
            )}
            <p className="italic text-slate-500">{t.noReservationNote}</p>
            <p className="font-serif font-semibold text-slate-800 pt-2 whitespace-pre-line">{t.bestRegards}</p>
          </div>
        </div>
        )}

        {/* ─── REVIEWS & ABOUT US (last page) ─── */}
        <div className="border-t-2 border-slate-200 bg-white p-6 md:p-10 space-y-8 print:break-before-page">
          <a
            href={ALL_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden border border-slate-200"
          >
            <img
              src={reviewsBanner.url}
              alt="Our Reviews — Your Tours Portugal"
              className="w-full h-auto aspect-[16/9] object-cover"
            />
          </a>

          <div>
            <h3 className="text-base font-serif font-bold text-slate-800 mb-3">{d.travellersSay}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {d.reviewsList.map((r, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}>
                  <p className="text-[11px] text-amber-500 tracking-widest">{'★'.repeat(r.stars)}</p>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{r.text}</p>
                  <p className="text-[11px] font-semibold text-slate-800 mt-2">{r.name}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-4">
              <a
                href={ALL_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md bg-[#0a2540] px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white no-underline"
                style={{ backgroundColor: '#0a2540', color: '#ffffff', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}
              >
                {REVIEWS_CTA[language?.toLowerCase() as keyof typeof REVIEWS_CTA] || REVIEWS_CTA.en}
              </a>
            </div>
          </div>

          <div
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5"
            style={{ backgroundColor: '#f8fafc', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}
          >
            <h3 className="text-base font-serif font-bold text-slate-800 mb-2">{d.aboutUs}</h3>
            <p className="text-xs text-slate-700 leading-relaxed">{d.aboutBody}</p>
            <img
              src={foundersAsset.url}
              alt="Your Tours Portugal founders"
              className="w-full rounded-lg border border-slate-200 object-cover mt-3"
              style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}
            />
            <p className="text-xs text-slate-700 leading-relaxed mt-3">{d.foundersBody}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                { label: 'reservas@yourtours.pt', href: 'mailto:reservas@yourtours.pt', bg: '#0a2540' },
                { label: 'yourtoursportugal.com', href: 'https://yourtoursportugal.com', bg: '#0a2540' },
                { label: '+351 919 473 029', href: 'https://wa.me/351919473029', bg: '#128c7e' },
              ].map(b => (
                <a
                  key={b.href}
                  href={b.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md px-4 py-2 text-[11px] font-bold text-white no-underline"
                  style={{ backgroundColor: b.bg, color: '#ffffff', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as any}
                >
                  {b.label}
                </a>
              ))}
            </div>
          </div>


        </div>
      </div>


    </div>
  );
};

export default TravelPlanProposal;
