# Integração bidireccional NetHunt CRM

Verificações feitas antes deste plano: todas as colunas e tabelas de suporte já existem (`leads.nethunt_record_id/nethunt_stage/nethunt_updated_at/nethunt_synced_at/trip_start/trip_finish/close_date`, `tasks.nethunt_*/completed/all_day/due_at/assignee_emails/creator_email/nethunt_record_links`, `nethunt_timeline`, `nethunt_sync_state`, `nethunt_sync_log`). Nada de schema novo será criado. `NETHUNT_EMAIL` e `NETHUNT_API_KEY` já estão guardados como secrets. A rota `/tasks` já existe com uma página de tasks (258 linhas) — será mantida e ampliada, não substituída.

## Secret que falta

Só é necessário pedir um: `NETHUNT_WEBHOOK_SECRET` (valor à escolha, usado para validar o webhook do NetHunt). Será pedido no primeiro passo da execução.

## 1. Módulo partilhado

`supabase/functions/_shared/nethunt.ts` — único ponto de verdade para:
- constantes das pastas (deals `67bf55d488a689554e6a1c22`, tasks `67bf55d488a689554e6a1c24`) e IDs de campos
- cliente HTTP Basic com paginação e retry simples
- mapeamentos nos dois sentidos: stage ↔ `leads.status` (guardando sempre o stage exacto em `nethunt_stage`, e preservando o stage existente quando pertence ao mesmo grupo), `"72"` ↔ `client_type`, `"73"` ↔ `source`, datas epoch ms ↔ `date`
- helpers de log (`nethunt_sync_log`) e de checkpoint (`nethunt_sync_state`)

Isto evita duplicação de código nas 4 funções (menos tokens agora e em manutenções futuras).

## 2. Edge functions

| Função | JWT | Papel |
|---|---|---|
| `nethunt-backfill` | sim, admin | corrida única: liga records a leads por `"79"` == `leads.yt_id`; records sem lead ficam como `action='unmatched'` no log (nunca criam leads); tasks sem correspondência são criadas e ligadas pelo record link; devolve resumo com contagens |
| `nethunt-pull` | não | NetHunt → Lovable, incremental a partir dos checkpoints `deals_since` / `tasks_since`, last-write-wins (`skipped_lww` quando local é mais recente), sincroniza a timeline por `event_id`, actualiza `nethunt_synced_at`/`nethunt_updated_at` |
| `nethunt-push` | sim | Lovable → NetHunt para `lead`, `task`, `task_create`, `task_complete`, `comment` |
| `nethunt-webhook` | não | valida `NETHUNT_WEBHOOK_SECRET` e corre o pull apenas para o record afectado |

Anti-loop: o pull escreve com service role e marca `nethunt_synced_at`; o push é chamado apenas explicitamente pelas mutations do frontend. Sem triggers de base de dados a fazer HTTP.

Cron: `pg_cron` + `pg_net` a chamar `nethunt-pull` a cada 2 minutos.

## 3. UI — separador "CRM" na lead

Novo tab em `LeadDetailPage`, sem tocar nos tabs existentes:
- cabeçalho: nome do record, YT ID, link "Abrir no NetHunt", badge "Sincronizado há X" + refrescar
- campos editáveis inline com update optimista + push imediato e toast em caso de erro: Stage (select com os 11 valores exactos agrupados SALES/OPERATIONS), Trip Start, Trip Finish, Close date, Source (multi-tag), B2B/B2C (multi-tag)
- timeline de `nethunt_timeline`, mais recente primeiro, com filtros Todos / Emails / Comentários / Chamadas / WhatsApp e chats / Calendário / Ficheiros / Alterações de campo; ícone e cor por tipo; emails com assunto + snippet e corpo completo expansível; chats com transcrição
- caixa de comentário no topo (push para NetHunt, aparece logo na timeline)
- secção Tasks da lead: listar, criar (nome, descrição, due date + hora, all day, prioridade, assignee) e marcar concluída

## 4. UI — página Tasks

A página `/tasks` actual passa a ter duas vistas com um toggle: a vista existente mantém-se intacta e é adicionada uma vista "Lista NetHunt" com:
- colunas: concluída (checkbox), nome, prioridade, due date, assignee, record ligado (link para a lead), criador
- agrupamento Atrasadas / Hoje / Amanhã / Esta semana / Mais tarde / Sem data / Concluídas
- filtros: assignee (incl. "as minhas"), prioridade, estado, pesquisa, lead
- ordenação por due date e prioridade; criar/editar inline/concluir com push imediato
- botão refrescar + badge da última sincronização

## Notas técnicas

- React Query com invalidação por mutação; realtime Supabase em `leads`, `tasks` e `nethunt_timeline` para o UI reflectir o pull do cron sem refrescar
- Design system existente (tokens semânticos, shadcn), tudo em PT
- `nethunt-proxy` mantém-se como está; as novas funções usam o módulo partilhado
- Optimização de custo: um só módulo partilhado, sync incremental por checkpoint (nunca varrimentos completos após o backfill), timeline só das leads alteradas, e webhook para reduzir dependência do polling

## Ordem de execução

1. pedir `NETHUNT_WEBHOOK_SECRET`
2. módulo partilhado + 4 edge functions + cron
3. correr `nethunt-backfill` e mostrar o resumo
4. separador CRM na lead
5. vista NetHunt na página Tasks
