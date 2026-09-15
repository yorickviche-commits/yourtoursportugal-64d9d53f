/** Rótulos de participantes por idioma — partilhado pelo Travel Planner e pela sincronização
 *  dos Dados Gerais com a proposta/itinerário digital. */
const PARTICIPANT_LABELS: Record<string, { adult: string; adults: string; child: string; children: string }> = {
  en: { adult: 'adult', adults: 'adults', child: 'child', children: 'children' },
  fr: { adult: 'adulte', adults: 'adultes', child: 'enfant', children: 'enfants' },
  es: { adult: 'adulto', adults: 'adultos', child: 'niño', children: 'niños' },
  pt: { adult: 'adulto', adults: 'adultos', child: 'criança', children: 'crianças' },
  it: { adult: 'adulto', adults: 'adulti', child: 'bambino', children: 'bambini' },
  de: { adult: 'Erwachsener', adults: 'Erwachsene', child: 'Kind', children: 'Kinder' },
};

export const participantLabelsFor = (language?: string | null) =>
  PARTICIPANT_LABELS[(language || 'en').toLowerCase().slice(0, 2)] || PARTICIPANT_LABELS.en;

/** Ex.: "2 adults + 1 child" */
export const buildParticipantsLabel = (
  pax: number,
  paxChildren?: number | null,
  language?: string | null,
): string => {
  const l = participantLabelsFor(language);
  const kids = paxChildren || 0;
  return `${pax} ${pax === 1 ? l.adult : l.adults}${kids ? ` + ${kids} ${kids === 1 ? l.child : l.children}` : ''}`;
};
