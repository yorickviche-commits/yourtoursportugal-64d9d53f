## Objetivo

Separar claramente as duas áreas e remover sobreposição:

- **Leads & Files** = ciclo comercial (vendas, propostas, follow-up cliente)
- **Bookings & Reservas Confirmadas** = ciclo operacional (execução do trip)

Cada área mantém a sua lista e histórico próprios.

---

## 1. Lead Detail (Leads & Files) — remover Operações

Hoje a Lead tem 5 tabs (Dados Gerais, Planner, Custos, **Operações**, etc.).

**Mudança:**
- Remover a tab **Operações** da Lead.
- Manter: Dados Gerais, Planner/Itinerário, Custos, Propostas.
- Adicionar tab/secção **"Comunicações"** com botões de email pré-configurados:
  - Primeiro contacto / Qualificação
  - Envio de proposta
  - Follow-up cliente (D+2, D+5, D+10)
  - Pedido de feedback / fecho de lead

Cada botão abre o AI Email Composer já existente, com template pré-selecionado e envia via Gmail (`reservas@yourtours.pt`), regista em `booking_emails_log` (vamos generalizar — ver §4).

---

## 2. Booking/Trip Detail (Bookings & Reservas) — absorver Operações

Quando uma Lead é confirmada e passa a Booking, o workspace do Trip passa a ter:

1. **Dados Gerais** — cliente, datas, pax, valor (read-only herdado da Lead)
2. **Itinerário** — exatamente o que está hoje no Travel Planner / PDF da proposta aprovada (read-only ou editável conforme já existe)
3. **Custos** — importados da Lead (cost_items / lead_costing_data já existentes, copiados ou referenciados pelo trip_id)
4. **Operações** — o quadro de funções que hoje está dentro da Lead (booking_status, payment_status, invoice_status por item — vem de `lead_operations`, será espelhado/movido para chave por `trip_id`)
5. **Comunicações Ops** — emails operacionais pré-configurados:
   - Pré-trip: Briefing cliente / welcome
   - Briefing do guia
   - Briefing final FSE (fornecedor)
   - Pedido de reserva ao fornecedor (já existe — `BookingRequestDialog`)
   - Pós-trip: Review cliente / pedido de testemunho

---

## 3. Migração de dados Lead → Booking

Para garantir que o histórico se mantém em cada lado:

- `lead_operations` continua a existir para leads históricas, mas para Trips confirmadas a UI passa a ler/escrever via `trip_id`. Adicionar coluna `trip_id` opcional em `lead_operations` (já existe `lead_id`) OU criar `trip_operations` espelho. **Decisão recomendada:** adicionar `trip_id` a `lead_operations` e filtrar a tab de Operações do Trip por `trip_id` (mais simples, mantém histórico unificado).
- Custos: a tab Custos do Trip lê `lead_costing_data` da lead original (link via `proposals.lead_id` ou `proposals.booking_id`).
- Itinerário do Trip: lê a `proposal` aprovada (status `approved`) ligada à booking — é exatamente o PDF.

---

## 4. Templates de email e log

- Generalizar `booking_emails_log` para servir os dois lados:
  - já tem `lead_operation_id` e `operation_id` — adicionar `email_category` (`sales_first_contact`, `sales_proposal`, `sales_followup`, `ops_client_briefing`, `ops_guide_briefing`, `ops_fse_briefing`, `ops_post_trip`)
  - na Lead: timeline filtra por `lead_id` + categorias sales
  - na Booking: timeline filtra por `trip_id` + categorias ops
- Templates ficam definidos em `src/data/emailTemplates.ts` (novo) e usam variáveis do Master Prompt.

---

## Detalhes técnicos

**Ficheiros a alterar (estimativa):**
- `src/components/lead/LeadDetailTabs.tsx` (ou equivalente) — remover tab Operações, adicionar tab Comunicações
- `src/components/trip/TripWorkspace.tsx` (ou equivalente) — garantir 5 tabs: Dados / Itinerário / Custos / Operações / Comunicações Ops
- Mover `OperationsBoard` / `LeadOperationsTable` para componente partilhado parametrizado por `lead_id` OU `trip_id`
- Novo `src/components/communications/EmailQuickActions.tsx` — botões com categorias
- Novo `src/data/emailTemplates.ts` — templates PT/EN por categoria
- Reutilizar `send-booking-email` edge function (renomear conceptualmente para `send-workflow-email`) — aceita `category` no payload
- Migração SQL: `ALTER TABLE lead_operations ADD COLUMN trip_id uuid` + `ALTER TABLE booking_emails_log ADD COLUMN email_category text, trip_id uuid`

**Confirmações necessárias antes de implementar:**

1. **Operações na Lead:** confirmas que queremos REMOVER completamente a tab Operações da Lead (ninguém vai mais lá), OU manter como read-only enquanto a lead não é convertida?
2. **Lista única vs separada:** "Bookings & Reservas Confirmadas" só mostra trips com status confirmado/pago (origem = proposal aprovada). Lead deixa de aparecer aí. Correto?
3. **Templates de email:** queres que eu escreva já os textos completos PT/EN para os 8 templates (sales + ops), ou só a estrutura e tu preenches depois no Admin?