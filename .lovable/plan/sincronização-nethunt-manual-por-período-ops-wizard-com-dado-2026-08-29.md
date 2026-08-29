# Sincronização NetHunt manual por período + Ops Wizard com dados reais

## O que verifiquei agora

- O cron `nethunt-pull-every-2-min` está activo (jobid 68) e corre a cada 2 minutos — nas últimas 24h gerou 2.191 registos em `nethunt_sync_log`. É isto que faz o sistema "ler tudo" continuamente.
- `runPull` só aceita `recordId`, `folder`, `fullTimeline`, `timelineLimit/Offset`, `leadIds`. **Não existe** filtro por período (desde ontem / 7 dias / mês / ano); os checkpoints são `deals_since` / `tasks_since` em `nethunt_sync_state`.
- Dados já sincronizados: 3.279 eventos de timeline, 176 leads (77 ganhas). A base está boa — o problema é o modo de sincronização.
- Ops Wizard: `ops_bookings` tem 14 linhas (seed de demonstração) e `ops_actions` tem **0**. Como `useOpsData` faz fallback para `mockBookings`/`mockActions` quando está vazio, a página está a mostrar dados fictícios. A "Live Activity" usa `mockActivity` fixo.
- `OpsWizardPage` não está dentro do `AppLayout` (ao contrário das outras páginas), por isso o menu desaparece e parece outra plataforma. Usa também um scroll horizontal em vez do scroll normal da página.

## Parte 1 — Sincronização NetHunt manual, por período

1. **Desligar o cron** de 2 minutos (fica só sincronização manual, como pediste).
2. `runPull` passa a aceitar `since` (ISO) e um `period`: `yesterday`, `7d`, `30d`, `12m`, `all`. O período é aplicado aos deals, tasks e timeline (em vez do varrimento a partir dos checkpoints antigos).
3. Depois de cada sincronização, o estado é gravado (`last_manual_sync_at`, período usado, contagens: leads actualizadas, tasks, eventos de timeline) e **os dados ficam persistidos até à próxima sincronização** — nada volta a ser lido automaticamente.
4. Painel de sincronização (no Agente CRM / cabeçalho do CRM e no separador CRM da lead):
   - selector de período: Ontem · Últimos 7 dias · Último mês · Último ano · Tudo
   - botão **Sincronizar** com estado de progresso
   - carimbo "Última sincronização: <data/hora> (período X)" e resumo do resultado em toast
   - opção "Só esta lead" no separador CRM da lead (já existe, passa a respeitar o período escolhido)

## Parte 2 — Ops Wizard: integrado, legível e com dados reais

1. **Voltar ao layout da plataforma**: envolver a página no `AppLayout`, mantendo o menu lateral e o estilo YT (branco/azul claro). Deixa de parecer uma app externa.
2. **Scroll vertical e informação grande**: remover o board de scroll horizontal. As secções passam a empilhar-se em altura, a full width, com tipografia e alvos de toque maiores:
   - Barra de KPIs operacionais (Críticos · Aprovações · Bloqueados · Partidas 7 dias)
   - **Fila de Prioridade** (cartões grandes, uma acção por linha)
   - **Pipeline / Calendário de Reservas** (vista própria, alternável lista/calendário)
   - **Prontidão por reserva** (Pagamentos · FSE & Bookings · Briefing FSE · Briefing Cliente)
   - **Actividade recente** (real, de `activity_logs` / `nethunt_timeline`)
3. **Dados reais em vez de mocks**: `useOpsData` passa a derivar as reservas das **leads reais** (`leads` com estado ganho/confirmado) e dos dados operacionais existentes:
   - reserva = lead (Ref YT, cliente, produto, data de partida, pax, idioma, owner)
   - pagamentos de `lead_payments` / `payment_links`
   - fornecedores e bookings de `lead_operations` / `ops_bookings` reais
   - briefings de `booking_emails_log`
   - as acções e severidades passam a ser calculadas com `readiness.ts` + `priority.ts` a partir destes dados (deixa de haver `ops_actions` fictícias)
   - fallback para mocks é removido; quando não há nada, mostra estado vazio honesto
4. Cada cartão liga à lead real (`/leads/:id`) e mantém os deep links NetHunt / Gmail / Calendar.

## Notas técnicas

- `supabase/functions/_shared/nethunt-pull-core.ts`: novo `period`/`since` em `PullOpts`, aplicado a `pageRecords` e a `syncTimeline`; gravação de `last_manual_sync_at` em `nethunt_sync_state`.
- Migração pequena: remover o job de cron (`cron.unschedule`) — sem alterações de schema.
- `src/hooks/useNetHunt.ts`: `useSyncNetHunt(period)` + `useSyncState()` para o carimbo da última sincronização.
- `src/hooks/useOpsData.ts`: reescrito para agregar leads + pagamentos + operações + emails de briefing (React Query, uma query por fonte).
- `src/pages/OpsWizardPage.tsx`: `AppLayout`, secções verticais, sem `mockOps`; `src/data/mockOps.ts` deixa de ser usado em produção.
