# Passo 3/4 — Evento Calendar no formato YT

## Objetivo
Completar os dados operacionais por dia e gerar a pré-visualização/evento Google Calendar com o formato interno YT, preservando integralmente as proteções existentes.

## Implementação
1. **Migração aditiva**
   - Adicionar a `leads`: idioma do serviço, origem e referência externa da reserva.
   - Criar `lead_day_ops` com um registo único por lead/dia, RLS e grants explícitos.
   - Adicionar hora final a `lead_operations`.
   - Criar/preencher `integration_settings.calendar_colors` com o mapa pedido.
   - Acrescentar triggers de fila apenas para os novos campos/tabela e alterações relevantes.

2. **Operações e Dados Gerais**
   - Acrescentar em Dados Gerais os três campos da reserva.
   - Em cada dia de Operações, adicionar “Dados do dia” recolhível, compacto e com gravação automática.
   - Acrescentar hora final por serviço na tabela operacional existente.

3. **Template Calendar**
   - Reunir lead, parceiro, dados do dia, serviços, costing, notas, emails e proposta LIVE.
   - Gerar título e descrição na ordem e terminologia indicadas, incluindo links TCC/Maps, pax, estados, pagamentos, fatura e notas.
   - Calcular adultos como total menos crianças e bebés, respeitando que `leads.pax` é o total atual.
   - Não enviar `attendees` em atualizações/criações.
   - Preservar `colorId` de eventos existentes; aplicar `calendar_colors` apenas na criação.
   - Manter IDs fixos, `extendedProperties`, snapshots, etag/If-Match, proteção manual e proibição de DELETE.

4. **Pré-visualização e MCP**
   - Expor o mesmo gerador do evento em modo de pré-visualização, sem escrever no Google Calendar.
   - Adicionar “Ver como fica no calendário” ao badge, com título e descrição só de leitura.
   - Expandir `get_operations` com os dados por dia e hora final.
   - Criar `update_day_ops`, com OAuth/RLS, validação, upsert idempotente e auditoria “AI agent (MCP)”.

5. **Validação**
   - Verificar compilação, migração, funções e ausência de qualquer chamada DELETE ao Google.
   - Testar uma lead futura de um dia e uma multi-dia com crianças, incluindo atualização pela fila em menos de um minuto.
   - Confirmar preservação de cor manual e bloqueio de eventos `manual_edit`.
   - Remover todos os dados de teste criados e listar ficheiros, migração e limitações finais.

## Limites
- Sem alterações a NetHunt, timeline, propostas, PDFs ou páginas não abrangidas.
- `LeadDetailPage.tsx` será alterado apenas nos três campos de Dados Gerais pedidos; `CalendarSyncBadge.tsx` apenas para a pré-visualização.
- `OperationsTable.tsx` só será alterado se for necessário manter a tabela operacional alternativa coerente com a nova hora final.
