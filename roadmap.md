# Roadmap

## FASE 2 do MCP (em curso)
- [x] Fila de aprovações (`ai_action_queue`) + helpers (queue/travelPlan/costing/versions)
- [x] Ferramentas: approvals (2), costing (4), operações (3), validate, travel plan (4)
- [ ] Ferramentas: import_lead_ai, request_payment_link, draft_fse_requests, draft_client_email
- [ ] Página "Aprovações AI" + rota/permissão + separador Comunicações da lead
- [ ] Registar tudo em `src/lib/mcp/index.ts`, regenerar manifest, publicar
- [ ] Testes com leads de teste

## Manutenção de base de dados
- [ ] Uma migração com os GRANTs explícitos do Data API + função `public.audit_api_grants()` (aditiva, sem tocar em RLS/políticas)
- Regra permanente: toda a migração que crie tabela/vista em `public` inclui GRANTs (authenticated, service_role; anon só quando o acesso público é necessário), GRANTs de sequências e RLS ativa.
