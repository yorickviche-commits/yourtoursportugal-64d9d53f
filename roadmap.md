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
