// Public proposal viewer translations.
// Keyed by proposal.language (en, fr, es, pt, it, de). Falls back to English.

export type ProposalLang = 'en' | 'fr' | 'es' | 'pt' | 'it' | 'de';

export interface ProposalDict {
  loading: string;
  notFound: string;
  notFoundHint: string;
  thanks: (name: string) => string;
  thanksBody: string;
  approved: string;
  revisionRequested: string;
  bookNow: string;
  depositSuffix: (deposit: string, pct: number) => string;
  defaultDepositNote: string;
  // Nav
  summary: string;
  day: string;
  dayShort: (n: number) => string;
  map: string;
  reviews: string;
  about: string;
  // Sections
  tripSummary: string;
  programDayByDay: string;
  itineraryIncludes: string;
  tripMap: string;
  mapUnavailable: string;
  mapLoading: string;
  travellersSay: string;
  reviewsList: { name: string; text: string; stars: number }[];
  aboutUs: string;
  aboutBody: string;
  website: string;
  phoneLabel: string;
  foundersBody: string;
  // Comment chrome
  commentThisDay: string;
  addNote: string;
  approveProgram: string;
  requestChanges: string;
  approveTitle: string;
  requestTitle: string;
  yourName: string;
  approveNotePlaceholder: string;
  requestNotePlaceholder: string;
  confirmApprove: string;
  sendRequest: string;
  notepad: string;
  tabGeneral: string;
  tabPerDay: string;
  tabHistory: string;
  generalNoteCaption: string;
  yourComment: string;
  send: string;
  noAnnotations: string;
  dayCommentPlaceholder: (n: number) => string;
  itemComment: string;
  badgeGeneral: string;
  badgeDay: (n: number) => string;
  badgeItem: string;
  // Sentiment
  sentimentLike: string;
  sentimentDislike: string;
}

const en: ProposalDict = {
  loading: 'Loading proposal…',
  notFound: 'Proposal not found',
  notFoundHint: 'The link may be expired or incorrect.',
  thanks: (n) => `Thank you, ${n}!`,
  thanksBody: 'Your response has been recorded. The Your Tours Portugal team will contact you within 24 hours.',
  approved: '✓ Approved',
  revisionRequested: '⟳ Changes requested',
  bookNow: '✈️ Book Now — Reserve Your Spot',
  depositSuffix: (d, p) => `€${d} deposit · ${p}% of total · 100% refundable`,
  defaultDepositNote: '50% deposit · 100% refundable',
  summary: 'Summary',
  day: 'Day',
  dayShort: (n) => `D${n}`,
  map: 'Map',
  reviews: 'Reviews',
  about: 'About',
  tripSummary: 'Trip summary',
  programDayByDay: 'Day-by-day programme',
  itineraryIncludes: 'Itinerary & inclusions',
  tripMap: 'Trip map',
  mapUnavailable: 'Map unavailable',
  mapLoading: 'Loading map…',
  travellersSay: 'What travellers say',
  reviewsList: [
    { name: 'Sophie M.', text: 'An unforgettable trip. The team organised everything perfectly, with passionate guides and beautiful hotels.', stars: 5 },
    { name: 'Jean-Pierre L.', text: 'Exceptional service from beginning to end. The level of personalisation was remarkable. Highly recommended.', stars: 5 },
    { name: 'Marie C.', text: 'Our local guide was wonderful. Every detail was carefully considered and Portugal felt even more special from the inside.', stars: 5 },
    { name: 'François D.', text: 'Thank you for a truly unique experience. Local craftsmanship and gastronomy were the highlights of our stay.', stars: 5 },
  ],
  aboutUs: 'About Your Tours Portugal',
  aboutBody: 'Your Tours Portugal is a bespoke travel agency specialised in authentic Portuguese experiences. We craft tailor-made itineraries that reveal the very best of local culture, gastronomy and craftsmanship with passionate local guides.',
  website: 'Website',
  phoneLabel: 'Phone / WhatsApp',
  foundersBody: 'Founded in 2016 by professional tour guides, Your Tours Portugal remains a 100% locally owned operator. Our founders still lead the team today, working with authentic local partners to deliver private, personalised experiences across the very best of Portugal and Spain.',
  commentThisDay: 'Comment on this day',
  addNote: 'Add a note',
  approveProgram: '✓ Approve this programme',
  requestChanges: '⟳ Request changes',
  approveTitle: 'Approve the programme',
  requestTitle: 'Request changes',
  yourName: 'Your name',
  approveNotePlaceholder: 'Optional note…',
  requestNotePlaceholder: 'Describe the changes you would like…',
  confirmApprove: 'Confirm approval',
  sendRequest: 'Send request',
  notepad: 'Notepad',
  tabGeneral: 'General note',
  tabPerDay: 'Per day',
  tabHistory: 'History',
  generalNoteCaption: 'Overall comment on the programme',
  yourComment: 'Your comment…',
  send: 'Send',
  noAnnotations: 'No annotations yet',
  dayCommentPlaceholder: (n) => `Comment for Day ${n}…`,
  itemComment: 'Comment…',
  badgeGeneral: 'General',
  badgeDay: (n) => `Day ${n}`,
  badgeItem: 'Item',
  sentimentLike: 'I like this',
  sentimentDislike: 'I’d change this',
};

const fr: ProposalDict = {
  loading: 'Chargement de la proposition…',
  notFound: 'Proposition introuvable',
  notFoundHint: 'Le lien peut être expiré ou incorrect.',
  thanks: (n) => `Merci, ${n} !`,
  thanksBody: 'Votre réponse a été enregistrée. L’équipe Your Tours Portugal vous contactera dans les 24 heures.',
  approved: '✓ Approuvé',
  revisionRequested: '⟳ Modifications demandées',
  bookNow: '✈️ Réserver — Confirmer votre place',
  depositSuffix: (d, p) => `Acompte de €${d} · ${p}% du total · 100% remboursable`,
  defaultDepositNote: 'Acompte 50% · 100% remboursable',
  summary: 'Résumé',
  day: 'Jour',
  dayShort: (n) => `J${n}`,
  map: 'Carte',
  reviews: 'Avis',
  about: 'À propos',
  tripSummary: 'Résumé du voyage',
  programDayByDay: 'Programme jour par jour',
  itineraryIncludes: 'Itinéraire & inclus',
  tripMap: 'Carte du voyage',
  mapUnavailable: 'Carte indisponible',
  mapLoading: 'Chargement de la carte…',
  travellersSay: 'Ce que disent nos voyageurs',
  reviewsList: [
    { name: 'Sophie M.', text: 'Un voyage inoubliable ! L’équipe a tout organisé à la perfection. Les guides étaient passionnés et les hôtels magnifiques.', stars: 5 },
    { name: 'Jean-Pierre L.', text: 'Service exceptionnel du début à la fin. La personnalisation du voyage était remarquable. Nous recommandons vivement !', stars: 5 },
    { name: 'Marie C.', text: 'Notre guide francophone était formidable. Chaque détail était pensé. Le Portugal est encore plus beau vu de l’intérieur.', stars: 5 },
    { name: 'François D.', text: 'Merci pour cette expérience unique. L’artisanat local et la gastronomie étaient les points forts de notre séjour.', stars: 5 },
  ],
  aboutUs: 'À propos de Your Tours Portugal',
  aboutBody: 'Your Tours Portugal est une agence de voyages sur mesure spécialisée dans les expériences authentiques au Portugal. Nous créons des itinéraires personnalisés qui révèlent le meilleur de la culture, de la gastronomie et de l’artisanat portugais, avec des guides locaux francophones passionnés.',
  website: 'Site web',
  phoneLabel: 'Téléphone / WhatsApp',
  foundersBody: 'Fondée en 2016 par des guides touristiques professionnels, Your Tours Portugal reste un opérateur 100% local. Nos fondateurs dirigent toujours l’équipe et travaillent avec des partenaires locaux authentiques pour proposer des expériences privées et personnalisées au meilleur du Portugal et de l’Espagne.',
  commentThisDay: 'Commenter cette journée',
  addNote: 'Ajouter une note',
  approveProgram: '✓ Approuver ce programme',
  requestChanges: '⟳ Demander des modifications',
  approveTitle: 'Approuver le programme',
  requestTitle: 'Demander des modifications',
  yourName: 'Votre nom',
  approveNotePlaceholder: 'Note optionnelle…',
  requestNotePlaceholder: 'Décrivez les modifications souhaitées…',
  confirmApprove: 'Confirmer l’approbation',
  sendRequest: 'Envoyer la demande',
  notepad: 'Bloc-notes',
  tabGeneral: 'Note générale',
  tabPerDay: 'Par jour',
  tabHistory: 'Historique',
  generalNoteCaption: 'Commentaire global sur le programme',
  yourComment: 'Votre commentaire…',
  send: 'Envoyer',
  noAnnotations: 'Aucune annotation pour le moment',
  dayCommentPlaceholder: (n) => `Commentaire pour Jour ${n}…`,
  itemComment: 'Commentaire…',
  badgeGeneral: 'Général',
  badgeDay: (n) => `Jour ${n}`,
  badgeItem: 'Item',
  sentimentLike: 'J’aime',
  sentimentDislike: 'À revoir',
};

const es: ProposalDict = {
  loading: 'Cargando propuesta…',
  notFound: 'Propuesta no encontrada',
  notFoundHint: 'El enlace puede haber caducado o ser incorrecto.',
  thanks: (n) => `¡Gracias, ${n}!`,
  thanksBody: 'Tu respuesta ha sido registrada. El equipo de Your Tours Portugal te contactará en las próximas 24 horas.',
  approved: '✓ Aprobado',
  revisionRequested: '⟳ Cambios solicitados',
  bookNow: '✈️ Reservar — Confirma tu plaza',
  depositSuffix: (d, p) => `Depósito de €${d} · ${p}% del total · 100% reembolsable`,
  defaultDepositNote: 'Depósito 50% · 100% reembolsable',
  summary: 'Resumen',
  day: 'Día',
  dayShort: (n) => `D${n}`,
  map: 'Mapa',
  reviews: 'Opiniones',
  about: 'Sobre nosotros',
  tripSummary: 'Resumen del viaje',
  programDayByDay: 'Programa día a día',
  itineraryIncludes: 'Itinerario e incluido',
  tripMap: 'Mapa del viaje',
  mapUnavailable: 'Mapa no disponible',
  mapLoading: 'Cargando mapa…',
  travellersSay: 'Lo que dicen nuestros viajeros',
  reviewsList: [
    { name: 'Sophie M.', text: 'Un viaje inolvidable. El equipo organizó todo a la perfección, con guías apasionados y hoteles magníficos.', stars: 5 },
    { name: 'Jean-Pierre L.', text: 'Servicio excepcional de principio a fin. La personalización del viaje fue extraordinaria. Muy recomendable.', stars: 5 },
    { name: 'Marie C.', text: 'Nuestro guía local fue fantástico. Cada detalle estaba cuidado y Portugal se sintió aún más especial desde dentro.', stars: 5 },
    { name: 'François D.', text: 'Gracias por una experiencia única. La artesanía local y la gastronomía fueron los grandes momentos del viaje.', stars: 5 },
  ],
  aboutUs: 'Sobre Your Tours Portugal',
  aboutBody: 'Your Tours Portugal es una agencia de viajes a medida especializada en experiencias auténticas en Portugal. Creamos itinerarios personalizados que revelan lo mejor de la cultura, la gastronomía y la artesanía portuguesa, con guías locales apasionados.',
  website: 'Sitio web',
  phoneLabel: 'Teléfono / WhatsApp',
  foundersBody: 'Fundada en 2016 por guías turísticos profesionales, Your Tours Portugal sigue siendo un operador 100% local. Nuestros fundadores continúan liderando el equipo, trabajando con socios locales auténticos para ofrecer experiencias privadas y personalizadas por lo mejor de Portugal y España.',
  commentThisDay: 'Comentar este día',
  addNote: 'Añadir una nota',
  approveProgram: '✓ Aprobar este programa',
  requestChanges: '⟳ Solicitar cambios',
  approveTitle: 'Aprobar el programa',
  requestTitle: 'Solicitar cambios',
  yourName: 'Tu nombre',
  approveNotePlaceholder: 'Nota opcional…',
  requestNotePlaceholder: 'Describe los cambios que deseas…',
  confirmApprove: 'Confirmar aprobación',
  sendRequest: 'Enviar solicitud',
  notepad: 'Bloc de notas',
  tabGeneral: 'Nota general',
  tabPerDay: 'Por día',
  tabHistory: 'Historial',
  generalNoteCaption: 'Comentario global sobre el programa',
  yourComment: 'Tu comentario…',
  send: 'Enviar',
  noAnnotations: 'Aún no hay anotaciones',
  dayCommentPlaceholder: (n) => `Comentario para el Día ${n}…`,
  itemComment: 'Comentario…',
  badgeGeneral: 'General',
  badgeDay: (n) => `Día ${n}`,
  badgeItem: 'Ítem',
  sentimentLike: 'Me gusta',
  sentimentDislike: 'Cambiaría esto',
};

const pt: ProposalDict = {
  loading: 'A carregar proposta…',
  notFound: 'Proposta não encontrada',
  notFoundHint: 'O link pode estar expirado ou incorreto.',
  thanks: (n) => `Obrigado, ${n}!`,
  thanksBody: 'A sua resposta foi registada. A equipa Your Tours Portugal entrará em contacto nas próximas 24 horas.',
  approved: '✓ Aprovado',
  revisionRequested: '⟳ Alterações solicitadas',
  bookNow: '✈️ Reservar — Confirme o seu lugar',
  depositSuffix: (d, p) => `Sinal de €${d} · ${p}% do total · 100% reembolsável`,
  defaultDepositNote: 'Sinal 50% · 100% reembolsável',
  summary: 'Resumo',
  day: 'Dia',
  dayShort: (n) => `D${n}`,
  map: 'Mapa',
  reviews: 'Opiniões',
  about: 'Sobre nós',
  tripSummary: 'Resumo da viagem',
  programDayByDay: 'Programa dia a dia',
  itineraryIncludes: 'Itinerário e incluído',
  tripMap: 'Mapa da viagem',
  mapUnavailable: 'Mapa indisponível',
  mapLoading: 'A carregar mapa…',
  travellersSay: 'O que dizem os nossos viajantes',
  reviewsList: [
    { name: 'Sophie M.', text: 'Uma viagem inesquecível. A equipa organizou tudo na perfeição, com guias apaixonados e hotéis excelentes.', stars: 5 },
    { name: 'Jean-Pierre L.', text: 'Serviço excecional do início ao fim. A personalização da viagem foi notável. Recomendamos vivamente.', stars: 5 },
    { name: 'Marie C.', text: 'O nosso guia local foi fantástico. Cada detalhe foi pensado e Portugal tornou-se ainda mais especial visto por dentro.', stars: 5 },
    { name: 'François D.', text: 'Obrigado por esta experiência única. O artesanato local e a gastronomia foram os pontos altos da viagem.', stars: 5 },
  ],
  aboutUs: 'Sobre a Your Tours Portugal',
  aboutBody: 'A Your Tours Portugal é uma agência de viagens à medida especializada em experiências autênticas em Portugal. Criamos itinerários personalizados que revelam o melhor da cultura, gastronomia e artesanato português, com guias locais apaixonados.',
  website: 'Site',
  phoneLabel: 'Telefone / WhatsApp',
  foundersBody: 'Fundada em 2016 por guias turísticos profissionais, a Your Tours Portugal continua a ser um operador 100% local. Os nossos fundadores lideram ainda hoje a equipa, trabalhando com parceiros locais autênticos para criar experiências privadas e personalizadas pelo melhor de Portugal e Espanha.',
  commentThisDay: 'Comentar este dia',
  addNote: 'Adicionar nota',
  approveProgram: '✓ Aprovar este programa',
  requestChanges: '⟳ Pedir alterações',
  approveTitle: 'Aprovar o programa',
  requestTitle: 'Pedir alterações',
  yourName: 'O seu nome',
  approveNotePlaceholder: 'Nota opcional…',
  requestNotePlaceholder: 'Descreva as alterações pretendidas…',
  confirmApprove: 'Confirmar aprovação',
  sendRequest: 'Enviar pedido',
  notepad: 'Bloco de notas',
  tabGeneral: 'Nota geral',
  tabPerDay: 'Por dia',
  tabHistory: 'Histórico',
  generalNoteCaption: 'Comentário global sobre o programa',
  yourComment: 'O seu comentário…',
  send: 'Enviar',
  noAnnotations: 'Ainda sem anotações',
  dayCommentPlaceholder: (n) => `Comentário para o Dia ${n}…`,
  itemComment: 'Comentário…',
  badgeGeneral: 'Geral',
  badgeDay: (n) => `Dia ${n}`,
  badgeItem: 'Item',
  sentimentLike: 'Gosto',
  sentimentDislike: 'A rever',
};

const it: ProposalDict = {
  ...en,
  loading: 'Caricamento proposta…',
  notFound: 'Proposta non trovata',
  notFoundHint: 'Il link potrebbe essere scaduto o errato.',
  thanks: (n) => `Grazie, ${n}!`,
  thanksBody: 'La tua risposta è stata registrata. Il team di Your Tours Portugal ti contatterà entro 24 ore.',
  approved: '✓ Approvato',
  revisionRequested: '⟳ Modifiche richieste',
  bookNow: '✈️ Prenota ora — Conferma il tuo posto',
  depositSuffix: (d, p) => `Acconto di €${d} · ${p}% del totale · 100% rimborsabile`,
  defaultDepositNote: 'Acconto 50% · 100% rimborsabile',
  summary: 'Riepilogo',
  day: 'Giorno',
  dayShort: (n) => `G${n}`,
  map: 'Mappa',
  reviews: 'Recensioni',
  about: 'Chi siamo',
  tripSummary: 'Riepilogo del viaggio',
  programDayByDay: 'Programma giorno per giorno',
  itineraryIncludes: 'Itinerario e incluso',
  tripMap: 'Mappa del viaggio',
  mapUnavailable: 'Mappa non disponibile',
  mapLoading: 'Caricamento mappa…',
  travellersSay: 'Cosa dicono i nostri viaggiatori',
  reviewsList: [
    { name: 'Sophie M.', text: 'Un viaggio indimenticabile. Il team ha organizzato tutto alla perfezione, con guide appassionate e hotel splendidi.', stars: 5 },
    { name: 'Jean-Pierre L.', text: 'Servizio eccezionale dall’inizio alla fine. La personalizzazione del viaggio è stata notevole. Consigliatissimo.', stars: 5 },
    { name: 'Marie C.', text: 'La nostra guida locale è stata fantastica. Ogni dettaglio era curato e il Portogallo è sembrato ancora più speciale.', stars: 5 },
    { name: 'François D.', text: 'Grazie per questa esperienza unica. Artigianato locale e gastronomia sono stati i momenti più belli del soggiorno.', stars: 5 },
  ],
  aboutUs: 'Chi è Your Tours Portugal',
  aboutBody: 'Your Tours Portugal è un’agenzia di viaggi su misura specializzata in esperienze autentiche in Portogallo. Creiamo itinerari personalizzati che rivelano il meglio della cultura, della gastronomia e dell’artigianato portoghese, con guide locali appassionate.',
  website: 'Sito web',
  phoneLabel: 'Telefono / WhatsApp',
  foundersBody: 'Fondata nel 2016 da guide turistiche professioniste, Your Tours Portugal è ancora un operatore 100% locale. I nostri fondatori guidano oggi il team e collaborano con partner locali autentici per offrire esperienze private e personalizzate nel meglio del Portogallo e della Spagna.',
  commentThisDay: 'Commenta questo giorno',
  addNote: 'Aggiungi una nota',
  approveProgram: '✓ Approva questo programma',
  requestChanges: '⟳ Richiedi modifiche',
  approveTitle: 'Approva il programma',
  requestTitle: 'Richiedi modifiche',
  yourName: 'Il tuo nome',
  approveNotePlaceholder: 'Nota opzionale…',
  requestNotePlaceholder: 'Descrivi le modifiche desiderate…',
  confirmApprove: 'Conferma approvazione',
  sendRequest: 'Invia richiesta',
  notepad: 'Blocco note',
  tabGeneral: 'Nota generale',
  tabPerDay: 'Per giorno',
  tabHistory: 'Cronologia',
  generalNoteCaption: 'Commento generale sul programma',
  yourComment: 'Il tuo commento…',
  send: 'Invia',
  noAnnotations: 'Nessuna annotazione',
  dayCommentPlaceholder: (n) => `Commento per il Giorno ${n}…`,
  itemComment: 'Commento…',
  badgeGeneral: 'Generale',
  badgeDay: (n) => `Giorno ${n}`,
  badgeItem: 'Elemento',
  sentimentLike: 'Mi piace',
  sentimentDislike: 'Da rivedere',
};

const de: ProposalDict = {
  ...en,
  loading: 'Angebot wird geladen…',
  notFound: 'Angebot nicht gefunden',
  notFoundHint: 'Der Link ist möglicherweise abgelaufen oder falsch.',
  thanks: (n) => `Danke, ${n}!`,
  thanksBody: 'Ihre Antwort wurde gespeichert. Das Team von Your Tours Portugal meldet sich innerhalb von 24 Stunden.',
  approved: '✓ Bestätigt',
  revisionRequested: '⟳ Änderungen angefragt',
  bookNow: '✈️ Jetzt buchen — Platz sichern',
  depositSuffix: (d, p) => `Anzahlung €${d} · ${p}% der Gesamtkosten · 100% rückerstattbar`,
  defaultDepositNote: '50% Anzahlung · 100% rückerstattbar',
  summary: 'Übersicht',
  day: 'Tag',
  dayShort: (n) => `T${n}`,
  map: 'Karte',
  reviews: 'Bewertungen',
  about: 'Über uns',
  tripSummary: 'Reiseübersicht',
  programDayByDay: 'Tag-für-Tag-Programm',
  itineraryIncludes: 'Reiseverlauf & Leistungen',
  tripMap: 'Reisekarte',
  mapUnavailable: 'Karte nicht verfügbar',
  mapLoading: 'Karte wird geladen…',
  travellersSay: 'Was unsere Reisenden sagen',
  reviewsList: [
    { name: 'Sophie M.', text: 'Eine unvergessliche Reise. Das Team hat alles perfekt organisiert, mit leidenschaftlichen Guides und wunderschönen Hotels.', stars: 5 },
    { name: 'Jean-Pierre L.', text: 'Aussergewöhnlicher Service von Anfang bis Ende. Die persönliche Gestaltung der Reise war bemerkenswert. Sehr empfehlenswert.', stars: 5 },
    { name: 'Marie C.', text: 'Unser lokaler Guide war fantastisch. Jedes Detail war durchdacht und Portugal fühlte sich noch besonderer an.', stars: 5 },
    { name: 'François D.', text: 'Danke für diese einzigartige Erfahrung. Lokales Handwerk und Gastronomie waren die Höhepunkte unserer Reise.', stars: 5 },
  ],
  aboutUs: 'Über Your Tours Portugal',
  aboutBody: 'Your Tours Portugal ist ein massgeschneidertes Reisebüro, spezialisiert auf authentische Erlebnisse in Portugal. Wir gestalten individuelle Reiserouten, die das Beste der portugiesischen Kultur, Gastronomie und Handwerkskunst mit leidenschaftlichen lokalen Guides zeigen.',
  website: 'Website',
  phoneLabel: 'Telefon / WhatsApp',
  foundersBody: 'Your Tours Portugal wurde 2016 von professionellen Reiseleitern gegründet und ist bis heute ein 100% lokaler Anbieter. Unsere Gründer leiten das Team weiterhin persönlich und arbeiten mit authentischen lokalen Partnern zusammen, um private, individuelle Erlebnisse im Besten von Portugal und Spanien zu ermöglichen.',
  commentThisDay: 'Diesen Tag kommentieren',
  addNote: 'Notiz hinzufügen',
  approveProgram: '✓ Programm bestätigen',
  requestChanges: '⟳ Änderungen anfragen',
  approveTitle: 'Programm bestätigen',
  requestTitle: 'Änderungen anfragen',
  yourName: 'Ihr Name',
  approveNotePlaceholder: 'Optionale Notiz…',
  requestNotePlaceholder: 'Beschreiben Sie die gewünschten Änderungen…',
  confirmApprove: 'Bestätigung absenden',
  sendRequest: 'Anfrage senden',
  notepad: 'Notizblock',
  tabGeneral: 'Allgemeine Notiz',
  tabPerDay: 'Pro Tag',
  tabHistory: 'Verlauf',
  generalNoteCaption: 'Allgemeiner Kommentar zum Programm',
  yourComment: 'Ihr Kommentar…',
  send: 'Senden',
  noAnnotations: 'Noch keine Anmerkungen',
  dayCommentPlaceholder: (n) => `Kommentar zu Tag ${n}…`,
  itemComment: 'Kommentar…',
  badgeGeneral: 'Allgemein',
  badgeDay: (n) => `Tag ${n}`,
  badgeItem: 'Element',
  sentimentLike: 'Gefällt mir',
  sentimentDislike: 'Bitte anpassen',
};

const DICTS: Record<ProposalLang, ProposalDict> = { en, fr, es, pt, it, de };

const LANGUAGE_MARKERS: Record<ProposalLang, string[]> = {
  en: [' an ', ' the ', ' and ', ' with ', ' from ', ' through ', ' designed ', ' seeking ', ' journey ', ' showcases ', ' private ', ' day '],
  fr: [' le ', ' la ', ' les ', ' avec ', ' depuis ', ' voyage ', ' journée ', ' découvrir ', ' soigneusement ', ' francophone '],
  es: [' el ', ' la ', ' los ', ' con ', ' desde ', ' viaje ', ' día ', ' diseñado ', ' descubrir ', ' cuidadosamente '],
  pt: [' uma ', ' com ', ' desde ', ' viagem ', ' dia ', ' desenhado ', ' descobrir ', ' cuidadosamente ', ' português '],
  it: [' il ', ' con ', ' da ', ' viaggio ', ' giorno ', ' progettato ', ' scoprire ', ' accuratamente '],
  de: [' der ', ' die ', ' und ', ' mit ', ' von ', ' reise ', ' tag ', ' entdecken ', ' sorgfältig '],
};

function normalizeLang(lang?: string | null): ProposalLang {
  const key = (lang || 'en').toLowerCase().slice(0, 2) as ProposalLang;
  return DICTS[key] ? key : 'en';
}

export function resolveProposalLang(proposal?: { language?: string | null; title?: string | null; summary_text?: string | null; days?: any[] } | null): ProposalLang {
  const stored = normalizeLang(proposal?.language);
  const dayText = (proposal?.days || [])
    .flatMap((day: any) => [day?.title, day?.subtitle, ...(Array.isArray(day?.items) ? day.items : [])])
    .filter(Boolean)
    .join(' ');
  const text = ` ${[proposal?.title, proposal?.summary_text, dayText].filter(Boolean).join(' ').toLowerCase()} `;
  if (!text.trim()) return stored;

  const scores = Object.entries(LANGUAGE_MARKERS).map(([lang, markers]) => ({
    lang: lang as ProposalLang,
    score: markers.reduce((total, marker) => total + (text.includes(marker) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const best = scores[0];
  const storedScore = scores.find(s => s.lang === stored)?.score || 0;
  return best && best.score >= 3 && best.score >= storedScore + 2 ? best.lang : stored;
}

export function getProposalDict(lang?: string | null): ProposalDict {
  return DICTS[normalizeLang(lang)] || en;
}

// Sentiment is encoded as a leading marker in annotation.content so the existing
// schema doesn't change. UI strips the marker on render and tags the card.
export const SENTIMENT_LIKE = '[👍]';
export const SENTIMENT_DISLIKE = '[👎]';

export type Sentiment = 'like' | 'dislike' | null;

export function encodeSentiment(text: string, s: Sentiment): string {
  if (s === 'like') return `${SENTIMENT_LIKE} ${text}`;
  if (s === 'dislike') return `${SENTIMENT_DISLIKE} ${text}`;
  return text;
}

export function decodeSentiment(content: string): { sentiment: Sentiment; text: string } {
  if (content.startsWith(SENTIMENT_LIKE)) return { sentiment: 'like', text: content.slice(SENTIMENT_LIKE.length).trim() };
  if (content.startsWith(SENTIMENT_DISLIKE)) return { sentiment: 'dislike', text: content.slice(SENTIMENT_DISLIKE.length).trim() };
  return { sentiment: null, text: content };
}
