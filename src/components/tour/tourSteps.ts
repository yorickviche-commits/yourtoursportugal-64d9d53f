import type { Step } from 'react-joyride';

export type TourTag = 'Sales' | 'Ops' | 'Ambos';

export type YTStep = Step & {
  route?: string;
  tag: TourTag;
  ai?: boolean;
  title: string;
};

export const tourSteps: YTStep[] = [
  {
    target: 'body',
    placement: 'center',
    tag: 'Ambos',
    title: 'Bem-vindo ao Cockpit',
    content:
      'Este é o teu centro de operações Your Tours. Regra de ouro: NetHunt = comunicação com cliente · Lovable = execução da viagem. Vamos fazer um tour rápido (12 passos).',
  },
  {
    target: '[data-tour="sidebar"]',
    placement: 'right',
    tag: 'Ambos',
    title: 'Sidebar — a tua bússola',
    content:
      'Organizada por departamento: Visão Geral, Reservas, Comercial, Admin e AI Agents. Expande quando passas o rato. Tudo o que precisas está a um clique.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/dashboard',
    tag: 'Ambos',
    title: 'Dashboard — prioridades do dia',
    content:
      'Vê as viagens a partir nos próximos dias agrupadas por D-1, D-3, D-7. 🔴 vermelho = urgente · 🟠 laranja = aviso · 🟢 verde = estável. Começa sempre o dia aqui.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/leads',
    tag: 'Sales',
    title: 'Leads — onde tudo começa',
    content:
      'Toda a oportunidade entra como lead. Podes registar manualmente ou usar AI Import (cola o email do cliente e a IA extrai dados, score 0-100 e destino).',
  },
  {
    target: '[data-tour="new-lead"]',
    placement: 'left',
    tag: 'Sales',
    ai: true,
    title: 'Nova Lead · Manual ou IA',
    content:
      'Botão sempre presente. Modo "IA" faz parsing natural do email do cliente, sugere score e qualifica automaticamente. Leads <50 pontos não geram itinerário.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/leads',
    tag: 'Sales',
    ai: true,
    title: 'Planner & Costing automáticos',
    content:
      'Dentro de cada lead tens 5 tabs. O Planner gera o travel plan com IA e o Custos calcula o budget em 5 camadas: Transporte → Guia → Experiências → Alojamento → Refeições. Margem default 30%.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/proposals',
    tag: 'Sales',
    title: 'Proposta para o cliente',
    content:
      'Cria propostas em inglês premium, 5-7 bullets por dia, capas 21:9. Propostas acima de €8 000 exigem aprovação do CEO antes de seguirem para o cliente.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/trips',
    tag: 'Ops',
    title: 'Viagens confirmadas',
    content:
      'Quando uma lead vira "won", aparece aqui. Cada viagem tem workspace de 6 tabs: itinerário, custos, operações, pagamentos, comunicação e documentos. Tudo num só sítio.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/agents/supplier',
    tag: 'Ops',
    ai: true,
    title: 'FSE Pre-Booker · O agente estrela',
    content:
      'A IA prepara um email de pré-reserva por cada fornecedor da viagem usando os protocolos FSE. Tu revês um a um: Enviar · Editar · Saltar. Nada sai sem aprovação humana.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/comercial/matriz',
    tag: 'Ops',
    title: 'Mapa FSE & Google Drive',
    content:
      'Mapa interativo dos fornecedores por destino e categoria. Clica num FSE para ver pastas, protocolos e PDFs do Drive em pop-up — sem sair da página.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/ai-office',
    tag: 'Ambos',
    ai: true,
    title: 'AI Work Office · 13 agentes',
    content:
      'Visualização do escritório de IA. Cada agente (qualificação, itinerário, follow-up, fornecedores, ops...) tem fila de ações à tua espera. Aprova, edita ou rejeita.',
  },
  {
    target: 'body',
    placement: 'center',
    route: '/crm',
    tag: 'Ambos',
    title: 'CRM & Comunicação — pronto!',
    content:
      'NetHunt é a camada oficial de comunicação. Em /crm vês cards, emails, notas e tasks sincronizados. Lembra: conversas com cliente vivem no NetHunt, execução vive aqui. Estás pronto. Bom trabalho! 🚀',
  },
];
