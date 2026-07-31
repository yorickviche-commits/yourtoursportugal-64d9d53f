# Criar links de pagamento WeTravel dentro da plataforma

## O que vai existir

1. **Botão "Criar link de pagamento" na secção Custos da lead** — junto à linha de totais (onde já está o PVP), pré-preenchido com o valor PVP final.
2. **Modal que espelha o formulário WeTravel**:
   - Título (máx. 70 caracteres, com contador) — pré-preenchido `YT-XXXX-0000 — <destino/cliente>`
   - Trip ID — código YT da lead
   - Datas início/fim — datas de viagem da lead
   - Montante + moeda — PVP total, EUR por defeito
   - Data de expiração — opcional (toggle Sim/Não)
   - Taxas de pagamento pagas por — Participant por defeito
   - Taxa WeTravel paga por — Participant por defeito
3. **Depois de publicado**: mostra o URL com botão copiar, e um atalho para colar no campo "Book Now" da proposta.
4. **Estado intermédio**: se o link foi criado no WeTravel mas a publicação falhou, aparece "Publicação pendente" com botão **Retomar publicação** (nunca cria um link novo).
5. **Menu Pagamentos**: nova secção "Links de pagamento" a listar os links gerados (título, valor, estado, data, lead) com copiar/abrir, além dos dados já existentes de trips e transações.

## Nota de âmbito

Sem webhooks nem reconciliação automática — a notificação de pagamento continua a chegar por email da WeTravel. O nome/email do pagador não é enviado (é recolhido no checkout WeTravel).

## Detalhes técnicos

**Base de dados** — nova tabela `public.payment_links`. O projeto não tem tabela `bookings`, por isso a ligação é `lead_id -> public.leads(id)` (+ `proposal_id` opcional para ligar ao botão Book Now). Campos: `wetravel_uuid` (unique), `url`, `title`, `trip_ref`, `start_date`, `end_date`, `amount_cents` (>0), `currency` (default EUR), `expires_at`, `payment_fees_paid_by`, `wetravel_fee_paid_by` (ambos `organizer|participant`, default participant), `status` (`draft|published|failed`), `last_error`, `idempotency_key` (unique), `created_by`, timestamps + trigger `updated_at`. GRANTs para `authenticated` (leitura) e `service_role` (tudo); RLS: SELECT para utilizadores internos (`is_internal_user`), escrita apenas via service role.

**`supabase/functions/_shared/wetravel-schema.ts`** — único ponto de acoplamento à API: `WETRAVEL` (baseUrl, tokenPath, paymentLinksPath, publishPath), `toWeTravelPayload()` e `fromWeTravelResponse()`, com comentários a marcar os nomes de campos a confirmar na doc privada.

**Edge function `wetravel-create-payment-link`** (nova):
- autentica o chamador com `requireInternalUser` (rejeita anónimos);
- valida `title` ≤ 70 e `amount_cents > 0` → 422 com mensagem legível;
- `idempotency_key = sha256(lead_id + amount_cents + title)`; se já existir `published` com essa chave devolve o link existente sem chamar a API;
- insere linha `draft`, troca `WETRAVEL_REFRESH_TOKEN` por access token (cache em memória com TTL, igual ao `wetravel-proxy`);
- POST criar → guarda `wetravel_uuid`; POST publicar → guarda `url` + `status = 'published'`;
- se criar mas falhar publicar: mantém `draft` com `wetravel_uuid` e `last_error`;
- ação `publish` separada para retomar sem recriar;
- retry com backoff apenas em 5xx/timeouts, nunca em 4xx.

**Frontend**
- `src/components/payments/PaymentLinkDialog.tsx` (novo) — modal do formulário, validação e estados de erro inline.
- `src/hooks/usePaymentLinksQuery.ts` (novo) — listar por lead, criar, retomar publicação.
- `src/components/trip/LeadCostingEditor.tsx` — botão na barra de totais + estado do link existente.
- `src/pages/PaymentsPage.tsx` — nova aba/secção "Links de pagamento".
- `supabase/config.toml` — registo da nova função.
