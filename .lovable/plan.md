# 1) Caixa WeTravel igual à original + 2) Assistente AI lateral

## Tarefa 1 — Modal do link de pagamento igual ao formulário WeTravel

Manter toda a lógica atual (criação, publicação, retomar, lista de links, ativar/desativar, botão Book Now). Só muda a apresentação e alguns campos, para espelhar exatamente o formulário WeTravel:

Ecrã principal (ordem e etiquetas como no WeTravel, em EN igual ao original):
- **Title** — com contador de caracteres à direita dentro do campo.
- **Trip ID** — campo com contador.
- **Trip Dates** — um único campo com intervalo `Sep 1, 2026 → Sep 1, 2026` e ícone de calendário (date-range picker), em vez de dois inputs `dd/mm/aaaa`. Corrige também o mau hábito de datas passadas: o picker abre no mês da viagem da lead.
- **Amount** + dropdown de moeda ao lado.
- **Add Deposit / Payment Plan** — par de botões `Yes | No` (não switch). Em `Yes` abre o sub-modal do plano (abaixo).
- **Add Expiration Date** — par de botões `Yes | No`; em `Yes` mostra **Active until** com date picker.
- **Who pays the fees?** — dois grupos de radios como no original: *Payment fees (when applicable) are paid by:* `Organizer / Participant` e *WeTravel fee is paid by:* `Organizer / Participant`. Substitui o dropdown único atual, mapeando as duas escolhas para o valor de taxas já enviado à API.
- Botão **Publish** verde em baixo à esquerda, com o estado "Saved as draft" ao lado.
- Painéis de dica à direita (caixa cinza com lâmpada), como nos screenshots.

Sub-modal **Add Payment Plan** (imagem 2/3):
- "Learn how payment plans work" (link para a doc WeTravel).
- **Number of payments** — grelha de botões 1–24 ("Deposit plus"), com o selecionado destacado.
- **Payment dates** — linha *Deposit* (`Due at booking` + montante), linhas `1st Payment`, `2nd Payment`, …, `Final Payment` com date picker + montante, geradas conforme o número escolhido e divididas automaticamente pelo total (editáveis).
- Checkboxes *Allow partial payment*, *Enable auto-billing*, *Auto-adjust payment plan for late bookings*, com **Total** à direita e validação de que a soma iguala o montante.
- Botões `Cancel` / `Save Plan` (verde).

O envio para a WeTravel continua igual: as datas de cada prestação são convertidas para os dias-antes-da-partida que a API já recebe. Erros de validação continuam a aparecer inline em português.

## Tarefa 2 — Assistente AI (caixa de chat lateral)

O botão `?` do tour fica como está. Novo botão redondo ao lado dele (ícone de mensagem, azul YT) que abre um **painel lateral direito** (largura ~420px em desktop, ecrã inteiro em mobile), com:
- Cabeçalho com nome do assistente, botão minimizar (volta a botão flutuante) e fechar.
- Histórico de mensagens em markdown, indicador de "a escrever", campo de texto sempre focado.
- **Sugestões automáticas** iniciais e depois de cada resposta (chips clicáveis), geradas a partir do contexto: página atual e lead aberta. Exemplos: "Estado desta lead", "Leads sem proposta há 7 dias", "Preço net do fornecedor X", "Que produtos incluem Douro", "Viagens nos próximos 7 dias", "Margem prevista vs real desta lead".
- **Próximos passos** sugeridos pelo modelo no fim de cada resposta (ex.: criar tarefa, abrir a lead, gerar link de pagamento), com botões que navegam na app.
- Uma conversa única por sessão, guardada no browser (localStorage), com botão "Nova conversa". Sem histórico em base de dados.

Conhecimento a que responde (leitura apenas, com as permissões do utilizador): leads e estados, propostas, viagens/operações, tarefas, fornecedores e serviços/preços net e condições, produtos (catálogo Magpie e biblioteca interna), custos/margens e links de pagamento.

## Detalhes técnicos

**Tarefa 1** — só frontend, em `src/components/payments/PaymentLinkDialog.tsx`: reorganização do layout (grelha label-esquerda/campo-direita), date-range picker com `react-day-picker`/`Popover` já existentes no projeto, botões `Yes|No` via `ToggleGroup`, sub-modal `PaymentPlanDialog` novo em `src/components/payments/`. Os dois grupos de radios de taxas mapeiam para o `participant_fees` atual (`all`/`service`/`credit_card`/`none`). O plano passa a guardar datas e converte para `days_before_departure` no submit — `usePaymentLinksQuery.ts` e a edge function `wetravel-create-payment-link` não mudam de contrato.

**Tarefa 2**
- Nova edge function `supabase/functions/ai-assistant/index.ts`: autentica o utilizador com `requireInternalUser`, chama o gateway Lovable AI com `google/gemini-3.6-flash` em streaming e **tool calling**. Ferramentas de leitura, todas com o cliente Supabase no contexto do utilizador (RLS aplica-se): `search_leads`, `get_lead` (inclui costing/operations/margem), `list_upcoming_trips`, `list_tasks`, `search_suppliers` (+ `supplier_services` e condições), `search_products` (`products`, `product_local`, `magpie_products`), `list_payment_links`. Resposta final devolve também um bloco estruturado com `suggestions` e `next_steps` para os chips e botões.
- Frontend: `src/components/assistant/AssistantPanel.tsx` (painel + composer + markdown via `react-markdown`), `AssistantLauncher.tsx` (botão flutuante), `src/hooks/useAssistantChat.ts` (streaming, localStorage, contexto da rota/lead). Montado em `src/components/AppLayout.tsx` ao lado de `TourLauncher`, só para utilizadores autenticados.
- Registo da função em `supabase/config.toml` (`verify_jwt = true`). Erros 429/402 do gateway mostrados como mensagem clara no chat.
