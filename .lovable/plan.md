# Saída do NetHunt — TCC como CRM único (auditoria + plano)

Verificado no código e na base de dados a 19/11/2026. Itens marcados "a confirmar" ainda não foram verificados.

## 1. Mapa de dependências

Legenda: (a) substituir por equivalente TCC · (b) remover · (c) só histórico

| Item | Tipo | Função hoje | Destino |
|---|---|---|---|
| `nethunt-push` | Função | Escreve stage/campos no NetHunt; **rejeita files sem `nethunt_record_id`** | (b) após Fase 1 |
| `nethunt-pull` + `_shared/nethunt-pull-core.ts` | Função + cron 3/3h | Traz stages, campos e timeline | (b) Fase 2 |
| `nethunt-backfill`, `nethunt-webhook` | Funções | Importação histórica / webhook | (c) usar no backfill final, depois (b) |
| `nethunt-proxy` | Função | Leitura direta (CRM antigo, record detail) | (b) |
| `sync-worker` (entidades `lead`, `task`, `lead_create_deal`) | Função + cron 1/1min | Fila `sync_queue` → NetHunt; também Calendar | (a) manter para Calendar, retirar ramo NetHunt |
| `_shared/nethunt.ts`, `_shared/nethunt-timeline.ts` | Partilhado | Cliente API e timeline | (b) |
| `_shared/lead-matcher.ts`, `gmail-labels.ts`, `bokun.ts`, `workbenchScope.ts`, `calendar-sync-core.ts` | Partilhado | Usam nomes de stage NetHunt; Bókun cria Deal | (a) usar stage neutro; Bókun deixa de criar Deal |
| Trigger `leads_enqueue_nethunt` | BD | Enfileira sync NetHunt quando muda stage/datas/valor | (b) desligar por interruptor |
| Triggers `crm_stage_changed_at`, `leads_stage_history`, `leads_enqueue_calendar_*`, `leads_gmail_labels` | BD | Efeitos laterais da mudança de stage | (a) mantêm-se, só mudam de coluna |
| Tabelas `nethunt_timeline` (8.186 eventos: email, comment, calendar, field_change, file), `nethunt_sync_log`, `nethunt_sync_state`, `nethunt_field_state`, `nethunt_conflicts`, `nethunt_stage_codes` | BD | Espelho e estado da sync | timeline (c); restantes (b) |
| Colunas `leads.nethunt_stage`, `nethunt_record_id`, `nethunt_synced_at` | BD | Stage é usado em toda a app | stage (a) renomear; id/synced (c) |
| `useNetHunt.ts` (`usePushLead`, `useAddComment`, `useCreateNHTask`, `useUpdateNHTask`, `NETHUNT_STAGES`) | Hook | Gravação de stage, comentários e tasks via NetHunt | (a) |
| `LeadCrmTab`, `CrmLeadPreview`, `NetHuntSyncBar`, `NetHuntTaskList` | UI | Separador CRM e tasks | (a) LeadCrmTab/tasks; (b) SyncBar |
| `CRMRecordDetailPage`, `AdminSyncPage`, `AdminIntegrationsPage` | Páginas | Record antigo e administração da sync | (b) após corte; `/crm/:folder/:record` → redirect para a lead |
| `CRMPage`, `WorkbenchPage`, `LeadDetailPage`, `TasksPage`, `NewLeadDialog`, `FinancePanel`, `WorkbenchCalendar` | Páginas | Usam stage ou criação de Deal | (a) |
| MCP: `create-nethunt-deal`, `update-lead-stage`, `create-task`, `add-lead-note`, `get-lead`, `list-leads`, `validate-lead`, `import-lead-ai` + `mcp`, `mcp-agent-core`, `jarvis`, `crm-addon` | MCP/funções | Stage e escrita via NetHunt | `create-nethunt-deal` (b); restantes (a) |
| Segredos NetHunt (nome exato a confirmar) | Segredo | Acesso API | (b) Fase 3 |

## 2. Caminho de stage sem NetHunt

Onde vivem hoje os efeitos (confirmado):
- **Não estão no push.** `usePushLead` primeiro grava em `leads`, depois chama `nethunt-push`; se este falhar, **reverte o stage**. É essa reversão que faz o kanban falhar nas 83 files sem registo NetHunt.
- Os efeitos estão em **triggers da base de dados** que disparam com o UPDATE:
  - `leads_stage_history` → histórico/timeline de stage
  - `crm_stage_changed_at` → dias na etapa
  - `leads_enqueue_calendar_*` → evento no calendário Reservas YT (via `sync-worker`)
  - `leads_gmail_labels` → etiquetas Gmail
  - `leads_enqueue_nethunt` → só a sync NetHunt
- Regras OPS / separador Operações: derivam do valor de stage na app (a confirmar se há criação de linhas além da leitura).

Desenho:
1. Nova definição `nethunt_push_enabled` (em `system_settings`, por defeito ligada).
2. `usePushLead`: grava sempre no TCC; só chama `nethunt-push` se o interruptor estiver ligado **e** existir `nethunt_record_id`. Se o push falhar, **já não reverte**: mantém o stage e mostra aviso "gravado no TCC, NetHunt pendente"; a fila do trigger repete.
3. `nethunt-push` e `sync-worker`: sem registo ou interruptor desligado → `skipped`, sem erro.
4. Trigger `leads_enqueue_nethunt` passa a respeitar o interruptor.
5. MCP `update-lead-stage` e `crm-addon update_lead` seguem a mesma regra.
6. Como os efeitos estão nos triggers, mantêm-se exatamente iguais.

Renomear `nethunt_stage` → `stage`:
- Recomendado em duas etapas: adicionar `stage` sincronizada com `nethunt_stage` por trigger, migrar leitores (app, funções, MCP, triggers) e, na Fase 3, remover a antiga.
- Risco: alto se feito de uma vez — vários triggers, filtros de `when`, Workbench, etiquetas Gmail, Bókun e MCP usam a coluna; uma falha deixaria calendário/etiquetas sem disparar. Por isso fica fora do lote urgente.

## 3. Corte por fases

| Fase | Muda | Reverter | Testar antes de avançar |
|---|---|---|---|
| 0 (agora) | Ponto 2: sem reversão, ignora files sem registo | Restaurar hook anterior | Mover file sem registo e com registo; histórico, calendário, etiquetas e dias na etapa atualizados |
| 1 | `nethunt_push_enabled = off`; pull continua | Ligar interruptor | 1–2 semanas: NetHunt não recebe escritas; conflitos do pull não sobrepõem o TCC (pull com TCC como prioridade) |
| 2 | Cron `nethunt-pull` parado; Bókun deixa de criar Deal; NetHunt só consulta | Reativar cron | Backfill final (ponto 4) com relatório de lacunas aprovado |
| 3 | Remover funções, hooks, páginas, MCP NetHunt, segredos e cron; coluna `stage` final | Só por reposição de código; dados ficam | Sem referências restantes; testes e fluxos principais |

## 4. Exportação final do histórico

Já copiado (confirmado): `nethunt_timeline` com 8.186 eventos dos tipos email, comentário, calendário, mudança de campo e ficheiro; stage e campos principais em `leads`.

Não confirmado / provavelmente em falta:
- Cobertura completa da timeline (o pull usa janelas de período; histórico antigo pode faltar)
- Conteúdo de ficheiros anexos (há eventos "file", não necessariamente os ficheiros)
- Chamadas e outras atividades
- Tasks NetHunt completas e concluídas
- Utilizadores e responsáveis
- Records sem lead correspondente no TCC
- Conversas WhatsApp ligadas no NetHunt

Proposta: executar `nethunt-backfill` sem limite de período, em lotes; copiar ficheiros para armazenamento privado; guardar o registo bruto (JSON) por record; relatório com contagens NetHunt vs TCC por record e tipo, records órfãos e falhas. Corte só com diferença zero ou lacunas aceites.

## 5. O que o TCC ainda não tem

| Funcionalidade | Estado | Prioridade | Esforço |
|---|---|---|---|
| ID YT | Já existe (`next_yt_id`) | — | — |
| Vistas guardadas / kanban | Fase A | — | — |
| Etiquetas na lista do Gmail | Fase 1.2 | — | — |
| Ligação email ↔ file | Fase 1 | — | — |
| Comentários e tasks nativos (sem NetHunt) | Em falta | Alta | Médio |
| Automações/tasks por stage | Em falta | Alta | Médio |
| Deduplicação de contactos | Em falta | Média | Médio |
| Responsável/atribuição | A confirmar | Média | Baixo |
| WhatsApp | Fase B por fazer | Média | Médio–alto |
| Importação de emails históricos antigos | Parcial | Média | Baixo |

## 6. Impacto na Fase B (WhatsApp)

A Fase B ainda não foi construída, por isso não depende do NetHunt. O desenho fica totalmente local: mensagens, associação conversa ↔ file, timeline e marca no kanban nas tabelas do TCC. Conversas WhatsApp eventualmente ligadas no NetHunt (a confirmar) só se preservam se a API as devolver no backfill; caso contrário perdem-se no corte.

## Riscos
- Reversão atual: hoje uma falha NetHunt anula a mudança no TCC.
- Pull pode sobrepor stages do TCC durante a Fase 1.
- Renomear a coluna: muitos triggers e regras dependentes.
- Perda de histórico se o backfill não for completo antes do fim da subscrição.

## Ordem recomendada e lote barato

Lote pequeno agora: ponto 2 / Fase 0 (interruptor, sem reversão, ignorar files sem registo em hook, `nethunt-push`, `sync-worker`, trigger e MCP stage), com teste de regra.

Depois: auditoria de contagens para o backfill → Fase 1 → comentários/tasks nativos → backfill completo e relatório → Fase 2 → coluna `stage` → Fase 3. Fase B entra depois da Fase 1.
