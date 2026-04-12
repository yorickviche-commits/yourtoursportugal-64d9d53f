import { useParams } from 'react-router-dom';
import { useProposalByToken, useProposalAnnotations, useProposalEvents, useCreateAnnotation, useCreateEvent, useUpdateProposal, ProposalDay, Proposal } from '@/hooks/useProposalsQuery';
import { useState, useEffect, useRef, lazy, Suspense, Component, ReactNode } from 'react';
import { MessageSquare, Check, Star, Phone, Mail, Globe, ChevronDown, ChevronUp, Send, X, Clock, MapPin, Hotel } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy load map to avoid react-leaflet context crash
const LazyMap = lazy(() => import('@/components/proposal/ProposalMap'));

// Error boundary for map
class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="h-full flex items-center justify-center bg-stone-100 text-stone-400">Carte indisponible</div>;
    return this.props.children;
  }
}

const PublicProposalPage = () => {
  const { token } = useParams<{ token: string }>();
  const { data: proposal, isLoading } = useProposalByToken(token || '');
  const { data: annotations = [] } = useProposalAnnotations(proposal?.id || '');
  const { data: events = [] } = useProposalEvents(proposal?.id || '');
  const createAnnotation = useCreateAnnotation();
  const createEvent = useCreateEvent();
  const updateProposal = useUpdateProposal();
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [notepadTab, setNotepadTab] = useState<'general' | 'day' | 'history'>('general');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [approvalMode, setApprovalMode] = useState<'approve' | 'revision' | null>(null);
  const [clientName, setClientName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Log opened event
  useEffect(() => {
    if (proposal?.id) {
      createEvent.mutate({
        proposal_id: proposal.id,
        event_type: 'opened',
        actor_name: 'Client',
        actor_email: null,
        note: null,
      });
    }
    // eslint-disable-next-line
  }, [proposal?.id]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="animate-pulse text-stone-400">A carregar proposta...</div>
    </div>
  );

  if (!proposal) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <h1 className="text-2xl font-serif text-stone-800 mb-2">Proposta não encontrada</h1>
        <p className="text-stone-500">O link pode estar expirado ou incorreto.</p>
      </div>
    </div>
  );

  const days = proposal.days || [];

  const handleSubmitAnnotation = (level: string, dayIdx?: number, itemIdx?: number) => {
    if (!noteText.trim()) return;
    createAnnotation.mutate({
      proposal_id: proposal.id,
      level,
      target_day_index: dayIdx ?? null,
      target_item_index: itemIdx ?? null,
      author_type: 'client',
      author_name: clientName || proposal.client_name,
      author_email: proposal.client_email || null,
      content: noteText,
      is_resolved: false,
      parent_id: null,
    });
    createEvent.mutate({
      proposal_id: proposal.id,
      event_type: 'annotation_added',
      actor_name: clientName || proposal.client_name,
      actor_email: proposal.client_email || null,
      note: noteText.slice(0, 100),
    });
    setNoteText('');
  };

  const handleApprove = () => {
    updateProposal.mutate({ id: proposal.id, status: 'approved', approved_at: new Date().toISOString() });
    createEvent.mutate({
      proposal_id: proposal.id,
      event_type: 'approved',
      actor_name: clientName || proposal.client_name,
      actor_email: proposal.client_email || null,
      note: noteText || null,
    });
    setSubmitted(true);
  };

  const handleRevision = () => {
    if (!noteText.trim()) return;
    updateProposal.mutate({ id: proposal.id, status: 'revision_requested' });
    createEvent.mutate({
      proposal_id: proposal.id,
      event_type: 'revision_requested',
      actor_name: clientName || proposal.client_name,
      actor_email: proposal.client_email || null,
      note: noteText,
    });
    handleSubmitAnnotation('proposal');
    setSubmitted(true);
  };

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-serif text-stone-800 mb-3">
          Merci, {clientName || proposal.client_name} !
        </h1>
        <p className="text-stone-500">
          Votre réponse a été enregistrée. L'équipe Your Tours Portugal vous contactera dans les 24 heures.
        </p>
      </div>
    </div>
  );

  const statusBadge = proposal.status === 'approved' ? (
    <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium">✓ Approuvé</span>
  ) : proposal.status === 'revision_requested' ? (
    <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-medium">⟳ Modifications demandées</span>
  ) : null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* ─── HERO ─── */}
      <section className="relative h-[60vh] min-h-[400px] w-full">
        <img src={proposal.hero_image_url || 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600'} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 text-white">
          <div className="max-w-4xl">
            {statusBadge && <div className="mb-3">{statusBadge}</div>}
            <h1 className="text-3xl md:text-5xl font-serif font-bold leading-tight mb-3">{proposal.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-white/80">
              <span>{proposal.client_name}</span>
              {proposal.date_range && <span>• {proposal.date_range}</span>}
              {proposal.booking_ref && <span>• {proposal.booking_ref}</span>}
              {proposal.participants && <span>• {proposal.participants}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ─── STICKY NAV ─── */}
      <nav className="sticky top-0 z-30 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-2 text-sm no-scrollbar">
            <a href="#summary" className="shrink-0 px-3 py-1.5 rounded-full hover:bg-stone-100 text-stone-600 font-medium">Résumé</a>
            {days.map((d: ProposalDay) => (
              <a key={d.day_number} href={`#day-${d.day_number}`} className="shrink-0 px-3 py-1.5 rounded-full hover:bg-stone-100 text-stone-600">
                Jour {d.day_number}
              </a>
            ))}
            <a href="#map" className="shrink-0 px-3 py-1.5 rounded-full hover:bg-stone-100 text-stone-600">Carte</a>
            <a href="#reviews" className="shrink-0 px-3 py-1.5 rounded-full hover:bg-stone-100 text-stone-600">Avis</a>
            <a href="#about" className="shrink-0 px-3 py-1.5 rounded-full hover:bg-stone-100 text-stone-600">À propos</a>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        {/* ─── SUMMARY ─── */}
        <section id="summary">
          <h2 className="text-2xl font-serif text-stone-800 mb-4">Résumé du voyage</h2>
          <p className="text-stone-600 leading-relaxed mb-6">{proposal.summary_text}</p>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <button onClick={() => setNavOpen(!navOpen)} className="flex items-center justify-between w-full text-left">
              <span className="font-medium text-stone-700">Programme jour par jour</span>
              {navOpen ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
            </button>
            {navOpen && (
              <div className="mt-3 space-y-1">
                {days.map((d: ProposalDay) => (
                  <a key={d.day_number} href={`#day-${d.day_number}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 text-sm text-stone-600">
                    <span className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-xs font-bold text-stone-500">J{d.day_number}</span>
                    <div>
                      <span className="font-medium text-stone-800">{d.title}</span>
                      {d.subtitle && <span className="text-stone-400 ml-2">— {d.subtitle}</span>}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── DAY BY DAY ─── */}
        {days.map((day: ProposalDay, idx: number) => (
          <section key={day.day_number} id={`day-${day.day_number}`} className="scroll-mt-16">
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
              {day.cover_image_url && (
                <div className="relative h-56 md:h-72">
                  <img src={day.cover_image_url} alt={day.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5 text-white">
                    <div className="text-xs uppercase tracking-wider opacity-75 mb-1">{day.date_label}</div>
                    <h3 className="text-2xl font-serif font-bold">{day.title}</h3>
                    {day.subtitle && <p className="text-sm text-white/80 mt-1">{day.subtitle}</p>}
                  </div>
                </div>
              )}
              {!day.cover_image_url && (
                <div className="p-5 border-b border-stone-100">
                  <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">{day.date_label}</div>
                  <h3 className="text-xl font-serif font-bold text-stone-800">{day.title}</h3>
                  {day.subtitle && <p className="text-sm text-stone-500 mt-1">{day.subtitle}</p>}
                </div>
              )}

              <div className="p-5">
                <h4 className="text-xs uppercase tracking-wider text-stone-400 font-semibold mb-3">Itinéraire & Inclus</h4>
                <ul className="space-y-2.5">
                  {day.items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-stone-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {day.accommodation && (
                  <div className="mt-5 p-4 bg-stone-50 rounded-xl flex items-start gap-3">
                    <Hotel className="h-5 w-5 text-stone-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-stone-800">{day.accommodation.hotel_name}</div>
                      {day.accommodation.note && <div className="text-xs text-stone-500 mt-0.5">{day.accommodation.note}</div>}
                    </div>
                  </div>
                )}

                {/* Comment this day link */}
                <button
                  onClick={() => { setSelectedDay(idx); setNotepadTab('day'); setNotepadOpen(true); }}
                  className="mt-4 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1 transition-colors"
                >
                  <MessageSquare className="h-3 w-3" /> Commenter cette journée
                </button>
              </div>
            </div>
          </section>
        ))}

        {/* ─── MAP ─── */}
        {proposal.map_stops.length > 0 && (
          <section id="map">
            <h2 className="text-2xl font-serif text-stone-800 mb-4">Carte du voyage</h2>
            <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm h-[400px]">
              <MapErrorBoundary>
                <Suspense fallback={<div className="h-full flex items-center justify-center bg-stone-100 text-stone-400">Chargement de la carte...</div>}>
                  <LazyMap stops={proposal.map_stops} />
                </Suspense>
              </MapErrorBoundary>
            </div>
          </section>
        )}

        {/* ─── REVIEWS ─── */}
        <section id="reviews">
          <h2 className="text-2xl font-serif text-stone-800 mb-4">Ce que disent nos voyageurs</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { name: 'Sophie M.', text: 'Un voyage inoubliable ! L\'équipe a tout organisé à la perfection. Les guides étaient passionnés et les hôtels magnifiques.', stars: 5 },
              { name: 'Jean-Pierre L.', text: 'Service exceptionnel du début à la fin. La personnalisation du voyage était remarquable. Nous recommandons vivement !', stars: 5 },
              { name: 'Marie C.', text: 'Notre guide francophone était formidable. Chaque détail était pensé. Le Portugal est encore plus beau vu de l\'intérieur.', stars: 5 },
              { name: 'François D.', text: 'Merci pour cette expérience unique. L\'artisanat local et la gastronomie étaient les points forts de notre séjour.', stars: 5 },
            ].map((review, i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex gap-1 mb-2">
                  {Array.from({ length: review.stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-stone-600 mb-3 italic">"{review.text}"</p>
                <p className="text-xs font-medium text-stone-800">{review.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── ABOUT US ─── */}
        <section id="about" className="pb-32">
          <h2 className="text-2xl font-serif text-stone-800 mb-4">À propos de Your Tours Portugal</h2>
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <p className="text-stone-600 leading-relaxed mb-6">
              Your Tours Portugal est une agence de voyages sur mesure spécialisée dans les expériences authentiques au Portugal.
              Nous créons des itinéraires personnalisés qui révèlent le meilleur de la culture, de la gastronomie et de l'artisanat portugais,
              avec des guides locaux francophones passionnés.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="https://wa.me/351961615400" target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
                <Phone className="h-4 w-4" /> WhatsApp
              </a>
              <a href="mailto:info@yourtoursportugal.com" className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors">
                <Mail className="h-4 w-4" /> Email
              </a>
              <a href="https://yourtoursportugal.com" target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors">
                <Globe className="h-4 w-4" /> Site web
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ─── FLOATING ANNOTATION BUTTON ─── */}
      <button
        onClick={() => setNotepadOpen(true)}
        className="fixed bottom-24 right-5 z-40 w-12 h-12 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-amber-600 transition-colors"
        title="Ajouter une note"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* ─── APPROVAL BAR ─── */}
      {proposal.status === 'sent' && !approvalMode && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 shadow-2xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
            <button onClick={() => setApprovalMode('approve')} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors">
              ✓ Approuver ce programme
            </button>
            <button onClick={() => setApprovalMode('revision')} className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 transition-colors">
              ⟳ Demander des modifications
            </button>
            <button onClick={() => { setNotepadTab('general'); setNotepadOpen(true); }} className="px-4 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium text-sm hover:bg-stone-200 transition-colors">
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── APPROVAL PANEL ─── */}
      {approvalMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif font-bold text-stone-800">
                {approvalMode === 'approve' ? 'Approuver le programme' : 'Demander des modifications'}
              </h3>
              <button onClick={() => setApprovalMode(null)}><X className="h-5 w-5 text-stone-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Votre nom"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={approvalMode === 'approve' ? 'Note optionnelle...' : 'Décrivez les modifications souhaitées...'}
                rows={4}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={approvalMode === 'approve' ? handleApprove : handleRevision}
                disabled={approvalMode === 'revision' && !noteText.trim()}
                className={cn(
                  "w-full px-4 py-3 rounded-xl font-medium text-sm text-white transition-colors",
                  approvalMode === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600',
                  approvalMode === 'revision' && !noteText.trim() && 'opacity-50 cursor-not-allowed'
                )}
              >
                {approvalMode === 'approve' ? 'Confirmer l\'approbation' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── NOTEPAD DRAWER ─── */}
      {notepadOpen && (
        <div className="fixed inset-0 z-50 md:right-0 md:left-auto flex">
          <div className="hidden md:block flex-1" onClick={() => setNotepadOpen(false)} />
          <div className="w-full md:w-[420px] bg-white shadow-2xl flex flex-col h-full md:border-l border-stone-200">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="font-serif font-bold text-stone-800">Bloc-notes</h3>
              <button onClick={() => setNotepadOpen(false)}><X className="h-5 w-5 text-stone-400" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-200">
              {(['general', 'day', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setNotepadTab(tab)}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                    notepadTab === tab ? 'text-amber-600 border-b-2 border-amber-500' : 'text-stone-400 hover:text-stone-600'
                  )}
                >
                  {tab === 'general' ? 'Note générale' : tab === 'day' ? 'Par jour' : 'Historique'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {notepadTab === 'general' && (
                <div className="space-y-3">
                  <p className="text-sm text-stone-500">Commentaire global sur le programme</p>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Votre commentaire..."
                    rows={5}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    onClick={() => handleSubmitAnnotation('proposal')}
                    disabled={!noteText.trim()}
                    className="w-full px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 inline mr-2" />Envoyer
                  </button>
                  {/* Show existing general annotations */}
                  {annotations.filter(a => a.level === 'proposal').map(a => (
                    <AnnotationCard key={a.id} annotation={a} />
                  ))}
                </div>
              )}

              {notepadTab === 'day' && (
                <div className="space-y-2">
                  {days.map((day: ProposalDay, idx: number) => (
                    <DayAnnotationSection
                      key={idx}
                      day={day}
                      dayIdx={idx}
                      isOpen={selectedDay === idx}
                      onToggle={() => setSelectedDay(selectedDay === idx ? null : idx)}
                      annotations={annotations.filter(a => a.target_day_index === idx)}
                      noteText={noteText}
                      setNoteText={setNoteText}
                      onSubmit={(level, itemIdx) => handleSubmitAnnotation(level, idx, itemIdx)}
                    />
                  ))}
                </div>
              )}

              {notepadTab === 'history' && (
                <div className="space-y-3">
                  {[...annotations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(a => (
                    <AnnotationCard key={a.id} annotation={a} showBadge />
                  ))}
                  {annotations.length === 0 && (
                    <p className="text-sm text-stone-400 text-center py-8">Aucune annotation pour le moment</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AnnotationCard = ({ annotation, showBadge }: { annotation: any; showBadge?: boolean }) => (
  <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
    <div className="flex items-center gap-2 mb-1">
      {showBadge && (
        <span className="text-[10px] px-2 py-0.5 bg-stone-200 text-stone-600 rounded-full font-medium">
          {annotation.level === 'proposal' ? 'Général' : annotation.level === 'day' ? `Jour ${(annotation.target_day_index ?? 0) + 1}` : `Item`}
        </span>
      )}
      <span className={cn("w-2 h-2 rounded-full", annotation.is_resolved ? "bg-emerald-400" : "bg-amber-400")} />
      <span className="text-xs font-medium text-stone-700">{annotation.author_name}</span>
      <span className="text-[10px] text-stone-400 ml-auto">{new Date(annotation.created_at).toLocaleDateString()}</span>
    </div>
    <p className="text-sm text-stone-600">{annotation.content}</p>
  </div>
);

const DayAnnotationSection = ({ day, dayIdx, isOpen, onToggle, annotations, noteText, setNoteText, onSubmit }: any) => {
  const [itemComment, setItemComment] = useState<number | null>(null);
  const [itemText, setItemText] = useState('');

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
        <span className="w-7 h-7 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center text-xs font-bold">J{day.day_number}</span>
        <span className="text-sm font-medium text-stone-800 flex-1 truncate">{day.title}</span>
        <span className="text-xs text-stone-400">{annotations.filter((a: any) => a.level === 'day').length}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder={`Commentaire pour Jour ${day.day_number}...`}
            rows={2}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            onClick={() => onSubmit('day')}
            disabled={!noteText.trim()}
            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            Envoyer
          </button>

          {/* Day-level annotations */}
          {annotations.filter((a: any) => a.level === 'day' && a.target_item_index === null).map((a: any) => (
            <AnnotationCard key={a.id} annotation={a} />
          ))}

          {/* Items */}
          <div className="space-y-1 mt-2">
            {day.items.map((item: string, i: number) => (
              <div key={i}>
                <div className="flex items-center gap-2 text-xs text-stone-500 py-1">
                  <span className="flex-1 truncate">{item}</span>
                  <button onClick={() => setItemComment(itemComment === i ? null : i)} className="shrink-0 p-1 hover:bg-stone-100 rounded">
                    <MessageSquare className="h-3 w-3" />
                  </button>
                </div>
                {itemComment === i && (
                  <div className="flex gap-2 pb-2">
                    <input
                      value={itemText}
                      onChange={e => setItemText(e.target.value)}
                      placeholder="Commentaire..."
                      className="flex-1 px-2 py-1 border border-stone-200 rounded text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (itemText.trim()) {
                          setNoteText(itemText);
                          onSubmit('item', i);
                          setItemText('');
                          setItemComment(null);
                        }
                      }}
                      className="px-2 py-1 bg-amber-500 text-white rounded text-xs"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {/* Item-level annotations */}
                {annotations.filter((a: any) => a.target_item_index === i).map((a: any) => (
                  <AnnotationCard key={a.id} annotation={a} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProposalPage;
