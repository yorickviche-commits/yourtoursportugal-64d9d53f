// Static strings used by the generated proposal PDF, keyed by proposal.language.
// Mirrors the digital viewer dictionary (src/lib/proposalI18n.ts) so both channels
// speak the same language. Falls back to English.

export type PdfLang = 'en' | 'fr' | 'es' | 'pt' | 'it' | 'de';

export interface PdfDict {
  headerSubtitle: string;
  travelPlanFallback: string;
  interactiveVersion: string;
  interactiveLead: string;
  attachedNote: string;
  summaryDayByDay: string;
  day: string;
  itineraryIncluded: string;
  night: string;
  nights: string;
  accommodation: string;
  routeMap: string;
  openRoute: string;
  totalPrice: string;
  totalPriceNet: string;
  bookNow: string;
  included: string;
  paymentConditions: string;
  paymentDefault: string;
  cancellationConditions: string;
  cancellationDefault: string;
  importantNotes: string;
  importantDefault: string;
  reviewsTitle: string;
  reviewsSubtitle: string;
  seeAllReviews: string;
  aboutTitle: string;
  aboutBody: string;
  foundersBody: string;
}

const en: PdfDict = {
  headerSubtitle: 'Tailored Travel Plan',
  travelPlanFallback: 'Travel Plan',
  interactiveVersion: 'Interactive version:',
  interactiveLead: '— Interactive Travel Plan (mobile-friendly):',
  attachedNote: 'The full PDF version is attached for your records.',
  summaryDayByDay: 'Summary & Day-by-Day',
  day: 'Day',
  itineraryIncluded: 'ITINERARY & INCLUDED:',
  night: 'Night',
  nights: 'Nights',
  accommodation: 'Accommodation',
  routeMap: 'Route map',
  openRoute: 'Open route in Google Maps  →',
  totalPrice: 'TOTAL PRICE',
  totalPriceNet: 'TOTAL NET PRICE',
  bookNow: 'BOOK NOW',
  included: "What's Included",
  paymentConditions: 'Reservation & Payment Conditions',
  paymentDefault: '• Deposit: 25% of the total amount to formalize the booking.\n• Final Payment: The remaining 75% must be settled up to 30 days before the tour date.',
  cancellationConditions: 'Cancellations & Refund Conditions',
  cancellationDefault: '• Free cancellation with 100% refund up to 7 days prior to the tour date.\n• For cancellations made less than 30 days before the tour date, the total amount is non-refundable.',
  importantNotes: 'Important Notes',
  importantDefault: '• The rates presented include all the itinerary and experiences mentioned in the proposition.\n• Rates are valid on the date this proposal is sent and may change until final confirmation.\n• The rates include all taxes and personal accident insurance.',
  reviewsTitle: 'What Our Clients Say',
  reviewsSubtitle: 'Trusted by hundreds of travellers exploring Portugal.',
  seeAllReviews: 'See All Reviews  \u2192',
  aboutTitle: 'About Your Tours Portugal',
  aboutBody: 'Your Tours Portugal is a bespoke travel agency specialised in authentic Portuguese experiences. We craft tailor-made itineraries that reveal the very best of local culture, gastronomy and craftsmanship with passionate local guides.',
  foundersBody: 'Founded in 2016 by professional tour guides, Your Tours Portugal remains a 100% locally owned operator. Our founders still lead the team today, working with authentic local partners to deliver private, personalised experiences across the very best of Portugal and Spain.',
};

const pt: PdfDict = {
  headerSubtitle: 'Plano de Viagem Personalizado',
  travelPlanFallback: 'Plano de Viagem',
  interactiveVersion: 'Versão interativa:',
  interactiveLead: '— Plano de Viagem interativo (otimizado para telemóvel):',
  attachedNote: 'A versão completa em PDF segue em anexo.',
  summaryDayByDay: 'Resumo e Programa dia a dia',
  day: 'Dia',
  itineraryIncluded: 'ITINERÁRIO E INCLUÍDO:',
  night: 'Noite',
  nights: 'Noites',
  accommodation: 'Alojamento',
  routeMap: 'Mapa da rota',
  openRoute: 'Abrir rota no Google Maps  →',
  totalPrice: 'PREÇO TOTAL',
  totalPriceNet: 'PREÇO TOTAL NET',
  bookNow: 'RESERVAR',
  included: 'O que está incluído',
  paymentConditions: 'Condições de Reserva e Pagamento',
  paymentDefault: '• Sinal: 25% do valor total para formalizar a reserva.\n• Pagamento final: os restantes 75% devem ser liquidados até 30 dias antes da data do programa.',
  cancellationConditions: 'Condições de Cancelamento e Reembolso',
  cancellationDefault: '• Cancelamento gratuito com reembolso de 100% até 7 dias antes da data do programa.\n• Em cancelamentos com menos de 30 dias de antecedência, o valor total não é reembolsável.',
  importantNotes: 'Notas Importantes',
  importantDefault: '• Os valores apresentados incluem todo o itinerário e experiências mencionados nesta proposta.\n• Os valores são válidos na data de envio da proposta e podem alterar até à confirmação final.\n• Os valores incluem todos os impostos e seguro de acidentes pessoais.',
  reviewsTitle: 'O que dizem os nossos clientes',
  reviewsSubtitle: 'A confiança de centenas de viajantes que descobriram Portugal.',
  seeAllReviews: 'Ver todas as avaliações  \u2192',
  aboutTitle: 'Sobre a Your Tours Portugal',
  aboutBody: 'A Your Tours Portugal é uma agência de viagens à medida especializada em experiências autênticas em Portugal. Criamos itinerários personalizados que revelam o melhor da cultura, gastronomia e artesanato português, com guias locais apaixonados.',
  foundersBody: 'Fundada em 2016 por guias turísticos profissionais, a Your Tours Portugal continua a ser um operador 100% local. Os nossos fundadores lideram ainda hoje a equipa, trabalhando com parceiros locais autênticos para criar experiências privadas e personalizadas pelo melhor de Portugal e Espanha.',
};

const es: PdfDict = {
  headerSubtitle: 'Plan de Viaje Personalizado',
  travelPlanFallback: 'Plan de Viaje',
  interactiveVersion: 'Versión interactiva:',
  interactiveLead: '— Plan de Viaje interactivo (optimizado para móvil):',
  attachedNote: 'La versión completa en PDF se adjunta para su archivo.',
  summaryDayByDay: 'Resumen y Programa día a día',
  day: 'Día',
  itineraryIncluded: 'ITINERARIO E INCLUIDO:',
  night: 'Noche',
  nights: 'Noches',
  accommodation: 'Alojamiento',
  routeMap: 'Mapa de la ruta',
  openRoute: 'Abrir ruta en Google Maps  →',
  totalPrice: 'PRECIO TOTAL',
  totalPriceNet: 'PRECIO TOTAL NETO',
  bookNow: 'RESERVAR',
  included: 'Qué incluye',
  paymentConditions: 'Condiciones de Reserva y Pago',
  paymentDefault: '• Señal: 25% del importe total para formalizar la reserva.\n• Pago final: el 75% restante debe abonarse hasta 30 días antes de la fecha del programa.',
  cancellationConditions: 'Condiciones de Cancelación y Reembolso',
  cancellationDefault: '• Cancelación gratuita con reembolso del 100% hasta 7 días antes de la fecha del programa.\n• En cancelaciones con menos de 30 días de antelación, el importe total no es reembolsable.',
  importantNotes: 'Notas Importantes',
  importantDefault: '• Las tarifas presentadas incluyen todo el itinerario y las experiencias mencionadas en esta propuesta.\n• Las tarifas son válidas en la fecha de envío de la propuesta y pueden cambiar hasta la confirmación final.\n• Las tarifas incluyen todos los impuestos y el seguro de accidentes personales.',
  reviewsTitle: 'Lo que dicen nuestros clientes',
  reviewsSubtitle: 'La confianza de cientos de viajeros que descubrieron Portugal.',
  seeAllReviews: 'Ver todas las opiniones  \u2192',
  aboutTitle: 'Sobre Your Tours Portugal',
  aboutBody: 'Your Tours Portugal es una agencia de viajes a medida especializada en experiencias auténticas en Portugal. Creamos itinerarios personalizados que revelan lo mejor de la cultura, la gastronomía y la artesanía portuguesa, con guías locales apasionados.',
  foundersBody: 'Fundada en 2016 por guías turísticos profesionales, Your Tours Portugal sigue siendo un operador 100% local. Nuestros fundadores continúan liderando el equipo, trabajando con socios locales auténticos para ofrecer experiencias privadas y personalizadas por lo mejor de Portugal y España.',
};

const fr: PdfDict = {
  headerSubtitle: 'Plan de Voyage Personnalisé',
  travelPlanFallback: 'Plan de Voyage',
  interactiveVersion: 'Version interactive :',
  interactiveLead: '— Plan de Voyage interactif (adapté au mobile) :',
  attachedNote: 'La version complète en PDF est joint à cet e-mail.',
  summaryDayByDay: 'Résumé et Programme jour par jour',
  day: 'Jour',
  itineraryIncluded: 'ITINÉRAIRE & INCLUS :',
  night: 'Nuit',
  nights: 'Nuits',
  accommodation: 'Hébergement',
  routeMap: 'Carte de l’itinéraire',
  openRoute: 'Ouvrir l’itinéraire dans Google Maps  →',
  totalPrice: 'PRIX TOTAL',
  totalPriceNet: 'PRIX TOTAL NET',
  bookNow: 'RÉSERVER',
  included: 'Ce qui est inclus',
  paymentConditions: 'Conditions de Réservation et de Paiement',
  paymentDefault: '• Acompte : 25% du montant total pour confirmer la réservation.\n• Solde : les 75% restants doivent être réglés jusqu’à 30 jours avant la date du programme.',
  cancellationConditions: 'Conditions d’Annulation et de Remboursement',
  cancellationDefault: '• Annulation gratuite avec remboursement à 100% jusqu’à 7 jours avant la date du programme.\n• Pour toute annulation à moins de 30 jours, le montant total n’est pas remboursable.',
  importantNotes: 'Notes Importantes',
  importantDefault: '• Les tarifs présentés comprennent l’ensemble de l’itinéraire et des expériences mentionnés dans cette proposition.\n• Les tarifs sont valables à la date d’envoi de la proposition et peuvent évoluer jusqu’à la confirmation finale.\n• Les tarifs incluent toutes les taxes et l’assurance accidents personnels.',
  reviewsTitle: 'Ce que disent nos clients',
  reviewsSubtitle: 'La confiance de centaines de voyageurs au Portugal.',
  seeAllReviews: 'Voir tous les avis  \u2192',
  aboutTitle: 'À propos de Your Tours Portugal',
  aboutBody: 'Your Tours Portugal est une agence de voyages sur mesure spécialisée dans les expériences authentiques au Portugal. Nous créons des itinéraires personnalisés qui révèlent le meilleur de la culture, de la gastronomie et de l’artisanat portugais, avec des guides locaux passionnés.',
  foundersBody: 'Fondée en 2016 par des guides touristiques professionnels, Your Tours Portugal reste un opérateur 100% local. Nos fondateurs dirigent toujours l’équipe et travaillent avec des partenaires locaux authentiques pour proposer des expériences privées et personnalisées au meilleur du Portugal et de l’Espagne.',
};

const it: PdfDict = {
  headerSubtitle: 'Piano di Viaggio Personalizzato',
  travelPlanFallback: 'Piano di Viaggio',
  interactiveVersion: 'Versione interattiva:',
  interactiveLead: '— Piano di Viaggio interattivo (ottimizzato per mobile):',
  attachedNote: 'La versione completa in PDF è allegata.',
  summaryDayByDay: 'Riepilogo e Programma giorno per giorno',
  day: 'Giorno',
  itineraryIncluded: 'ITINERARIO E INCLUSO:',
  night: 'Notte',
  nights: 'Notti',
  accommodation: 'Alloggio',
  routeMap: 'Mappa del percorso',
  openRoute: 'Apri il percorso su Google Maps  →',
  totalPrice: 'PREZZO TOTALE',
  totalPriceNet: 'PREZZO TOTALE NETTO',
  bookNow: 'PRENOTA ORA',
  included: 'Cosa è incluso',
  paymentConditions: 'Condizioni di Prenotazione e Pagamento',
  paymentDefault: '• Acconto: 25% dell’importo totale per confermare la prenotazione.\n• Saldo: il restante 75% deve essere versato fino a 30 giorni prima della data del programma.',
  cancellationConditions: 'Condizioni di Cancellazione e Rimborso',
  cancellationDefault: '• Cancellazione gratuita con rimborso del 100% fino a 7 giorni prima della data del programma.\n• Per cancellazioni con meno di 30 giorni di preavviso, l’importo totale non è rimborsabile.',
  importantNotes: 'Note Importanti',
  importantDefault: '• Le tariffe indicate includono l’intero itinerario e le esperienze menzionate in questa proposta.\n• Le tariffe sono valide alla data di invio della proposta e possono variare fino alla conferma finale.\n• Le tariffe includono tutte le tasse e l’assicurazione infortuni.',
  reviewsTitle: 'Cosa dicono i nostri clienti',
  reviewsSubtitle: 'La fiducia di centinaia di viaggiatori in Portogallo.',
  seeAllReviews: 'Vedi tutte le recensioni  \u2192',
  aboutTitle: 'Chi è Your Tours Portugal',
  aboutBody: 'Your Tours Portugal è un’agenzia di viaggi su misura specializzata in esperienze autentiche in Portogallo. Creiamo itinerari personalizzati che rivelano il meglio della cultura, della gastronomia e dell’artigianato portoghese, con guide locali appassionate.',
  foundersBody: 'Fondata nel 2016 da guide turistiche professioniste, Your Tours Portugal è ancora un operatore 100% locale. I nostri fondatori guidano oggi il team e collaborano con partner locali autentici per offrire esperienze private e personalizzate nel meglio del Portogallo e della Spagna.',
};

const de: PdfDict = {
  headerSubtitle: 'Individueller Reiseplan',
  travelPlanFallback: 'Reiseplan',
  interactiveVersion: 'Interaktive Version:',
  interactiveLead: '— Interaktiver Reiseplan (mobiloptimiert):',
  attachedNote: 'Die vollständige PDF-Version finden Sie im Anhang.',
  summaryDayByDay: 'Überblick & Programm Tag für Tag',
  day: 'Tag',
  itineraryIncluded: 'PROGRAMM & INKLUSIVE:',
  night: 'Übernachtung',
  nights: 'Nächte',
  accommodation: 'Unterkunft',
  routeMap: 'Routenkarte',
  openRoute: 'Route in Google Maps öffnen  →',
  totalPrice: 'GESAMTPREIS',
  totalPriceNet: 'GESAMTPREIS NETTO',
  bookNow: 'JETZT BUCHEN',
  included: 'Was inklusive ist',
  paymentConditions: 'Buchungs- und Zahlungsbedingungen',
  paymentDefault: '• Anzahlung: 25% des Gesamtbetrags zur Bestätigung der Buchung.\n• Restzahlung: die verbleibenden 75% sind bis 30 Tage vor Reisebeginn zu zahlen.',
  cancellationConditions: 'Storno- und Rückerstattungsbedingungen',
  cancellationDefault: '• Kostenlose Stornierung mit 100% Rückerstattung bis 7 Tage vor Reisebeginn.\n• Bei Stornierungen weniger als 30 Tage vor Reisebeginn ist der Gesamtbetrag nicht rückerstattbar.',
  importantNotes: 'Wichtige Hinweise',
  importantDefault: '• Die genannten Preise umfassen das gesamte Programm und alle in diesem Angebot genannten Erlebnisse.\n• Die Preise gelten zum Versanddatum dieses Angebots und können sich bis zur endgültigen Bestätigung ändern.\n• Die Preise beinhalten alle Steuern sowie eine Unfallversicherung.',
  reviewsTitle: 'Was unsere Kunden sagen',
  reviewsSubtitle: 'Das Vertrauen von hunderten Reisenden in Portugal.',
  seeAllReviews: 'Alle Bewertungen ansehen  \u2192',
  aboutTitle: 'Über Your Tours Portugal',
  aboutBody: 'Your Tours Portugal ist eine Reiseagentur für individuelle Reisen mit Fokus auf authentische Erlebnisse in Portugal. Wir gestalten maßgeschneiderte Reiseverläufe, die das Beste aus Kultur, Gastronomie und Handwerk zeigen – mit leidenschaftlichen lokalen Guides.',
  foundersBody: 'Your Tours Portugal wurde 2016 von professionellen Reiseleitern gegründet und ist bis heute ein 100% lokaler Anbieter. Unsere Gründer leiten das Team weiterhin persönlich und arbeiten mit authentischen lokalen Partnern zusammen, um private, individuelle Erlebnisse im Besten von Portugal und Spanien zu ermöglichen.',
};

const DICTS: Record<PdfLang, PdfDict> = { en, pt, es, fr, it, de };

export function getPdfDict(language?: string | null): PdfDict {
  const key = String(language || 'en').slice(0, 2).toLowerCase() as PdfLang;
  return DICTS[key] || en;
}
