# Welcome Tour — Operations Cockpit

Tour guiado unificado (Sales + Ops) que arranca automaticamente no primeiro login, com spotlight no elemento real da UI e tooltip explicativo. Navega entre páginas reais para o user aprender fazendo.

## Comportamento

- **Trigger:** ao montar `AppLayout`, lê `localStorage.yt_tour_completed`. Se ausente → inicia automaticamente após 800ms.
- **Reabrir:** botão flutuante "?" (canto inferior direito, ao lado do FAB de nova lead) abre o tour a qualquer momento.
- **Persistência:** `localStorage.yt_tour_completed = "v1"` ao concluir ou saltar. Versão permite re-trigger futuro se mudarmos o tour.
- **Skip:** botão "Saltar tutorial" sempre visível no tooltip.

## Os 12 passos (sequência narrativa)

Cada passo tem: título PT, 2-3 linhas de descrição, tag `[Sales]` / `[Ops]` / `[Ambos]`, badge "IA" quando a feature envolve agentes.

1. **[Ambos] Bem-vindo ao Cockpit** — modal central de abertura. Explica filosofia: NetHunt = comunicação, Lovable = execução. Botão "Começar tour".
2. **[Ambos] Sidebar — a tua bússola** — spotlight no `AppSidebar`. Mostra que expande on hover e organiza por departamento.
3. **[Ambos] Dashboard — prioridades do dia** *(navega para `/dashboard`)* — spotlight no bloco D-1/D-3/D-7. Vermelho = urgente, laranja = aviso, verde = estável.
4. **[Sales] Leads — onde tudo começa** *(navega para `/leads`)* — spotlight no botão "+ Nova Lead". Explica registo manual vs **AI Import** (badge IA) que faz parsing de email natural.
5. **[Sales] Detalhe da lead — 5 separadores** *(navega para primeira lead disponível ou demo)* — spotlight nos tabs. Scoring 0-100 decide próximo passo; <50 = sem itinerário.
6. **[Sales][IA] Planner & Costing automáticos** — spotlight nos tabs Planner/Custos. IA gera travel plan e budget 5-tier (Transporte→Guia→Experiências→Alojamento→Refeições) com margem 30%.
7. **[Sales] Proposta cliente** *(navega para `/proposals`)* — spotlight no "Nova proposta". Inglês premium, 5-7 bullets/dia, >€8k exige aprovação CEO.
8. **[Ops] Viagens confirmadas** *(navega para `/trips`)* — spotlight num trip card. Workspace de 6 tabs unifica reserva, pagamentos, ops e comunicação.
9. **[Ops][IA] FSE Supplier Pre-Booker** *(navega para `/agents/supplier`)* — spotlight na queue de emails. IA prepara pré-bookings por fornecedor; humano revê → Enviar/Editar/Saltar.
10. **[Ops] Mapa FSE & Drive** *(navega para `/comercial/matriz`)* — spotlight no mapa interativo. Filtra por destino/categoria, abre PDFs do Drive em pop-up sem sair.
11. **[Ambos][IA] AI Work Office** *(navega para `/ai-office`)* — spotlight nos 13 agentes. Cada agente tem página própria com fila de ações para aprovar.
12. **[Ambos] Aprovações & CRM** *(navega para `/approvals`)* — spotlight na lista. Lembra: comunicação cliente fica em NetHunt (`/crm`), aprovações operacionais ficam aqui. CTA final: "Concluir tour".

## Arquitetura técnica

- **Dependência:** `react-joyride` (`bun add react-joyride`) — gere spotlight, overlay escuro, navegação entre passos e cross-page via `continuous` + `disableScrolling=false`.
- **Novos ficheiros:**
  - `src/components/tour/TourProvider.tsx` — wrapper com `<Joyride>`, estado dos steps, handler de navegação (`useNavigate` entre passos), persistência localStorage.
  - `src/components/tour/tourSteps.ts` — array tipado com `target`, `content`, `route?`, `placement`, `tag`, `aiBadge`.
  - `src/components/tour/TourLauncher.tsx` — botão flutuante "?" que dispara `setRun(true)`.
- **Integração:** montar `<TourProvider>` dentro de `AuthProvider` em `App.tsx` (envolve `BrowserRouter`). Render `<TourLauncher />` em `AppLayout.tsx`.
- **Targets:** adicionar `data-tour="sidebar"`, `data-tour="new-lead"`, `data-tour="dashboard-priorities"`, etc. aos componentes existentes (mudança mínima, só atributos).
- **Estilo tooltip:** custom `tooltipComponent` com cores semânticas do projeto (YT Blue `#0a2540` header, badges IA em accent), tipografia já existente. Tag `[Sales]/[Ops]` como chip colorido, badge "IA" com ícone Sparkles.
- **Navegação cross-page:** no callback `Joyride` `(data) => { if (step.route) navigate(step.route) }` antes de avançar; pequeno delay para o DOM montar.

## Fora de scope

- Tradução EN (PT only, como o resto da UI interna).
- Tracking analítico de quem completou (só localStorage).
- Tours contextuais por página (só o welcome global).
- Vídeos ou screenshots embebidos (só texto + spotlight no elemento real).
