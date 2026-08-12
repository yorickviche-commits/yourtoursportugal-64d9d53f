// Localized defaults for the proposal closing terms (payment, cancellation,
// important notes, closing message). Used by the Travel Planner editor, the
// generated PDF and the digital itinerary so all three follow the lead language.

export type ClosingLang = 'en' | 'pt' | 'es' | 'fr' | 'it' | 'de';

export type ClosingField = 'payment' | 'cancellation' | 'importantNotes' | 'closingMessage';

type ClosingSet = Record<ClosingField, string>;

const en: ClosingSet = {
  payment:
    '• Deposit: 25% of the total amount to formalize the booking.\n• Final Payment: The remaining 75% must be settled up to 30 days before the tour date.',
  cancellation:
    '• Free cancellation with 100% refund up to 7 days prior to the tour date.\n• For cancellations made less than 30 days before the tour date, the total amount is non-refundable.',
  importantNotes:
    "• The rates presented include all the itinerary and experiences mentioned in the proposition.\n• The presented rates are valid on the date this proposal is sent. Up until your final confirmation, there's the possibility of price/availability/conditions changes beyond our process.\n• The rates include all taxes and personal accident insurance.\n• Terms and Conditions referring to all our products/services are available publicly on our website.",
  closingMessage:
    'That said, we await your feedback and your thoughts on the program and proposal.\n\nIf helpful, we suggest scheduling a short video call with our team to walk through the experience together, clarify any details, and fine-tune the plan according to your vision.\n\nPlease let us know if the proposal aligns with your expectations so we can move confidently to the next steps.',
};

const pt: ClosingSet = {
  payment:
    '• Sinal: 25% do valor total para formalizar a reserva.\n• Pagamento final: os restantes 75% devem ser liquidados até 30 dias antes da data do programa.',
  cancellation:
    '• Cancelamento gratuito com reembolso de 100% até 7 dias antes da data do programa.\n• Em cancelamentos com menos de 30 dias de antecedência, o valor total não é reembolsável.',
  importantNotes:
    '• Os valores apresentados incluem todo o itinerário e experiências mencionados nesta proposta.\n• Os valores são válidos na data de envio desta proposta. Até à confirmação final, existe a possibilidade de alterações de preço/disponibilidade/condições fora do nosso controlo.\n• Os valores incluem todos os impostos e seguro de acidentes pessoais.\n• Os Termos e Condições aplicáveis a todos os nossos produtos/serviços estão disponíveis publicamente no nosso website.',
  closingMessage:
    'Dito isto, aguardamos o seu feedback e a sua opinião sobre o programa e a proposta.\n\nSe for útil, sugerimos agendar uma breve videochamada com a nossa equipa para percorrermos a experiência em conjunto, esclarecer detalhes e ajustar o plano à sua visão.\n\nDiga-nos se a proposta corresponde às suas expectativas para avançarmos com confiança para os próximos passos.',
};

const es: ClosingSet = {
  payment:
    '• Señal: 25% del importe total para formalizar la reserva.\n• Pago final: el 75% restante debe abonarse hasta 30 días antes de la fecha del programa.',
  cancellation:
    '• Cancelación gratuita con reembolso del 100% hasta 7 días antes de la fecha del programa.\n• En cancelaciones con menos de 30 días de antelación, el importe total no es reembolsable.',
  importantNotes:
    '• Las tarifas presentadas incluyen todo el itinerario y las experiencias mencionadas en esta propuesta.\n• Las tarifas son válidas en la fecha de envío de esta propuesta. Hasta la confirmación final existe la posibilidad de cambios de precio/disponibilidad/condiciones ajenos a nuestro proceso.\n• Las tarifas incluyen todos los impuestos y el seguro de accidentes personales.\n• Los Términos y Condiciones aplicables a todos nuestros productos/servicios están disponibles públicamente en nuestra web.',
  closingMessage:
    'Dicho esto, esperamos sus comentarios y su opinión sobre el programa y la propuesta.\n\nSi resulta útil, sugerimos agendar una breve videollamada con nuestro equipo para repasar juntos la experiencia, aclarar detalles y ajustar el plan a su visión.\n\nDíganos si la propuesta se ajusta a sus expectativas para avanzar con confianza a los siguientes pasos.',
};

const fr: ClosingSet = {
  payment:
    '• Acompte : 25% du montant total pour confirmer la réservation.\n• Solde : les 75% restants doivent être réglés jusqu’à 30 jours avant la date du programme.',
  cancellation:
    '• Annulation gratuite avec remboursement à 100% jusqu’à 7 jours avant la date du programme.\n• Pour toute annulation à moins de 30 jours, le montant total n’est pas remboursable.',
  importantNotes:
    '• Les tarifs présentés comprennent l’ensemble de l’itinéraire et des expériences mentionnés dans cette proposition.\n• Les tarifs sont valables à la date d’envoi de cette proposition. Jusqu’à la confirmation finale, des changements de prix/disponibilité/conditions indépendants de notre process restent possibles.\n• Les tarifs incluent toutes les taxes et l’assurance accidents personnels.\n• Les Conditions Générales applicables à tous nos produits/services sont disponibles publiquement sur notre site.',
  closingMessage:
    'Cela dit, nous attendons vos retours et votre avis sur le programme et la proposition.\n\nSi cela peut aider, nous suggérons de planifier un court appel vidéo avec notre équipe pour parcourir l’expérience ensemble, clarifier les détails et affiner le plan selon votre vision.\n\nDites-nous si la proposition correspond à vos attentes afin d’avancer sereinement vers les prochaines étapes.',
};

const it: ClosingSet = {
  payment:
    '• Acconto: 25% dell’importo totale per confermare la prenotazione.\n• Saldo: il restante 75% deve essere versato fino a 30 giorni prima della data del programma.',
  cancellation:
    '• Cancellazione gratuita con rimborso del 100% fino a 7 giorni prima della data del programma.\n• Per cancellazioni con meno di 30 giorni di preavviso, l’importo totale non è rimborsabile.',
  importantNotes:
    '• Le tariffe indicate includono l’intero itinerario e le esperienze menzionate in questa proposta.\n• Le tariffe sono valide alla data di invio della proposta. Fino alla conferma finale sono possibili variazioni di prezzo/disponibilità/condizioni al di fuori del nostro controllo.\n• Le tariffe includono tutte le tasse e l’assicurazione infortuni.\n• I Termini e le Condizioni relativi a tutti i nostri prodotti/servizi sono disponibili pubblicamente sul nostro sito.',
  closingMessage:
    'Detto questo, attendiamo il vostro riscontro e la vostra opinione sul programma e sulla proposta.\n\nSe utile, suggeriamo di fissare una breve videochiamata con il nostro team per rivedere insieme l’esperienza, chiarire i dettagli e perfezionare il piano secondo la vostra visione.\n\nFateci sapere se la proposta corrisponde alle vostre aspettative per procedere con fiducia ai passi successivi.',
};

const de: ClosingSet = {
  payment:
    '• Anzahlung: 25% des Gesamtbetrags zur Bestätigung der Buchung.\n• Restzahlung: die verbleibenden 75% sind bis 30 Tage vor Reisebeginn zu zahlen.',
  cancellation:
    '• Kostenlose Stornierung mit 100% Rückerstattung bis 7 Tage vor Reisebeginn.\n• Bei Stornierungen weniger als 30 Tage vor Reisebeginn ist der Gesamtbetrag nicht rückerstattbar.',
  importantNotes:
    '• Die genannten Preise umfassen das gesamte Programm und alle in diesem Angebot genannten Erlebnisse.\n• Die Preise gelten zum Versanddatum dieses Angebots. Bis zur endgültigen Bestätigung sind Änderungen von Preis/Verfügbarkeit/Bedingungen außerhalb unseres Einflusses möglich.\n• Die Preise beinhalten alle Steuern sowie eine Unfallversicherung.\n• Die Allgemeinen Geschäftsbedingungen für alle unsere Produkte/Leistungen sind öffentlich auf unserer Website verfügbar.',
  closingMessage:
    'Wir freuen uns auf Ihr Feedback und Ihre Gedanken zum Programm und zum Angebot.\n\nGerne stimmen wir die Reise in einem kurzen Videocall mit unserem Team gemeinsam ab, klären Details und passen den Plan an Ihre Vorstellungen an.\n\nTeilen Sie uns mit, ob das Angebot Ihren Erwartungen entspricht, damit wir die nächsten Schritte sicher gehen können.',
};

const SETS: Record<ClosingLang, ClosingSet> = { en, pt, es, fr, it, de };

export function normalizeClosingLang(language?: string | null): ClosingLang {
  const key = String(language || 'en').slice(0, 2).toLowerCase() as ClosingLang;
  return SETS[key] ? key : 'en';
}

export function getClosingDefaults(language?: string | null): ClosingSet {
  return SETS[normalizeClosingLang(language)];
}

const norm = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Historical English defaults that may already be stored in the DB, plus the
// shorter PDF variants. Any stored value matching one of these is treated as an
// untranslated default and replaced by the localized text.
const LEGACY_DEFAULTS: Record<ClosingField, string[]> = {
  payment: [en.payment],
  cancellation: [en.cancellation],
  importantNotes: [
    en.importantNotes,
    '• The rates presented include all the itinerary and experiences mentioned in the proposition.\n• Rates are valid on the date this proposal is sent and may change until final confirmation.\n• The rates include all taxes and personal accident insurance.',
  ],
  closingMessage: [en.closingMessage],
};

export function isDefaultClosingText(field: ClosingField, text?: string | null): boolean {
  if (!text || !String(text).trim()) return true;
  const n = norm(String(text));
  if (LEGACY_DEFAULTS[field].some(d => norm(d) === n)) return true;
  return (Object.keys(SETS) as ClosingLang[]).some(l => norm(SETS[l][field]) === n);
}

/** Returns the stored text when it was manually customised, otherwise the localized default. */
export function resolveClosingText(field: ClosingField, stored: string | null | undefined, language?: string | null): string {
  if (isDefaultClosingText(field, stored)) return getClosingDefaults(language)[field];
  return String(stored);
}
