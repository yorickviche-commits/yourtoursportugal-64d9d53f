// Labels and default texts for the proposal sections added on top of the
// original layout: the "Hotels Included" block, the price breakdown lines and
// the closing boxes "What's Not Included" and "Your next steps".
// Shared by the Travel Planner preview (printed PDF), the digital itinerary and
// the email PDF builder so all three channels speak the same language.

export type HotelsLang = 'en' | 'pt' | 'es' | 'fr' | 'it' | 'de';

export interface HotelsDict {
  hotelsIncluded: string;
  hotel: string;
  checkIn: string;
  checkOut: string;
  nights: string;
  rooms: string;
  rate: string;
  hotelsTableNote: string;
  mapsLinkNote: string;
  programmePrice: string;
  hotelsPrice: (nights: number, rooms: number) => string;
  total: string;
  perPerson: string;
  notIncluded: string;
  nextSteps: string;
  notIncludedDefault: string;
  nextStepsDefault: string;
}

const en: HotelsDict = {
  hotelsIncluded: 'Hotels Included',
  hotel: 'Hotel',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  nights: 'Nights',
  rooms: 'Rooms',
  rate: 'Rate',
  hotelsTableNote: 'Rates include accommodation with breakfast and all applicable taxes.',
  mapsLinkNote: 'Click the hotel name to open its exact location in Google Maps.',
  programmePrice: 'Private programme — itinerary & experiences',
  hotelsPrice: (n, r) => `Hotels — ${n} night${n === 1 ? '' : 's'}${r ? `, ${r} room${r === 1 ? '' : 's'}` : ''}, breakfast included`,
  total: 'Total',
  perPerson: 'Per person',
  notIncluded: "What's Not Included",
  nextSteps: 'Your next steps',
  notIncludedDefault: '• International flights and airport taxes.\n• Travel and medical insurance.\n• Meals and drinks not mentioned in the programme.\n• Personal expenses, tips and anything not explicitly listed as included.',
  nextStepsDefault: '1. Review the programme and share any adjustments you would like.\n2. Confirm the proposal so we can secure hotels, guides and experiences.\n3. Pay the deposit to formalise the booking — we handle everything else.',
};

const pt: HotelsDict = {
  hotelsIncluded: 'Hotéis Incluídos',
  hotel: 'Hotel',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  nights: 'Noites',
  rooms: 'Quartos',
  rate: 'Valor',
  hotelsTableNote: 'Os valores incluem alojamento com pequeno-almoço e todos os impostos aplicáveis.',
  mapsLinkNote: 'Clique no nome do hotel para abrir a localização exata no Google Maps.',
  programmePrice: 'Programa privado — itinerário e experiências',
  hotelsPrice: (n, r) => `Hotéis — ${n} noite${n === 1 ? '' : 's'}${r ? `, ${r} quarto${r === 1 ? '' : 's'}` : ''}, pequeno-almoço incluído`,
  total: 'Total',
  perPerson: 'Por pessoa',
  notIncluded: 'O Que Não Está Incluído',
  nextSteps: 'Próximos passos',
  notIncludedDefault: '• Voos internacionais e taxas de aeroporto.\n• Seguro de viagem e de saúde.\n• Refeições e bebidas não mencionadas no programa.\n• Despesas pessoais, gratificações e tudo o que não esteja expressamente indicado como incluído.',
  nextStepsDefault: '1. Reveja o programa e diga-nos que ajustes gostaria de fazer.\n2. Confirme a proposta para garantirmos hotéis, guias e experiências.\n3. Efetue o sinal para formalizar a reserva — nós tratamos de todo o resto.',
};

const es: HotelsDict = {
  hotelsIncluded: 'Hoteles Incluidos',
  hotel: 'Hotel',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  nights: 'Noches',
  rooms: 'Habitaciones',
  rate: 'Importe',
  hotelsTableNote: 'Los importes incluyen alojamiento con desayuno y todos los impuestos aplicables.',
  mapsLinkNote: 'Haga clic en el nombre del hotel para abrir su ubicación exacta en Google Maps.',
  programmePrice: 'Programa privado — itinerario y experiencias',
  hotelsPrice: (n, r) => `Hoteles — ${n} noche${n === 1 ? '' : 's'}${r ? `, ${r} habitación${r === 1 ? '' : 'es'}` : ''}, desayuno incluido`,
  total: 'Total',
  perPerson: 'Por persona',
  notIncluded: 'Qué No Está Incluido',
  nextSteps: 'Próximos pasos',
  notIncludedDefault: '• Vuelos internacionales y tasas de aeropuerto.\n• Seguro de viaje y médico.\n• Comidas y bebidas no mencionadas en el programa.\n• Gastos personales, propinas y todo lo que no figure expresamente como incluido.',
  nextStepsDefault: '1. Revise el programa e indíquenos los ajustes que desee.\n2. Confirme la propuesta para reservar hoteles, guías y experiencias.\n3. Abone la señal para formalizar la reserva — nosotros nos encargamos del resto.',
};

const fr: HotelsDict = {
  hotelsIncluded: 'Hôtels Inclus',
  hotel: 'Hôtel',
  checkIn: 'Arrivée',
  checkOut: 'Départ',
  nights: 'Nuits',
  rooms: 'Chambres',
  rate: 'Montant',
  hotelsTableNote: 'Les montants comprennent l’hébergement avec petit-déjeuner et toutes les taxes applicables.',
  mapsLinkNote: 'Cliquez sur le nom de l’hôtel pour ouvrir sa localisation exacte dans Google Maps.',
  programmePrice: 'Programme privé — itinéraire et expériences',
  hotelsPrice: (n, r) => `Hôtels — ${n} nuit${n === 1 ? '' : 's'}${r ? `, ${r} chambre${r === 1 ? '' : 's'}` : ''}, petit-déjeuner inclus`,
  total: 'Total',
  perPerson: 'Par personne',
  notIncluded: 'Ce Qui N’Est Pas Inclus',
  nextSteps: 'Prochaines étapes',
  notIncludedDefault: '• Vols internationaux et taxes d’aéroport.\n• Assurance voyage et santé.\n• Repas et boissons non mentionnés dans le programme.\n• Dépenses personnelles, pourboires et tout ce qui n’est pas expressément indiqué comme inclus.',
  nextStepsDefault: '1. Parcourez le programme et indiquez-nous les ajustements souhaités.\n2. Confirmez la proposition pour réserver hôtels, guides et expériences.\n3. Réglez l’acompte pour formaliser la réservation — nous gérons le reste.',
};

const it: HotelsDict = {
  hotelsIncluded: 'Hotel Inclusi',
  hotel: 'Hotel',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  nights: 'Notti',
  rooms: 'Camere',
  rate: 'Importo',
  hotelsTableNote: 'Gli importi includono il soggiorno con colazione e tutte le tasse applicabili.',
  mapsLinkNote: 'Clicca sul nome dell’hotel per aprire la posizione esatta su Google Maps.',
  programmePrice: 'Programma privato — itinerario ed esperienze',
  hotelsPrice: (n, r) => `Hotel — ${n} nott${n === 1 ? 'e' : 'i'}${r ? `, ${r} camer${r === 1 ? 'a' : 'e'}` : ''}, colazione inclusa`,
  total: 'Totale',
  perPerson: 'Per persona',
  notIncluded: 'Cosa Non È Incluso',
  nextSteps: 'Prossimi passi',
  notIncludedDefault: '• Voli internazionali e tasse aeroportuali.\n• Assicurazione di viaggio e sanitaria.\n• Pasti e bevande non menzionati nel programma.\n• Spese personali, mance e tutto ciò che non è espressamente indicato come incluso.',
  nextStepsDefault: '1. Rivedi il programma e indicaci le modifiche desiderate.\n2. Confermaci la proposta per bloccare hotel, guide ed esperienze.\n3. Versa l’acconto per formalizzare la prenotazione — al resto pensiamo noi.',
};

const de: HotelsDict = {
  hotelsIncluded: 'Inkludierte Hotels',
  hotel: 'Hotel',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  nights: 'Nächte',
  rooms: 'Zimmer',
  rate: 'Betrag',
  hotelsTableNote: 'Die Beträge beinhalten Übernachtung mit Frühstück sowie alle anfallenden Steuern.',
  mapsLinkNote: 'Klicken Sie auf den Hotelnamen, um die genaue Lage in Google Maps zu öffnen.',
  programmePrice: 'Privates Programm — Route und Erlebnisse',
  hotelsPrice: (n, r) => `Hotels — ${n} Nacht${n === 1 ? '' : 'e'}${r ? `, ${r} Zimmer` : ''}, Frühstück inklusive`,
  total: 'Gesamt',
  perPerson: 'Pro Person',
  notIncluded: 'Nicht Inkludiert',
  nextSteps: 'Ihre nächsten Schritte',
  notIncludedDefault: '• Internationale Flüge und Flughafensteuern.\n• Reise- und Krankenversicherung.\n• Mahlzeiten und Getränke, die nicht im Programm genannt sind.\n• Persönliche Ausgaben, Trinkgelder und alles, was nicht ausdrücklich als inkludiert aufgeführt ist.',
  nextStepsDefault: '1. Prüfen Sie das Programm und teilen Sie uns gewünschte Anpassungen mit.\n2. Bestätigen Sie das Angebot, damit wir Hotels, Guides und Erlebnisse sichern.\n3. Zahlen Sie die Anzahlung zur Buchungsbestätigung — um alles Weitere kümmern wir uns.',
};

const SETS: Record<HotelsLang, HotelsDict> = { en, pt, es, fr, it, de };

export function getHotelsDict(language?: string | null): HotelsDict {
  const key = String(language || 'en').slice(0, 2).toLowerCase() as HotelsLang;
  return SETS[key] || en;
}

/** True when the stored text is still one of the localized defaults (or empty). */
export function isDefaultHotelsText(field: 'notIncludedDefault' | 'nextStepsDefault', text?: string | null): boolean {
  if (!text || !String(text).trim()) return true;
  const norm = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const n = norm(String(text));
  return (Object.keys(SETS) as HotelsLang[]).some(l => norm(SETS[l][field]) === n);
}

export function resolveHotelsText(field: 'notIncludedDefault' | 'nextStepsDefault', stored: string | null | undefined, language?: string | null): string {
  if (isDefaultHotelsText(field, stored)) return getHotelsDict(language)[field];
  return String(stored);
}

export interface ProposalHotel {
  name: string;
  city?: string;
  description?: string;
  mapUrl?: string;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  nights?: number;
  value?: number;
}

/** Merges the Costing hotel rows (name/nights/value) with the details edited in the planner. */
export function mergeProposalHotels(
  fromCosting: { name: string; nights?: number; value?: number }[] = [],
  edited: ProposalHotel[] = [],
): ProposalHotel[] {
  const key = (s: string) => (s || '').trim().toLowerCase();
  return (fromCosting || []).map(row => {
    const match = (edited || []).find(h => key(h.name) === key(row.name)) || {} as ProposalHotel;
    return {
      ...match,
      name: row.name,
      nights: row.nights ?? match.nights ?? 0,
      value: row.value ?? match.value ?? 0,
    };
  });
}
