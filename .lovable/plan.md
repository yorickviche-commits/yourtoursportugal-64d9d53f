# Operações — novos estados de Reserva, Pagamento e Fatura

Simplificar e alinhar os três seletores de estado da tabela de Operações da lead com o processo real da equipa.

## Novas listas de estados

**Reserva**
- Neutro (cinza)
- Enviado (azul)
- Reservado (verde)

**Pagamento**
- Neutro (cinza)
- Pago (verde)
- Pago Parcialmente (laranja)
- Conta Mensal (azul)
- A Pagar pelo Guia (roxo)
- Não Pago (vermelho)

**Fatura**
- Não Recebida (cinza)
- A Levantar pelo Guia (laranja)
- Recebida (verde)

Estados antigos (Pedido, Confirmado, Recusado, Cancelado, Em Espera, Reembolsado, Pedida, Aprovada, Paga) deixam de estar disponíveis para seleção.

## Compatibilidade com dados já gravados

Linhas já gravadas com estados antigos passam a ser lidas com equivalência automática, para não aparecerem em branco:
- `requested` → Enviado; `confirmed` → Reservado; `declined`/`cancelled`/`waitlisted` → Neutro
- `refunded` → Neutro; `not_paid` mantém-se Não Pago
- `invoice_requested` → Não Recebida; `invoice_approved`/`invoice_paid` → Recebida

Os contadores no topo ("Confirmados / Pagos / Faturas") passam a contar respetivamente Reservado, Pago (e Pago Parcialmente como parcial) e Recebida.

## Detalhes técnicos

- `src/components/leads/opsConstants.ts`: substituir `BOOKING_OPTIONS`, `PAYMENT_OPTIONS`, `INVOICE_OPTIONS` pelos novos valores (`neutral | sent | booked`, `neutral | paid | partially_paid | monthly_account | guide_to_pay | not_paid`, `not_received | guide_pickup | received`) e adicionar mapas de normalização de valores legados.
- Defaults ao criar/ler linhas em `LeadOperationsEditor.tsx` passam a `neutral` / `neutral` / `not_received`; a ação de anexar fatura marca `received`.
- Ajustar contagens do cabeçalho e o painel de indicadores (`LeadOpsAnalyticsPanel.tsx`) e o PDF de planning do guia para os novos valores.
- `supabase/functions/calendar-sync/index.ts`: reconhecer `booked` como confirmado e `received` como faturado, mantendo os valores antigos aceites.
- A coluna continua `text` na base de dados — sem migração necessária.
