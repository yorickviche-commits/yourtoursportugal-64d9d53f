import { useParams } from 'react-router-dom';
import { useProposalByToken, useProposalAnnotations, useProposalEvents, useCreateAnnotation, useCreateEvent, useUpdateProposal, ProposalDay, Proposal } from '@/hooks/useProposalsQuery';
import { useState, useEffect, useRef, lazy, Suspense, Component, ReactNode } from 'react';
import { MessageSquare, Check, Star, Phone, Mail, Globe, ChevronDown, ChevronUp, Send, X, Clock, MapPin, Hotel, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProposalDict, resolveProposalLang, encodeSentiment, decodeSentiment, Sentiment } from '@/lib/proposalI18n';
import reviewsBanner from '@/assets/our-reviews-banner.png.asset.json';
import { toMapEmbedSrc } from '@/lib/mapEmbed';
import { RichText, stripBoldMarkers } from '@/lib/richText';


// Lazy load map to avoid react-leaflet context crash
const LazyMap = lazy(() => import('@/components/proposal/ProposalMap'));

// Error boundary for map
class MapErrorBoundary extends Component<{ children: ReactNode; fallback: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="h-full flex items-center justify-center bg-sky-50 text-sky-300">{this.props.fallback}</div>;
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
  const [sentiment, setSentiment] = useState<Sentiment>(null);
  const [submitted, setSubmitted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [openItem, setOpenItem] = useState<{ day: number; item: number; sentiment: Sentiment } | null>(null);
  const [itemDraft, setItemDraft] = useState('');

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

  // Load Elfsight platform script once for reviews widget
  useEffect(() => {
    if (document.querySelector('script[src="https://elfsightcdn.com/platform.js"]')) return;
    const s = document.createElement('script');
    s.src = 'https://elfsightcdn.com/platform.js';
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const effectiveLang = resolveProposalLang(proposal);
  const dict = getProposalDict(effectiveLang);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50">
      <div className="animate-pulse text-sky-400">{dict.loading}</div>
    </div>
  );

  if (!proposal) return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50">
      <div className="text-center">
        <h1 className="text-2xl font-serif text-slate-800 mb-2">{dict.notFound}</h1>
        <p className="text-slate-500">{dict.notFoundHint}</p>
      </div>
    </div>
  );


  const days = proposal.days || [];

  const handleSubmitAnnotation = (level: string, dayIdx?: number, itemIdx?: number, overrideText?: string, overrideSentiment?: Sentiment) => {
    const baseText = (overrideText ?? noteText).trim();
    const eff = overrideSentiment !== undefined ? overrideSentiment : sentiment;
    if (!baseText && !eff) return;
    const content = encodeSentiment(baseText, eff);
    createAnnotation.mutate({
      proposal_id: proposal.id,
      level,
      target_day_index: dayIdx ?? null,
      target_item_index: itemIdx ?? null,
      author_type: 'client',
      author_name: clientName || proposal.client_name,
      author_email: proposal.client_email || null,
      content,
      is_resolved: false,
      parent_id: null,
    });
    createEvent.mutate({
      proposal_id: proposal.id,
      event_type: 'annotation_added',
      actor_name: clientName || proposal.client_name,
      actor_email: proposal.client_email || null,
      note: content.slice(0, 100),
    });
    setNoteText('');
    setSentiment(null);
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
    <div className="min-h-screen flex items-center justify-center bg-sky-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-serif text-slate-800 mb-3">
          {dict.thanks(clientName || proposal.client_name)}
        </h1>
        <p className="text-slate-500">{dict.thanksBody}</p>
      </div>
    </div>
  );

  const statusBadge = proposal.status === 'approved' ? (
    <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium">{dict.approved}</span>
  ) : proposal.status === 'revision_requested' ? (
    <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-medium">{dict.revisionRequested}</span>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ─── HERO ─── */}
      <section className="relative h-[60vh] min-h-[400px] w-full">
        <img src={proposal.hero_image_url || 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600'} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a2540]/80 via-[#0a2540]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 text-white">
          <div className="max-w-4xl">
            {statusBadge && <div className="mb-3">{statusBadge}</div>}
            <RichText as="h1" className="text-3xl md:text-5xl font-serif font-bold leading-tight mb-3" value={proposal.title} />
            <div className="flex flex-wrap gap-4 text-sm text-white/80">
              <span>{proposal.client_name}</span>
              {proposal.date_range && <span>• {proposal.date_range}</span>}
              {proposal.booking_ref && <span>• {proposal.booking_ref}</span>}
              {proposal.participants && <span>• {proposal.participants}</span>}
            </div>
            {(proposal as any).wetravel_checkout_url && (
              <div className="mt-6">
                <a
                  href={(proposal as any).wetravel_checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition"
                >
                  {dict.bookNow}
                </a>
                <p className="mt-2 text-xs text-white/80">
                  {(proposal as any).deposit_amount_eur
                    ? dict.depositSuffix(String((proposal as any).deposit_amount_eur), (proposal as any).deposit_percent ?? 50)
                    : dict.defaultDepositNote}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── STICKY NAV ─── */}
      <nav className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-2 text-sm no-scrollbar">
            <a href="#summary" className="shrink-0 px-3 py-1.5 rounded-full hover:bg-sky-50 text-slate-600 font-medium">{dict.summary}</a>
            {days.map((d: ProposalDay) => (
              <a key={d.day_number} href={`#day-${d.day_number}`} className="shrink-0 px-3 py-1.5 rounded-full hover:bg-sky-50 text-slate-600">
                {dict.day} {d.day_number}
              </a>
            ))}
            <a href="#reviews" className="shrink-0 px-3 py-1.5 rounded-full hover:bg-sky-50 text-slate-600">{dict.reviews}</a>
            <a href="#about" className="shrink-0 px-3 py-1.5 rounded-full hover:bg-sky-50 text-slate-600">{dict.about}</a>
          </div>
        </div>

      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        {/* ─── SUMMARY ─── */}
        <section id="summary">
          <h2 className="text-2xl font-serif text-slate-800 mb-4">{dict.tripSummary}</h2>
          <RichText as="p" className="text-slate-600 leading-relaxed mb-6 whitespace-pre-wrap" value={proposal.summary_text} preserveNewlines />
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <button onClick={() => setNavOpen(!navOpen)} className="flex items-center justify-between w-full text-left">
              <span className="font-medium text-slate-700">{dict.programDayByDay}</span>
              {navOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {navOpen && (
              <div className="mt-3 space-y-1">
                {days.map((d: ProposalDay) => (
                  <a key={d.day_number} href={`#day-${d.day_number}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sky-50 text-sm text-slate-600">
                    <span className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-xs font-bold text-sky-600">{dict.dayShort(d.day_number)}</span>
                    <div>
                      <RichText className="font-medium text-slate-800" value={d.title} />
                      {d.subtitle && <RichText className="text-slate-400 ml-2" value={`— ${d.subtitle}`} />}
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
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {day.cover_image_url && (
                <div className="relative h-56 md:h-72">
                  <img src={day.cover_image_url} alt={stripBoldMarkers(day.title)} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a2540]/60 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5 text-white">
                    <div className="text-xs uppercase tracking-wider opacity-75 mb-1">{day.date_label}</div>
                    <RichText as="h3" className="text-2xl font-serif font-bold" value={day.title} />
                    {day.subtitle && <RichText as="p" className="text-sm text-white/80 mt-1" value={day.subtitle} />}
                  </div>
                </div>
              )}
              {!day.cover_image_url && (
                <div className="p-5 border-b border-slate-100">
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">{day.date_label}</div>
                  <RichText as="h3" className="text-xl font-serif font-bold text-slate-800" value={day.title} />
                  {day.subtitle && <RichText as="p" className="text-sm text-slate-500 mt-1" value={day.subtitle} />}
                </div>
              )}

              <div className="p-5">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">{dict.itineraryIncludes}</h4>
                <ul className="space-y-1.5">
                  {day.items.map((item, i) => {
                    const itemAnns = annotations.filter((a: any) => a.level === 'day' && a.target_day_index === idx && a.target_item_index === i);
                    const itemSentiments = itemAnns.map(a => decodeSentiment(a.content || '').sentiment);
                    const isLiked = itemSentiments.includes('like');
                    const isChange = itemSentiments.includes('dislike');
                    const isOpen = openItem?.day === idx && openItem?.item === i;
                    return (
                      <li key={i} className={cn(
                        'rounded-lg transition-colors',
                        isLiked && 'bg-emerald-50',
                        isChange && 'bg-amber-50',
                        !isLiked && !isChange && 'hover:bg-slate-50',
                      )}>
                        <div className="flex items-start gap-2 px-2 py-1.5">
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full mt-2 shrink-0',
                            isLiked ? 'bg-emerald-500' : isChange ? 'bg-amber-500' : 'bg-sky-400',
                          )} />
                          <RichText className="flex-1 text-sm text-slate-700" value={item} />
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                if (isLiked) return; // already liked
                                handleSubmitAnnotation('day', idx, i, '', 'like');
                                setOpenItem({ day: idx, item: i, sentiment: 'like' });
                                setItemDraft('');
                              }}
                              title={dict.sentimentLike}
                              className={cn(
                                'p-1.5 rounded-md transition-all',
                                isLiked
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-100',
                              )}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (!isChange) handleSubmitAnnotation('day', idx, i, '', 'dislike');
                                setOpenItem(isOpen ? null : { day: idx, item: i, sentiment: 'dislike' });
                                setItemDraft('');
                              }}
                              title={dict.sentimentDislike}
                              className={cn(
                                'p-1.5 rounded-md transition-all',
                                isChange
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'text-slate-300 hover:text-amber-600 hover:bg-amber-100',
                              )}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Existing comments for this item */}
                        {itemAnns.filter(a => decodeSentiment(a.content || '').text).map(a => {
                          const { sentiment: s, text } = decodeSentiment(a.content || '');
                          return (
                            <div key={a.id} className={cn(
                              'mx-2 mb-1.5 px-3 py-1.5 rounded-md text-xs border-l-2',
                              s === 'like' ? 'border-emerald-400 bg-white text-emerald-800' :
                              s === 'dislike' ? 'border-amber-400 bg-white text-amber-800' :
                              'border-sky-400 bg-white text-slate-700',
                            )}>
                              <div className="font-medium text-[10px] uppercase tracking-wide opacity-60 mb-0.5">{a.author_name}</div>
                              <div>{text}</div>
                            </div>
                          );
                        })}

                        {/* Inline comment composer */}
                        {isOpen && (
                          <div className={cn(
                            'mx-2 mb-2 p-2 rounded-md border',
                            openItem?.sentiment === 'like' ? 'border-emerald-200 bg-white' : 'border-amber-200 bg-white',
                          )}>
                            <textarea
                              value={itemDraft}
                              onChange={e => setItemDraft(e.target.value)}
                              placeholder={dict.dayCommentPlaceholder(idx + 1)}
                              className="w-full text-sm bg-transparent resize-none outline-none placeholder:text-slate-400"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-1">
                              <button
                                onClick={() => { setOpenItem(null); setItemDraft(''); }}
                                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
                              >
                                {dict.send === 'Send' ? 'Cancel' : (dict.send === 'Enviar' ? 'Cancelar' : (dict.send === 'Envoyer' ? 'Annuler' : (dict.send === 'Invia' ? 'Annulla' : (dict.send === 'Senden' ? 'Abbrechen' : 'Cancel'))))}
                              </button>
                              <button
                                onClick={() => {
                                  if (!itemDraft.trim()) { setOpenItem(null); return; }
                                  handleSubmitAnnotation('day', idx, i, itemDraft.trim(), openItem?.sentiment ?? null);
                                  setOpenItem(null);
                                  setItemDraft('');
                                }}
                                className={cn(
                                  'text-xs px-3 py-1 rounded-md text-white font-medium',
                                  openItem?.sentiment === 'like' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600',
                                )}
                              >
                                <Send className="h-3 w-3 inline mr-1" /> {dict.send}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {day.accommodation && (
                  <div className="mt-5 p-4 bg-sky-50 rounded-xl flex items-start gap-3">
                    <Hotel className="h-5 w-5 text-sky-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{day.accommodation.hotel_name}</div>
                      {day.accommodation.note && <div className="text-xs text-slate-500 mt-0.5">{day.accommodation.note}</div>}
                    </div>
                  </div>
                )}

                {day.map_url && (() => {
                  const embed = toMapEmbedSrc(day.map_url);
                  return (
                    <div className="mt-5">
                      {embed && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 aspect-[16/9]">
                          <iframe
                            src={embed}
                            className="w-full h-full"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title={`Map — Day ${day.day_number}`}
                          />
                        </div>
                      )}
                      <a
                        href={day.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-sky-600 hover:text-sky-700 font-medium"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Open route in Google Maps →
                      </a>
                    </div>
                  );
                })()}

                {/* Day images (2 per day from Travel Planner) */}
                {(day as any).images?.length > 0 && (
                  <div className={cn(
                    "mt-5 gap-3",
                    (day as any).images.length === 1 ? "flex" : "grid grid-cols-2"
                  )}>
                    {(day as any).images.map((img: { url: string; caption?: string }, imgIdx: number) => (
                      <div key={imgIdx} className="relative rounded-xl overflow-hidden aspect-[16/10]">
                        <img src={img.url} alt={img.caption || day.title} className="w-full h-full object-cover" />
                        {img.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                            <span className="text-xs text-white/90">{img.caption}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment this day link */}
                <button
                  onClick={() => { setSelectedDay(idx); setNotepadTab('day'); setNotepadOpen(true); }}
                  className="mt-4 text-xs text-slate-400 hover:text-sky-600 flex items-center gap-1 transition-colors"
                >
                  <MessageSquare className="h-3 w-3" /> {dict.commentThisDay}
                </button>
              </div>
            </div>
          </section>
        ))}

        {/* ─── PRICING & CONDITIONS ─── */}
        {(proposal as any).closing_terms?.showPricing !== false && (
          <PricingConditions proposal={proposal} lang={effectiveLang} />
        )}



        {/* ─── MAP ─── */}
        {proposal.map_stops.length > 0 && (
          <section id="map">
            <h2 className="text-2xl font-serif text-slate-800 mb-4">{dict.tripMap}</h2>
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm h-[400px]">
              <MapErrorBoundary fallback={dict.mapUnavailable}>
                <Suspense fallback={<div className="h-full flex items-center justify-center bg-sky-50 text-sky-300">{dict.mapLoading}</div>}>
                  <LazyMap stops={proposal.map_stops} />
                </Suspense>
              </MapErrorBoundary>
            </div>
          </section>
        )}

        {/* ─── REVIEWS ─── */}
        <section id="reviews">
          {/* Banner image above reviews */}
          <a
            href="https://yourtoursportugal.com/our-reviews/"
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group"
          >
            <img
              src={reviewsBanner.url}
              alt="Our Reviews — real moments from Your Tours travellers"
              loading="lazy"
              className="w-full h-auto aspect-[16/9] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </a>

          {/* Elfsight Reviews Widget */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
            <div className="elfsight-app-a04148b9-a03c-4993-a99a-2ee0f39b2406" data-elfsight-app-lazy />
            <div className="flex justify-center mt-4">
              <a
                href="https://yourtoursportugal.com/our-reviews/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm"
              >
                <Star className="h-4 w-4 fill-white text-white" />
                Read all reviews
              </a>
            </div>
          </div>
        </section>

        {/* ─── ABOUT US ─── */}
        <section id="about" className="pb-32">
          <h2 className="text-2xl font-serif text-slate-800 mb-4">{dict.aboutUs}</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-slate-600 leading-relaxed mb-6">{dict.aboutBody}</p>
            <div className="flex flex-wrap gap-3">
              <a href="https://wa.me/351961615400" target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
                <Phone className="h-4 w-4" /> WhatsApp
              </a>
              <a href="mailto:info@yourtoursportugal.com" className="flex items-center gap-2 px-4 py-2 bg-sky-100 text-sky-700 rounded-lg text-sm font-medium hover:bg-sky-200 transition-colors">
                <Mail className="h-4 w-4" /> Email
              </a>
              <a href="https://yourtoursportugal.com" target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                <Globe className="h-4 w-4" /> {dict.website}
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ─── FLOATING ANNOTATION BUTTON ─── */}
      <button
        onClick={() => setNotepadOpen(true)}
        className="fixed bottom-24 right-5 z-40 w-12 h-12 bg-sky-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-sky-600 transition-colors"
        title={dict.addNote}
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* ─── APPROVAL BAR ─── */}
      {proposal.status === 'sent' && !approvalMode && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-2xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
            <button onClick={() => setApprovalMode('approve')} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors">
              {dict.approveProgram}
            </button>
            <button onClick={() => setApprovalMode('revision')} className="flex-1 px-4 py-3 bg-sky-500 text-white rounded-xl font-medium text-sm hover:bg-sky-600 transition-colors">
              {dict.requestChanges}
            </button>
            <button onClick={() => { setNotepadTab('general'); setNotepadOpen(true); }} className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-200 transition-colors">
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
              <h3 className="text-lg font-serif font-bold text-slate-800">
                {approvalMode === 'approve' ? dict.approveTitle : dict.requestTitle}
              </h3>
              <button onClick={() => setApprovalMode(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder={dict.yourName}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={approvalMode === 'approve' ? dict.approveNotePlaceholder : dict.requestNotePlaceholder}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <button
                onClick={approvalMode === 'approve' ? handleApprove : handleRevision}
                disabled={approvalMode === 'revision' && !noteText.trim()}
                className={cn(
                  "w-full px-4 py-3 rounded-xl font-medium text-sm text-white transition-colors",
                  approvalMode === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-500 hover:bg-sky-600',
                  approvalMode === 'revision' && !noteText.trim() && 'opacity-50 cursor-not-allowed'
                )}
              >
                {approvalMode === 'approve' ? dict.confirmApprove : dict.sendRequest}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── NOTEPAD DRAWER ─── */}
      {notepadOpen && (
        <div className="fixed inset-0 z-50 md:right-0 md:left-auto flex">
          <div className="hidden md:block flex-1" onClick={() => setNotepadOpen(false)} />
          <div className="w-full md:w-[420px] bg-white shadow-2xl flex flex-col h-full md:border-l border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-serif font-bold text-slate-800">{dict.notepad}</h3>
              <button onClick={() => setNotepadOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              {(['general', 'day', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setNotepadTab(tab)}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                    notepadTab === tab ? 'text-sky-600 border-b-2 border-sky-500' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {tab === 'general' ? dict.tabGeneral : tab === 'day' ? dict.tabPerDay : dict.tabHistory}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {notepadTab === 'general' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">{dict.generalNoteCaption}</p>
                  <SentimentPicker value={sentiment} onChange={setSentiment} dict={dict} />
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder={dict.yourComment}
                    rows={5}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <button
                    onClick={() => handleSubmitAnnotation('proposal')}
                    disabled={!noteText.trim() && !sentiment}
                    className="w-full px-4 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 inline mr-2" />{dict.send}
                  </button>
                  {annotations.filter(a => a.level === 'proposal').map(a => (
                    <AnnotationCard key={a.id} annotation={a} dict={dict} />
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
                      sentiment={sentiment}
                      setSentiment={setSentiment}
                      onSubmit={(level: string, itemIdx?: number, daySentiment?: Sentiment) => handleSubmitAnnotation(level, idx, itemIdx, undefined, daySentiment)}
                      dict={dict}
                    />
                  ))}
                </div>
              )}

              {notepadTab === 'history' && (
                <div className="space-y-3">
                  {[...annotations].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(a => (
                    <AnnotationCard key={a.id} annotation={a} showBadge dict={dict} />
                  ))}
                  {annotations.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">{dict.noAnnotations}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(proposal as any).wetravel_checkout_url && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl p-3">
          <a
            href={(proposal as any).wetravel_checkout_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg"
          >
            {dict.bookNow} — €{(proposal as any).deposit_amount_eur ?? '—'}
          </a>
          <p className="mt-1 text-[10px] text-center text-slate-500">{dict.defaultDepositNote}</p>
        </div>
      )}
    </div>
  );
};

const SentimentPicker = ({ value, onChange, dict }: { value: Sentiment; onChange: (s: Sentiment) => void; dict: ReturnType<typeof getProposalDict> }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => onChange(value === 'like' ? null : 'like')}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
        value === 'like'
          ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
          : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
      )}
      aria-pressed={value === 'like'}
    >
      <ThumbsUp className="h-4 w-4" /> {dict.sentimentLike}
    </button>
    <button
      type="button"
      onClick={() => onChange(value === 'dislike' ? null : 'dislike')}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
        value === 'dislike'
          ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
          : 'bg-white border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600'
      )}
      aria-pressed={value === 'dislike'}
    >
      <ThumbsDown className="h-4 w-4" /> {dict.sentimentDislike}
    </button>
  </div>
);


const AnnotationCard = ({ annotation, showBadge, dict }: { annotation: any; showBadge?: boolean; dict: ReturnType<typeof getProposalDict> }) => {
  const { sentiment, text } = decodeSentiment(annotation.content || '');
  const sentimentStyles =
    sentiment === 'like'
      ? 'bg-emerald-50 border-emerald-200'
      : sentiment === 'dislike'
        ? 'bg-rose-50 border-rose-200'
        : 'bg-sky-50 border-sky-100';
  return (
    <div className={cn('rounded-xl p-3 border', sentimentStyles)}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {showBadge && (
          <span className="text-[10px] px-2 py-0.5 bg-white/70 text-slate-600 rounded-full font-medium border border-slate-200">
            {annotation.level === 'proposal'
              ? dict.badgeGeneral
              : annotation.level === 'day'
                ? dict.badgeDay((annotation.target_day_index ?? 0) + 1)
                : dict.badgeItem}
          </span>
        )}
        {sentiment === 'like' && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold">
            <ThumbsUp className="h-3 w-3" /> {dict.sentimentLike}
          </span>
        )}
        {sentiment === 'dislike' && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-semibold">
            <ThumbsDown className="h-3 w-3" /> {dict.sentimentDislike}
          </span>
        )}
        <span className={cn('w-2 h-2 rounded-full', annotation.is_resolved ? 'bg-emerald-400' : 'bg-sky-400')} />
        <span className="text-xs font-medium text-slate-700">{annotation.author_name}</span>
        <span className="text-[10px] text-slate-400 ml-auto">{new Date(annotation.created_at).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{text}</p>
    </div>
  );
};

const DayAnnotationSection = ({ day, dayIdx, isOpen, onToggle, annotations, noteText, setNoteText, onSubmit, dict }: any) => {
  const [itemComment, setItemComment] = useState<number | null>(null);
  const [itemText, setItemText] = useState('');
  const [daySentiment, setDaySentiment] = useState<Sentiment>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sky-50">
        <span className="w-7 h-7 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center text-xs font-bold">{dict.day.charAt(0)}{day.day_number}</span>
        <RichText className="text-sm font-medium text-slate-800 flex-1 truncate" value={day.title} />
        <span className="text-xs text-slate-400">{annotations.filter((a: any) => a.level === 'day').length}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder={dict.dayCommentPlaceholder(day.day_number)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
          <SentimentPicker value={daySentiment} onChange={setDaySentiment} dict={dict} />
          <button
            onClick={() => { onSubmit('day', undefined, daySentiment); setDaySentiment(null); }}
            disabled={!noteText.trim()}
            className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-medium hover:bg-sky-600 disabled:opacity-50"
          >
            {dict.send}
          </button>

          {/* Day-level annotations */}
          {annotations.filter((a: any) => a.level === 'day' && a.target_item_index === null).map((a: any) => (
            <AnnotationCard key={a.id} annotation={a} dict={dict} />
          ))}

          {/* Items */}
          <div className="space-y-1 mt-2">
            {day.items.map((item: string, i: number) => (
              <div key={i}>
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <span className="flex-1 truncate">{item}</span>
                  <button onClick={() => setItemComment(itemComment === i ? null : i)} className="shrink-0 p-1 hover:bg-sky-50 rounded">
                    <MessageSquare className="h-3 w-3" />
                  </button>
                </div>
                {itemComment === i && (
                  <div className="flex gap-2 pb-2">
                    <input
                      value={itemText}
                      onChange={e => setItemText(e.target.value)}
                      placeholder={dict.itemComment}
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none"
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
                      className="px-2 py-1 bg-sky-500 text-white rounded text-xs"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {/* Item-level annotations */}
                {annotations.filter((a: any) => a.target_item_index === i).map((a: any) => (
                  <AnnotationCard key={a.id} annotation={a} dict={dict} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Pricing & Conditions section ──────────────────────────────────────────
const PRICING_LABELS: Record<string, { total: string; included: string; payment: string; cancellation: string; notes: string }> = {
  en: { total: 'Total Price', included: "What's Included", payment: 'Reservation & Payment Conditions', cancellation: 'Cancellations & Refund Conditions', notes: 'Important Notes' },
  fr: { total: 'Prix Total', included: 'Ce Qui Est Inclus', payment: 'Conditions de Réservation et Paiement', cancellation: "Conditions d'Annulation et Remboursement", notes: 'Notes Importantes' },
  es: { total: 'Precio Total', included: 'Qué Está Incluido', payment: 'Condiciones de Reserva y Pago', cancellation: 'Condiciones de Cancelación y Reembolso', notes: 'Notas Importantes' },
  pt: { total: 'Preço Total', included: 'O Que Está Incluído', payment: 'Condições de Reserva e Pagamento', cancellation: 'Condições de Cancelamento e Reembolso', notes: 'Notas Importantes' },
  it: { total: 'Prezzo Totale', included: 'Cosa È Incluso', payment: 'Condizioni di Prenotazione e Pagamento', cancellation: 'Condizioni di Cancellazione e Rimborso', notes: 'Note Importanti' },
  de: { total: 'Gesamtpreis', included: 'Leistungen', payment: 'Reservierungs- und Zahlungsbedingungen', cancellation: 'Storno- und Erstattungsbedingungen', notes: 'Wichtige Hinweise' },
};

const PricingConditions = ({ proposal, lang }: { proposal: any; lang: string }) => {
  const total = Number(proposal.total_value_eur) || 0;
  const closing = proposal.closing_terms || {};
  const L = PRICING_LABELS[lang] || PRICING_LABELS.en;
  const days: ProposalDay[] = Array.isArray(proposal.days) ? proposal.days : [];
  const dayLabel = PRICING_LABELS[lang] ? ({ en: 'Day', fr: 'Jour', es: 'Día', pt: 'Dia', it: 'Giorno', de: 'Tag' } as any)[lang] : 'Day';
  const autoIncluded = days
    .map(d => `**${dayLabel} ${d.day_number} — ${stripBoldMarkers(d.title || '')}**\n${(d.items || []).slice(0, 6).map(b => `• ${stripBoldMarkers(b)}`).join('\n')}`)
    .join('\n\n');
  const includedText: string = closing.inclusionsOverride?.trim() || autoIncluded;
  const paymentText: string = closing.payment || '• Deposit: 25% of the total amount to formalize the booking.\n• Final Payment: The remaining 75% must be settled up to 30 days before the tour date.';
  const cancellationText: string = closing.cancellation || '• Free cancellation with 100% refund up to 7 days prior to the tour date.\n• For cancellations made less than 30 days before the tour date, the total amount is non-refundable.';
  const notesText: string = closing.importantNotes || '• The rates presented include all the itinerary and experiences mentioned in the proposition.\n• Rates are valid on the date this proposal is sent and may change until final confirmation.\n• The rates include all taxes and personal accident insurance.';
  const hasAny = total > 0 || includedText || paymentText || cancellationText || notesText;
  if (!hasAny) return null;

  return (
    <section id="pricing" className="scroll-mt-16">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {total > 0 && (
          <div className="text-center px-6 py-6 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{L.total}</p>
            <p className="text-4xl font-serif font-bold text-[#0a2540]">€ {total.toLocaleString('en-US')}</p>
            {proposal.participants && (
              <p className="text-xs text-slate-500 mt-2">{proposal.participants}{proposal.date_range ? ` · ${proposal.date_range}` : ''}</p>
            )}
          </div>
        )}
        <div className="p-6 space-y-5">
          {includedText && (
            <div>
              <h3 className="text-sm font-serif font-bold text-slate-800 mb-2">{L.included}</h3>
              <RichText as="div" className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" value={includedText} preserveNewlines />
            </div>
          )}
          <div>
            <h3 className="text-sm font-serif font-bold text-slate-800 mb-2">{L.payment}</h3>
            <RichText as="div" className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" value={paymentText} preserveNewlines />
          </div>
          <div>
            <h3 className="text-sm font-serif font-bold text-slate-800 mb-2">{L.cancellation}</h3>
            <RichText as="div" className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" value={cancellationText} preserveNewlines />
          </div>
          <div>
            <h3 className="text-sm font-serif font-bold text-slate-800 mb-2">{L.notes}</h3>
            <RichText as="div" className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed" value={notesText} preserveNewlines />
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicProposalPage;

