// Mock dataset for the Ops Wizard — Your Tours Portugal
// Reference date for all relative values: 2026-08-24
//
// NOTE ON PRICING: this is an INTERNAL tool, so supplier names appear freely.
// Net prices never appear here and must never appear in any client-facing draft.
// Client drafts are written in the booking's language; supplier drafts in PT-PT.

import type { OpsBooking, OpsAction, ActivityEvent, DeepLink } from '@/types/ops';

const NETHUNT_BASE = 'https://nethunt.com/record/';
const GMAIL_SEARCH = 'https://mail.google.com/mail/u/0/#search/';
const CALENDAR_BASE = 'https://calendar.google.com/calendar/u/0/r/day/';

const link = (id: string, client: string, date: string): DeepLink[] => [
  { type: 'nethunt', label: 'CRM', url: `${NETHUNT_BASE}${id}` },
  { type: 'gmail', label: 'Email', url: `${GMAIL_SEARCH}${encodeURIComponent(client)}` },
  { type: 'calendar', label: 'Calendar', url: `${CALENDAR_BASE}${date.replace(/-/g, '/')}` },
  { type: 'fse', label: 'FSE', url: `/fse?booking=${id}` },
];

export const mockBookings: OpsBooking[] = [
  // ─── DEPOSIT / PAYMENT RECEIVED ───────────────────────────────────────────
  {
    id: 'YT5041',
    clientName: 'Nicole Brooks',
    product: 'Douro Valley — All Inclusive',
    stage: 'deposit_received',
    departureDate: '2026-08-28',
    pax: 4,
    language: 'EN',
    daysInStage: 2,
    lastContactDays: 1,
    missing: [{ field: 'Calendar event created', blocking: true }],
    links: link('YT5041', 'Nicole Brooks', '2026-08-28'),
  },
  {
    id: 'YT5044',
    clientName: 'Famille Lecomte',
    product: 'Braga & Guimarães — All Inclusive',
    stage: 'deposit_received',
    departureDate: '2026-09-06',
    pax: 5,
    language: 'FR',
    daysInStage: 1,
    lastContactDays: 1,
    missing: [
      { field: 'Payment verified in system', blocking: true },
      { field: 'Calendar event created', blocking: true },
    ],
    links: link('YT5044', 'Lecomte', '2026-09-06'),
  },
  {
    id: 'YT5047',
    clientName: 'Hannah & Peter Voss',
    product: 'Porto — All Inclusive',
    stage: 'deposit_received',
    departureDate: '2026-09-12',
    pax: 2,
    language: 'EN',
    daysInStage: 3,
    lastContactDays: 3,
    missing: [],
    links: link('YT5047', 'Voss', '2026-09-12'),
  },

  // ─── SUPPLIERS CONFIRMATION / PAYMENTS ────────────────────────────────────
  {
    id: 'YT5032',
    clientName: 'Tanaka Family',
    product: 'Douro Valley — Customizable',
    stage: 'suppliers_confirmation',
    departureDate: '2026-08-27',
    pax: 6,
    language: 'EN',
    daysInStage: 4,
    lastContactDays: 2,
    missing: [{ field: 'All FSE suppliers confirmed', blocking: true }],
    links: link('YT5032', 'Tanaka', '2026-08-27'),
  },
  {
    id: 'YT5035',
    clientName: 'Amalie Jonassen',
    product: 'Douro Valley — Customizable',
    stage: 'suppliers_confirmation',
    departureDate: '2026-09-02',
    pax: 2,
    language: 'EN',
    daysInStage: 6,
    lastContactDays: 4,
    missing: [
      { field: 'All FSE suppliers confirmed', blocking: true },
      { field: 'Supplier payments scheduled', blocking: false },
    ],
    links: link('YT5035', 'Jonassen', '2026-09-02'),
  },
  {
    id: 'YT5038',
    clientName: 'Grupo Salazar Viajes',
    product: 'Coimbra & Aveiro — Customizable',
    stage: 'suppliers_confirmation',
    departureDate: '2026-09-15',
    pax: 8,
    language: 'ES',
    daysInStage: 5,
    lastContactDays: 5,
    missing: [{ field: 'Supplier payments scheduled', blocking: false }],
    links: link('YT5038', 'Salazar', '2026-09-15'),
  },

  // ─── TECHNICAL BRIEFING ───────────────────────────────────────────────────
  {
    id: 'YT5028',
    clientName: 'Robert & Diane Ellis',
    product: 'Douro Valley — All Inclusive',
    stage: 'technical_briefing',
    departureDate: '2026-08-26',
    pax: 2,
    language: 'EN',
    daysInStage: 3,
    lastContactDays: 2,
    missing: [{ field: 'Guide assigned', blocking: true }],
    links: link('YT5028', 'Ellis', '2026-08-26'),
  },
  {
    id: 'YT5030',
    clientName: 'Sofia Marchetti',
    product: 'Porto — All Inclusive',
    stage: 'technical_briefing',
    departureDate: '2026-08-30',
    pax: 3,
    language: 'EN',
    daysInStage: 2,
    lastContactDays: 2,
    missing: [{ field: 'Transport confirmed', blocking: false }],
    links: link('YT5030', 'Marchetti', '2026-08-30'),
  },

  // ─── CLIENTS FINAL BRIEFING ───────────────────────────────────────────────
  {
    id: 'YT5019',
    clientName: 'Karin Bergström',
    product: 'Braga & Guimarães — All Inclusive',
    stage: 'clients_final_briefing',
    departureDate: '2026-08-25',
    pax: 4,
    language: 'EN',
    daysInStage: 1,
    lastContactDays: 1,
    missing: [{ field: 'Client briefing sent', blocking: true }],
    links: link('YT5019', 'Bergstrom', '2026-08-25'),
  },
  {
    id: 'YT5022',
    clientName: 'Paulo & Rita Fonseca',
    product: 'Coimbra & Aveiro — Customizable',
    stage: 'clients_final_briefing',
    departureDate: '2026-08-29',
    pax: 2,
    language: 'PT',
    daysInStage: 2,
    lastContactDays: 1,
    missing: [],
    links: link('YT5022', 'Fonseca', '2026-08-29'),
  },

  // ─── TRIP READY / IN EXECUTION ────────────────────────────────────────────
  {
    id: 'YT5011',
    clientName: "Jennifer & Mark O'Brien",
    product: 'Douro Valley — All Inclusive',
    stage: 'in_execution',
    departureDate: '2026-08-24',
    pax: 2,
    language: 'EN',
    daysInStage: 0,
    lastContactDays: 0,
    missing: [],
    links: link('YT5011', "O'Brien", '2026-08-24'),
  },

  // ─── POST-TRIP ────────────────────────────────────────────────────────────
  {
    id: 'YT4993',
    clientName: 'Alejandra Campos',
    product: 'Porto — All Inclusive',
    stage: 'post_trip',
    departureDate: '2026-07-18',
    pax: 4,
    language: 'ES',
    daysInStage: 37,
    lastContactDays: 37,
    missing: [{ field: 'Feedback requested', blocking: true }],
    links: link('YT4993', 'Campos', '2026-07-18'),
  },

  // ─── DEFERRED / POSTPONED ─────────────────────────────────────────────────
  {
    id: 'YT4967',
    clientName: 'Chen Wei Group',
    product: 'Douro Valley — Customizable',
    stage: 'deferred',
    departureDate: '2026-06-11',
    pax: 7,
    language: 'EN',
    daysInStage: 74,
    lastContactDays: 68,
    missing: [{ field: 'New date proposed', blocking: true }],
    links: link('YT4967', 'Chen Wei', '2026-06-11'),
  },

  // ─── ARCHIVE ──────────────────────────────────────────────────────────────
  {
    id: 'YT4946',
    clientName: 'Lynn Hermann',
    product: 'Douro Valley — All Inclusive',
    stage: 'archived',
    departureDate: '2026-06-02',
    pax: 6,
    language: 'EN',
    daysInStage: 61,
    lastContactDays: 54,
    missing: [],
    links: link('YT4946', 'Hermann', '2026-06-02'),
  },
];

export const mockActions: OpsAction[] = [
  {
    id: 'ACT-001',
    bookingId: 'YT5032',
    severity: 'critical',
    title: 'Confirm Quinta do Pôpa for tomorrow’s Douro tour',
    subtitle: 'Tanaka Family · 6 pax · tasting + winery lunch · 27 Aug 11:00',
    stage: 'suppliers_confirmation',
    deadlineLabel: 'IN 1h 20m',
    deadlineISO: '2026-08-24T12:00:00Z',
    state: 'awaiting_supplier',
    priorityScore: 9.5,
    primaryLabel: 'REQUEST CONFIRMATION',
    secondaryLabel: 'CALL SUPPLIER',
    recipient: 'Quinta do Pôpa',
    draftSubject: 'Pedido de confirmação — prova e almoço 27 Ago (ref. YT5032)',
    draftBody: `Bom dia,

Vimos solicitar confirmação de prova de vinhos e almoço vinícola no dia 27 de agosto, às 11:00, para 6 pessoas (reserva YT5032, cliente Tanaka).

Confirmamos igualmente que não há restrições alimentares comunicadas.

Agradecíamos resposta até às 12:00 de hoje, para podermos fechar o briefing técnico.

Com os melhores cumprimentos,
Your Tours Portugal
reservas@yourtours.pt · +351 919 473 029`,
    links: link('YT5032', 'Quinta do Popa', '2026-08-27'),
  },
  {
    id: 'ACT-002',
    bookingId: 'YT5019',
    severity: 'high',
    title: 'Send final client briefing — departure tomorrow',
    subtitle: 'Karin Bergström · Braga & Guimarães · 4 pax · 25 Aug',
    stage: 'clients_final_briefing',
    deadlineLabel: 'TODAY 18:00',
    deadlineISO: '2026-08-24T18:00:00Z',
    state: 'awaiting_approval',
    priorityScore: 8.9,
    primaryLabel: 'APPROVE & SEND',
    secondaryLabel: 'EDIT ITINERARY',
    recipient: 'Karin Bergström',
    draftSubject: 'Your tour tomorrow — pickup details and what to expect',
    draftBody: `Dear Karin,

We are looking forward to welcoming you tomorrow for your private day tour of Braga and Guimarães.

PICKUP
09:00 at your hotel reception. Your guide will be waiting in the lobby.

YOUR DAY
Bom Jesus do Monte and the funicular · Braga Cathedral · regional lunch with drinks included · Guimarães historic centre, Castle and Paço dos Duques · return to Porto by approximately 18:30.

WHAT TO BRING
Comfortable walking shoes and a light jacket for the evening. All entrance tickets are already included.

YOUR GUIDE
You will be accompanied by a certified English-speaking guide. Should you need anything on the day, call or WhatsApp us on +351 919 473 029.

Warm regards,
Your Tours Portugal`,
    links: link('YT5019', 'Bergstrom', '2026-08-25'),
  },
  {
    id: 'ACT-003',
    bookingId: 'YT5028',
    severity: 'high',
    title: 'Assign guide — departure in 2 days, none allocated',
    subtitle: 'Robert & Diane Ellis · Douro Valley · 2 pax · 26 Aug',
    stage: 'technical_briefing',
    deadlineLabel: 'TODAY 17:00',
    deadlineISO: '2026-08-24T17:00:00Z',
    state: 'pending',
    priorityScore: 8.6,
    primaryLabel: 'ASSIGN GUIDE',
    secondaryLabel: 'OPEN IN CRM',
    recipient: 'Operations — internal',
    draftSubject: 'Internal — guide allocation required (YT5028)',
    draftBody: `BLOCKING ITEM · Technical Briefing cannot be closed.

Booking:     YT5028 — Robert & Diane Ellis
Product:     Douro Valley — All Inclusive
Departure:   26 Aug 2026 · 2 pax · EN
Missing:     Guide assigned

Transport is confirmed. Quinta and lunch are confirmed.
Guide allocation is the only open item blocking this booking from moving to Clients Final Briefing.

Suggested next step: allocate an EN-speaking guide from the Douro roster and confirm availability before 17:00 today, so the client briefing can be sent tomorrow morning.`,
    links: link('YT5028', 'Ellis', '2026-08-26'),
  },
  {
    id: 'ACT-004',
    bookingId: 'YT5044',
    severity: 'high',
    title: 'Verify deposit and create calendar event',
    subtitle: 'Famille Lecomte · Braga & Guimarães · 5 pax · 6 Sep',
    stage: 'deposit_received',
    deadlineLabel: 'TODAY',
    deadlineISO: '2026-08-24T20:00:00Z',
    state: 'pending',
    priorityScore: 7.4,
    primaryLabel: 'VERIFY & CREATE EVENT',
    secondaryLabel: 'OPEN IN CRM',
    recipient: 'Operations — internal',
    draftSubject: 'Internal — deposit verification required (YT5044)',
    draftBody: `NEW OPERATION · Deposit marked as received in CRM.

Booking:     YT5044 — Famille Lecomte
Product:     Braga & Guimarães — All Inclusive
Departure:   6 Sep 2026 · 5 pax · FR
Deposit:     Marked received 23 Aug — NOT yet verified in the payment system

Two blocking items before this booking can advance:
  1. Confirm the deposit is reflected in the payment system, not only in the CRM.
  2. Create the calendar event for 6 Sep.

Once both are cleared, the FSE supplier shortlist for Braga & Guimarães can be validated and confirmation requests sent.`,
    links: link('YT5044', 'Lecomte', '2026-09-06'),
  },
  {
    id: 'ACT-005',
    bookingId: 'YT5035',
    severity: 'medium',
    title: 'Send reminder — Pinhão private boat still unconfirmed',
    subtitle: 'Amalie Jonassen · requested 6 days ago · no reply',
    stage: 'suppliers_confirmation',
    deadlineLabel: 'TOMORROW 09:00',
    deadlineISO: '2026-08-25T09:00:00Z',
    state: 'awaiting_supplier',
    priorityScore: 6.3,
    primaryLabel: 'SEND REMINDER',
    secondaryLabel: 'SNOOZE 24H',
    recipient: 'Boa Vista Boats',
    draftSubject: 'Lembrete — reserva de barco privado em Pinhão (ref. YT5035)',
    draftBody: `Bom dia,

Damos seguimento ao pedido de reserva de barco privado em Pinhão, enviado a 18 de agosto, para 2 pessoas no dia 2 de setembro (reserva YT5035).

Como ainda não obtivemos resposta, agradecíamos confirmação de:
  · disponibilidade na data
  · hora de embarque
  · ponto de encontro

Caso a data já não esteja disponível, agradecemos que nos informem com brevidade para podermos apresentar alternativa ao cliente.

Com os melhores cumprimentos,
Your Tours Portugal
reservas@yourtours.pt · +351 919 473 029`,
    links: link('YT5035', 'Boa Vista Boats', '2026-09-02'),
  },
  {
    id: 'ACT-006',
    bookingId: 'YT4993',
    severity: 'medium',
    title: 'Post-trip follow-up overdue — 37 days of silence',
    subtitle: 'Alejandra Campos · Porto · travelled 18 Jul · no feedback requested',
    stage: 'post_trip',
    deadlineLabel: 'THIS WEEK',
    deadlineISO: '2026-08-28T18:00:00Z',
    state: 'awaiting_approval',
    priorityScore: 5.9,
    primaryLabel: 'APPROVE & SEND',
    secondaryLabel: 'OPEN IN CRM',
    recipient: 'Alejandra Campos',
    draftSubject: '¿Cómo fue vuestra experiencia en Oporto?',
    draftBody: `Hola Alejandra,

Han pasado ya unas semanas desde vuestro día privado en Oporto, y nos encantaría saber cómo fue.

Si tenéis un momento, nos ayudaría mucho que compartierais vuestra opinión — tanto lo que más disfrutasteis como lo que podríamos mejorar.

Y si estáis pensando en volver a Portugal, estaremos encantados de preparar algo a vuestra medida: el Duero en temporada de vendimia y Coímbra con Aveiro son dos de nuestras rutas favoritas para quien ya conoce Oporto.

Un cordial saludo,
Your Tours Portugal
reservas@yourtours.pt · +351 919 473 029`,
    links: link('YT4993', 'Campos', '2026-07-18'),
  },
  {
    id: 'ACT-007',
    bookingId: 'YT4967',
    severity: 'medium',
    title: 'Deferred booking dormant for 74 days — propose new date or archive',
    subtitle: 'Chen Wei Group · 7 pax · original date 11 Jun · no new date proposed',
    stage: 'deferred',
    deadlineLabel: 'THIS WEEK',
    deadlineISO: '2026-08-29T18:00:00Z',
    state: 'pending',
    priorityScore: 5.2,
    primaryLabel: 'PROPOSE NEW DATE',
    secondaryLabel: 'MOVE TO ARCHIVE',
    recipient: 'Chen Wei Group',
    draftSubject: 'Your postponed Douro Valley tour — shall we find a new date?',
    draftBody: `Dear Mr Chen,

Earlier this year you postponed your private Douro Valley day tour for a group of seven, and we have been holding the booking open since.

We wanted to check whether you would like to set a new date. September and October are the finest months in the valley — the harvest is under way and the terraces are at their best — and we still have availability on several dates.

If your plans have changed, simply let us know and we will close the file with no further obligation.

Warm regards,
Your Tours Portugal
reservas@yourtours.pt · +351 919 473 029`,
    links: link('YT4967', 'Chen Wei', '2026-06-11'),
  },
];

export const mockActivity: ActivityEvent[] = [
  {
    time: '10:24',
    label: 'Deposit received — YT5047',
    sub: 'Hannah & Peter Voss · Porto · 12 Sep',
    icon: 'euro',
    color: '#2ee6a8',
  },
  {
    time: '09:51',
    label: 'Supplier confirmed — Quinta da Roêda',
    sub: 'YT5038 · Grupo Salazar · 15 Sep',
    icon: 'check',
    color: '#2ee6a8',
  },
  {
    time: '09:12',
    label: 'Tour started — YT5011',
    sub: "Jennifer & Mark O'Brien · Douro · in execution",
    icon: 'plane',
    color: '#5b9bff',
  },
  {
    time: '08:40',
    label: 'Stage advanced — YT5030',
    sub: 'Sofia Marchetti · moved to Technical Briefing',
    icon: 'arrow-right',
    color: '#b79dff',
  },
];
