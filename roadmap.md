# Cockpit decisions — Lote 2 (24 nov 2026)
- [x] 0: Carter approved by Yorick; source done, unchanged. YT5124 handled without actor/event; no evidence identifying a test, left unchanged rather than invent attribution.
- [x] A: atomic execution claims, approved snapshots, next-day Lisbon 08:00 client schedule/cancel/send-now, audit/results and safe retries. Six unit tests and transactional execution tests pass; signed-in edit/approve/schedule/cancel/reload passed on an isolated archived test file; zero external sends. Executor deployed, frontend not published, Costs unchanged.
- [ ] A validation: actual Gmail/WeTravel delivery and scheduled 08:00 firing not exercised to avoid contacting clients/creating money links; unknown outcomes require manual inspection. Mobile flow was obstructed by existing onboarding; desktop flow passed. YT5124 ownership remains unverified.
- [ ] B: five MCP tools, authorized human relay and server instructions/manifest/deployment deferred at the budget boundary; no MCP changes made.
- [ ] C: today grouped log and dedicated mobile review deferred at the budget boundary; learning tab already present from Lote 1.

# Cockpit decisions — Lote 1 (24 nov 2026)
- [x] Add protected deduplicated decision index, source triggers, hourly/event reconciliation and simulation-first human activation; no source deletion or automatic execution.
- [x] Add mobile-first Cockpit queue, source-compatible human actions, snooze/reopen/history and Admin learning tab; preserve Costs/execution and never publish.
- [x] Verify live simulation counts, transactional rule tests and authenticated 390/360/1440 flow, real snooze/reload/resume with source task unchanged; report usage window.
- [ ] Automatic reply closure for legacy alerts: blocked by missing exact thread and historical ball snapshot; never infer a reply from an unrelated thread. Finance live approval blocked by empty batch; external email/payment execution intentionally not exercised.

# Lead removal and archive policy — current request
- [x] Correct eight restrictive lead references; cascade Workbench/tasks and preserve archive/approvals/trips with SET NULL. Transactional regression and authenticated mobile Remover/checklist read-back passed; no production lead deleted, zero test leads left.
- [x] Record past-as-archive and today/future completeness priority in memory/report; NetHunt sync and publication unchanged. 38 existing tests passed; raw archive remains 23,866 objects / 13 copied files.

# NetHunt final backfill — current request
- [x] Archive 23,866 raw objects from four accessible folders; 24 sources verified by read-back hashes, four email sources explicitly unsupported; no lead/stage or sync cursor writes.
- [x] Recover 742 completed missing tasks and 213 missing timeline events, preserve existing tasks, replay tasks with zero inserts; copy and hash-verify all 13 Drive files in private storage.
- [x] Dated coverage/gap report; authenticated task-board and private file read-back; eight safety tests.
- [x] Keep push/pull, frontend publication and WhatsApp unchanged.
- [ ] Before cutoff: independent NetHunt folder totals, historical Gmail/attachments coverage, WhatsApp/users/automations export and reconciliation of 663 raw-only files / unlinked tasks; blocked by exports/data unavailable through the current API and human review. No shutdown authorized.

# Native CRM comments and tasks
- [x] Local comments/tasks in lead CRM and Gmail add-on; no NetHunt calls or task enqueue triggers.
- [x] Authenticated YTteste comment/task write and reload, completion persisted, zero NetHunt calls and runtime errors; 14 Vitest + 9 add-on tests passed; crm-addon deployed, frontend not published.

# CRM WhatsApp — Phase B (deferred by user; not part of this request)
- [ ] Inbox, messages/media, linking/history, lead timeline and unread Kanban badges; human-only sending, no frontend publication.
- [ ] Resolve inbound support before implementation: Lovable WhatsApp receiving requires the modern stack; current Classic project is unsupported. No WhatsApp connection available. Await choice of stack migration or an explicitly supported external receiver.

# CRM pipelines — Phase A
- [x] Local realtime Kanban, saved views, stage timestamp and shared badges; 328/328 leads stamped.
- [x] Reuse stage mutation, creation, preview and legacy navigation; NetHunt sync functions unchanged.
- [x] Nine rule tests; authenticated saved view/reload/delete, YT5057 preview, OPS confirmation and mocked failure reversal; mobile 390/360 without overflow; not published.
- [ ] Live stage movement, second-client realtime and external Calendar effects: deliberately not exercised on real files to avoid operational side effects; existing push also rejects files without a NetHunt record.

# Internal Costing downloads
- [x] Add PDF/Excel menu next to Save with full descriptions and notes.
- [x] Verify authenticated downloads on YT5057, all seven PDF pages, long-note continuation, Excel totals and zero formula errors; fixed orphaned PDF summary heading and unsupported minus glyph.

# Margin reference — current request
- [x] Audit database constraints, triggers, policies and report indicator; no database margin rejection found; informational comments migrated.
- [x] Replace MCP rejection with warnings; mcp-agent-core deployed.
- [ ] Deploy OAuth mcp: platform withholds this endpoint until the next app publication.
- [x] Rename Admin reference and show a non-blocking Costing warning, with hotel/service breakdown.
- [x] Test low-margin writes/validation and preserve CEO approval: 19 tests passed; real SALES YT5031 warning and enabled save/payment controls checked without modifying the file.

# Roadmap
- [x] CRM Gmail 1.2: etiquetas geridas, teste de uma thread YT5057 preservando outras labels, criação em ambas as caixas e backfill de 90 dias ativado no cron existente.
- [x] CRM Gmail 1.1: checklist partilhada, tarefas, pesquisa de eventos, edição manual, 9 testes incluindo leituras YT5057 sem gravações e deploy apenas crm-addon.
- [x] Mobile lot: shell with bottom tabs, badges, safe areas and compact header; desktop checked at 1440px.
- [x] Mobile lot: Cockpit file cards/panel, touch checklist, urgency sheet, day calendar, finance layout and pull-to-refresh; real Sales/Ops threads checked at both phone sizes.
- [ ] Mobile next lot: compact overflow menu for Archive/Finance; direct inbox reply/archive shortcuts require an approved write path (mirror remains read-only); paginated Archive and mobile summary of missing items.
- [x] Mobile lot: AI approval review sheet, edit/preview and fixed primary actions; no approval execution triggered during tests.
- [ ] Mobile next lot: complete lead details, Operations/Costing cards, filter sheets and sticky daily actions.
- [x] Mobile lot: manifest-only installation and icons; verified 390×844, 360×780, desktop and zero service workers; not published. Physical iPhone installation remains unverified.
- [ ] Mobile validation: finance approval/rejection with a real pending batch (currently empty); checklist write/reload and touch pull-refresh/gesture checks.
- [x] Workbench: âmbito futuro Lisboa, Arquivo consultável e pendências, emails novos, calendários e MCP; 23 testes, consulta real e contagens verificadas.
- [x] Workbench entrega inicial: navegação protegida, estrutura inbox/file, aprovação sem execução, checklists e prontidão; teste real de valor manual/reload e recompute em lote.
- [ ] Workbench caixas Gmail: aguarda renovar consentimento da ligação existente e ligar/verificar operations@; inbox real não pôde ser testado.
- [ ] Workbench restante fase 1: calendários/detalhes Google/NetHunt diretos, MCP, N/A automático, regras de urgência restantes e limites em settings, propostas do ledger com revisão, logs reversíveis e pendências específicas; parado no limite solicitado desta entrega.
- [x] Popular versões A dos 11 produtos com inclusões dos PDFs, horários disponíveis, rubricas e opcionais; verificar fichas, persistência e cálculo de importação.
- [ ] Completar FSEs/NET e combinações B/C: aguarda fornecedores, protocolos e combinações aprovadas não identificados nos PDFs comerciais.
- [x] Representar e editar add-ons do catálogo nas versões, Planner e Custos; desenvolver descrições YT sem inventar inclusões ou custos NET.
- [x] Versões A/B/C no catálogo com Travel Plan e operações FSE/NET; importar a versão guardada para Planner e Custos e verificar persistência.
- [x] Download direto do PDF do Planner, compressão abaixo de 10 MB e verificação de itinerário de 15 dias.

- [x] Alinhar cancelamento editável (day tour 7 dias / multi-day 30) e ordem dos serviços nos próximos passos.

- [x] Página Consumo AI (/admin/consumo)
- [x] JARVIS: copiar ficheiros prontos (página, HTML, função) + deploy
- [x] Corrigir inclusões dinâmicas sem limite no Planner, proposta e PDF; verificar YT5171.

## Workbench — Lote 2 (12 nov 2026)
- [x] Correções A1–A6, calendário, regras de urgência 2–5, pendentes, links, propostas, ferramentas MCP
- [ ] Ligar Gmail operations@yourtours.pt (precisa de pessoa) e associar como GOOGLE_MAIL_API_KEY_1
- [ ] Dar às chaves de agentes acesso às 5 ferramentas Workbench (Admin)

## CRM no Gmail — Fase 1 (13 nov 2026)
- [x] YT#### gerado no TCC, email_links/sugestões, crm-email-sync (cron), crm-addon, separador CRM e "Emails por ligar".
- [ ] Ligar contabilidade@ nos conectores Gmail e associar em `mailbox_finance` (precisa de pessoa).
- [ ] Adicionar secret ADDON_GOOGLE_CLIENT_IDS após o add-on Apps Script devolver o `aud`.
