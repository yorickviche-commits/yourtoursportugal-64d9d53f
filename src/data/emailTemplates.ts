/**
 * Templates de email pré-configurados para Vendas (Lead) e Operações (Trip).
 * Variáveis suportadas: {{client_name}}, {{lead_code}}, {{trip_code}}, {{destination}},
 *                       {{travel_dates}}, {{pax}}, {{sales_owner}}
 */

export type EmailCategory =
  // Sales / Lead
  | 'sales_first_contact'
  | 'sales_proposal'
  | 'sales_followup_d2'
  | 'sales_followup_d5'
  | 'sales_followup_d10'
  | 'sales_feedback'
  // Ops / Trip
  | 'ops_client_briefing'
  | 'ops_guide_briefing'
  | 'ops_fse_briefing'
  | 'ops_post_trip';

export interface EmailTemplate {
  key: EmailCategory;
  label: string;
  description: string;
  subject: string;
  body: string;
  group: 'sales' | 'ops';
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ===== SALES =====
  {
    key: 'sales_first_contact',
    group: 'sales',
    label: 'Primeiro Contacto',
    description: 'Qualificação inicial — apresentação YT',
    subject: 'Your Tours Portugal — Curating your journey',
    body: `Dear {{client_name}},

Thank you for reaching out to Your Tours Portugal.

I'm delighted to start designing your trip to {{destination}}. To craft the most relevant proposal, I'd love to learn a little more about what you're hoping to experience — pace, interests, must-have moments.

If it suits you, I can also send a few inspiration notes from past travellers with similar styles.

Looking forward to it.

Warmly,
{{sales_owner}}
Your Tours Portugal
reservas@yourtours.pt`,
  },
  {
    key: 'sales_proposal',
    group: 'sales',
    label: 'Envio de Proposta',
    description: 'Anexar/partilhar link da proposta aprovada',
    subject: 'Your tailored proposal — {{destination}} | Ref. {{lead_code}}',
    body: `Dear {{client_name}},

It's been a pleasure putting this together. Please find your personalised proposal for {{destination}} ({{travel_dates}}, {{pax}} travellers).

Every day has been hand-designed to balance signature experiences with quiet local moments. We can of course refine anything — pacing, accommodation style, or activity mix.

Take your time reviewing, and let me know your thoughts whenever you're ready.

Warmly,
{{sales_owner}}
Your Tours Portugal`,
  },
  {
    key: 'sales_followup_d2',
    group: 'sales',
    label: 'Follow-up D+2',
    description: 'Lembrete suave 2 dias após envio',
    subject: 'Following up on your Portugal journey',
    body: `Dear {{client_name}},

Just a brief note to check whether you've had a chance to look through the proposal. Happy to walk through any detail, swap experiences, or jump on a quick call if helpful.

Warmly,
{{sales_owner}}`,
  },
  {
    key: 'sales_followup_d5',
    group: 'sales',
    label: 'Follow-up D+5',
    description: 'Reforço com valor — partilhar contexto extra',
    subject: 'A small thought on your trip',
    body: `Dear {{client_name}},

While reviewing your itinerary I thought of one or two small adjustments that could elevate the experience — particularly around {{destination}}. Let me know if you'd like me to share them.

Warmly,
{{sales_owner}}`,
  },
  {
    key: 'sales_followup_d10',
    group: 'sales',
    label: 'Follow-up D+10',
    description: 'Última verificação antes de arquivar',
    subject: 'Still here when you are',
    body: `Dear {{client_name}},

I don't want to overwhelm you — just letting you know we're here whenever you're ready to move forward, even if timing has shifted.

Warmly,
{{sales_owner}}`,
  },
  {
    key: 'sales_feedback',
    group: 'sales',
    label: 'Pedido de Feedback / Fecho',
    description: 'Para leads que decidiram não avançar',
    subject: 'A quick note before we close your file',
    body: `Dear {{client_name}},

Before archiving your enquiry, would you mind sharing what shaped your decision? Honest feedback — even one line — helps us improve how we design future trips.

With appreciation,
{{sales_owner}}`,
  },

  // ===== OPS =====
  {
    key: 'ops_client_briefing',
    group: 'ops',
    label: 'Briefing Cliente (Pré-Trip)',
    description: 'Welcome + informações práticas antes da chegada',
    subject: 'Welcome to Portugal — Your trip details | {{trip_code}}',
    body: `Dear {{client_name}},

We can't wait to welcome you to Portugal on {{travel_dates}}.

A few practical notes before you arrive:
• Meeting point and arrival logistics — see attached
• Local contact (24/7): +351 XXX XXX XXX
• Weather expectations and packing tips
• Restaurant reservations confirmed for the dates highlighted

If anything changes on your end — flight delays, special requests — just reply to this email.

Safe travels,
Operations Team
Your Tours Portugal`,
  },
  {
    key: 'ops_guide_briefing',
    group: 'ops',
    label: 'Briefing Guia',
    description: 'Resumo operacional para o guia atribuído',
    subject: 'Guide briefing — {{client_name}} | {{trip_code}}',
    body: `Hi,

Please find the briefing for the upcoming trip:

• Client: {{client_name}}
• Code: {{trip_code}}
• Dates: {{travel_dates}}
• Pax: {{pax}}
• Destination: {{destination}}

Itinerary, contacts and special notes attached. Please confirm receipt and flag anything unclear at least 48h before departure.

Thanks,
Operations
Your Tours Portugal`,
  },
  {
    key: 'ops_fse_briefing',
    group: 'ops',
    label: 'Briefing Final FSE',
    description: 'Confirmação final ao fornecedor (rooming, horários, dietas)',
    subject: 'Final briefing — {{trip_code}} | {{client_name}}',
    body: `Dear partner,

Final briefing for the upcoming service:

• Reference: {{trip_code}}
• Client: {{client_name}}
• Date: {{travel_dates}}
• Pax: {{pax}}
• Rooming / dietary / accessibility notes: see attached

Please confirm everything is in order. Any changes, reply directly to this thread.

Best regards,
Operations
Your Tours Portugal
reservas@yourtours.pt`,
  },
  {
    key: 'ops_post_trip',
    group: 'ops',
    label: 'Pós-Trip — Review Cliente',
    description: 'Pedido de testemunho 2 dias após o regresso',
    subject: 'How was your Portugal journey?',
    body: `Dear {{client_name}},

We hope your time in Portugal lived up to expectations. If you have a quiet moment, we'd be grateful for a short note about what stood out — and what we could improve.

A few words on Google or TripAdvisor mean the world to our small team.

With gratitude,
{{sales_owner}} & Operations Team
Your Tours Portugal`,
  },
];

export interface TemplateContext {
  client_name?: string;
  lead_code?: string;
  trip_code?: string;
  destination?: string;
  travel_dates?: string;
  pax?: number | string;
  sales_owner?: string;
}

export function renderTemplate(template: EmailTemplate, ctx: TemplateContext): { subject: string; body: string } {
  const replace = (s: string) =>
    s
      .replaceAll('{{client_name}}', ctx.client_name || '[Client]')
      .replaceAll('{{lead_code}}', ctx.lead_code || '[Ref]')
      .replaceAll('{{trip_code}}', ctx.trip_code || ctx.lead_code || '[Ref]')
      .replaceAll('{{destination}}', ctx.destination || 'Portugal')
      .replaceAll('{{travel_dates}}', ctx.travel_dates || '[Dates]')
      .replaceAll('{{pax}}', String(ctx.pax ?? ''))
      .replaceAll('{{sales_owner}}', ctx.sales_owner || 'Your Tours Portugal');
  return { subject: replace(template.subject), body: replace(template.body) };
}
