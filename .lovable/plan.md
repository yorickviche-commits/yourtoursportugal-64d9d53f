# Ajustes: preço NET B2B, depósito 25/50%, gestão de links, secção Alojamentos, nome do PDF

## 1. "Preço Total NET" para clientes B2B

Quando a lead está marcada como **B2B**, o rótulo do preço passa a ser "Preço Total NET" (traduzido no idioma da lead) no itinerário digital e no PDF. Em B2C mantém-se "Preço Total".

## 2. Depósito com botões 25% / 50% (janela WeTravel)

Na configuração do plano de pagamento, junto ao campo *Deposit due at booking*:
- dois botões **25%** e **50%** que calculam automaticamente o montante a partir do total;
- o valor calculado fica no campo e continua totalmente editável à mão (valor absoluto livre);
- as prestações seguintes são recalculadas com o novo depósito, como já acontece hoje;
- o botão fica visualmente ativo quando o valor corresponde exatamente a 25% ou 50%.

## 3. Editar e eliminar links de pagamento (custos)

Na lista de links dentro da secção Custos:
- **Editar**: disponível apenas em links ainda **não publicados** (pendentes), onde a WeTravel permite alterar; abre a mesma janela pré-preenchida e grava as alterações.
- **Eliminar**: disponível em qualquer link. Elimina o link na WeTravel e remove-o também da plataforma. Se o link estava ativo, o botão *Book Now* é desativado nas propostas dessa lead.
- Confirmação antes de eliminar, com aviso claro de que o link deixa de funcionar para o cliente.

## 4. Nova secção "Alojamentos" nos Custos

- Chaveta própria, separada do day-by-day, com as mesmas funções das restantes (adicionar/remover linhas, fornecedor, margem, PVP, estados, notas/anexos, drag & drop, entra nos totais e nos indicadores de margem).
- Diferença: o tipo de preço é **Por noite** ou **Total** (em vez de por pessoa/total). Por noite = valor × nº de noites.
- Checkbox **"Mostrar no PDF e itinerário digital"** na própria chaveta.
- Quando ativada e com linhas preenchidas, aparece nas propostas uma secção Alojamentos com **nome do alojamento + nº de noites** (sem preços), no idioma da proposta.
- Se a secção estiver vazia (ou a checkbox desligada), não aparece nada no cliente — fica apenas nos custos.

## 5. Nome do ficheiro PDF do Travel Plan

Recuperar o formato `YT#### - Nome Cliente - Nome Programa - Datas` (no idioma do plano). Atualmente o PDF sai sem nome porque a impressão é feita numa janela nova em branco e o browser deixou de usar o título dessa janela.

## Detalhes técnicos

- **B2B NET**: `client_type` da lead é guardado no `closing_terms` da proposta (`netPricing: true`) ao gravar/gerar o plano; `proposalPdfI18n.ts` ganha a chave `totalPriceNet` (EN/PT/ES/FR/IT/DE) e `PRICING_LABELS` em `PublicProposalPage.tsx` ganha o equivalente. Consumido em `proposalPdf.ts` e `PublicProposalPage.tsx`.
- **Depósito**: alteração local em `PaymentPlanDialog.tsx` (botões percentuais + `changeDeposit`). Sem mudanças de API.
- **Editar/eliminar links**: `payment_links` tem INSERT/DELETE negados por RLS, logo as duas ações passam pela edge function `wetravel-create-payment-link` (service role) com novas ações `update` (só `status = 'draft'`, PATCH na WeTravel + update da linha) e `delete` (DELETE na WeTravel — se a API responder 404/405 marca-se como removido localmente e avisa-se para arquivar no WeTravel — seguido de delete da linha e limpeza de `wetravel_checkout_url` nas propostas da lead). Novos hooks `useUpdatePaymentLink` / `useDeletePaymentLink` em `usePaymentLinksQuery.ts`; botões em `PaymentLinksList.tsx` e reutilização de `PaymentLinkDialog.tsx` em modo edição.
- **Alojamentos**: guardado em `lead_costing_data` com `day_number = 0` e `title = '__accommodation__'`, para não alterar o schema; `LeadCostItem` ganha `pricingType: 'per_night'` e `nights`. Ajustes em `LeadCostingEditor.tsx` (nova chaveta + coluna Noites), `LeadDetailPage.tsx` (leitura/gravação e exclusão do dia 0 do day-by-day, flag `showAccommodation`), e a flag + lista vão para `closing_terms.accommodation` na proposta para render em `PublicProposalPage.tsx` e `proposalPdf.ts`. A secção Operações continua a ignorar o dia 0.
- **Nome do PDF**: em `TravelPlanProposal.tsx`, a janela de impressão passa a ser criada a partir de um `Blob`/`srcdoc` com URL própria e `<title>` já presente no HTML inicial (o Chrome ignora o título de documentos `about:blank`), com fallback para impressão in-place com `document.title` definido. Sem alterações ao conteúdo do PDF.
