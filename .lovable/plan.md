# Fase 2 do MCP — produção completa de um ficheiro, com gate de aprovação humana

Os agentes AI passam a poder construir uma file de ponta a ponta (criar lead, validar, travel plan, custos, operações) e a **propor** tudo o que sai para fora (emails, links de pagamento). Nada externo é executado pelo agente: fica numa fila que uma pessoa aprova, edita ou rejeita.

## 1. Fila de Aprovações AI

Nova tabela `ai_action_queue`: tipo (`client_email`, `fse_email`, `payment_link`), lead, payload completo (destinatários, cc/bcc, assunto, HTML, anexos, montante, descrição), estado (`pending`, `approved`, `rejected`, `executed`, `failed`), quem criou, quem aprovou, data de execução, resultado/erro, e uma chave de idempotência para a mesma proposta não entrar duas vezes.

Nova página **Aprovações AI** no menu lateral, com contador de pendentes:
- lista compacta (mobile: cartões; desktop: linhas densas), agrupada por urgência
- pré-visualização: email renderizado como o cliente o recebe, com anexos listados; link de pagamento com montante, tipo de depósito e descrição
- botões **Aprovar e executar** / **Editar** / **Rejeitar**; o editor permite corrigir destinatário, assunto, corpo e montante antes de aprovar
- ao aprovar, corre exactamente a lógica que os botões da UI já usam hoje (envio a partir de reservas@yourtours.pt, criação do link WeTravel), e o registo em Comunicações e no NetHunt acontece como hoje
- os mesmos itens aparecem no separador Comunicações da lead

Ferramentas de leitura: `list_pending_approvals`, `get_approval_status`.

## 2. Criar e validar a file

- `import_lead_ai` — recebe o email bruto do cliente, origem, email do remetente, thread do Gmail e idioma; usa a mesma extracção AI do Smart Import; cria a lead com o próximo código YT, liga/cria o record NetHunt, estado inicial SALES · New Lead. Se já existir lead com o mesmo email e datas sobrepostas, devolve a existente com `duplicate: true`.
- `validate_lead` (leitura) — checklist: campos obrigatórios em falta, incoerências (datas vs nº de dias, pax vs custos, idioma do programa vs idioma do cliente, B2B sem parceiro/logótipo) e o que falta para avançar de estágio.

## 3. Travel Plan

- `generate_travel_plan` — briefing em texto + produtos do catálogo; usa o gerador AI existente. Se a versão LIVE já tiver conteúdo, cria uma **nova versão** e passa-a a LIVE; a anterior fica consultável.
- `update_travel_plan_day` — editar, adicionar, remover ou reordenar dias (título, tagline, itens incluídos, noite em, hotel).
- `update_travel_plan_header` — título, subtítulo, resumo, imagem de capa.
- `fill_travel_plan_images` — igual ao "Preencher Imagens (AI)".

Todas devolvem o plano no mesmo formato do `get_travel_plan` mais avisos (dias sem imagem, sem mapa, sem noite).

## 4. Custos

- `get_costing` (leitura) — linhas por dia com FSE, custo unitário, quantidade, tipo de pax, markup, PVP, opcional sim/não; totais, margem, total YT, depositado, em falta.
- `autofill_costing_from_plan` — igual ao auto-import a partir do travel plan e dos protocolos FSE.
- `upsert_costing_lines` / `remove_costing_line` — editar linhas.
- Margem abaixo de 20% devolve erro claro com os números; acima de 8.000 € devolve `requires_ceo_approval: true` em vez de contornar o gate.

## 5. Operações

- `get_operations` (leitura) — serviços por dia com FSE, estado de reserva/pagamento/fatura, contactos e planning do guia.
- `update_operation_item` — estados de reserva/pagamento/fatura, nº de confirmação do FSE, notas (só os estados que já existem em Operações).
- `update_trip_briefing` — hotel de pickup, voos, contactos no destino, pedidos especiais.

## 6. Acções externas — só propostas

- `request_payment_link` — tipo (depósito 25%/50%, total, opcionais, montante personalizado), montante calculado como na UI, descrição. Cria item `payment_link` na fila e devolve o id e o montante proposto. O link só nasce na WeTravel depois da aprovação.
- `draft_fse_requests` — um item `fse_email` por fornecedor, em PT, no formato que o TCC já usa e com a referência YT correcta; `only_pending: true` gera só os serviços ainda não pedidos.
- `draft_client_email` — usa o AI Email Composer (estilo da casa, capa clicável, programa dia a dia, Book Now); purpose (proposal, first_draft, follow_up, payment_request, confirmation, custom), notas, idioma, anexar PDF do travel plan, cc/bcc. HTML em Trebuchet MS, negrito e bullets. Cria item `client_email` na fila.

## Detalhes técnicos

- Migração aditiva: `ai_action_queue` com GRANTs, RLS (utilizadores internos veem e aprovam; o criador vê os seus), trigger de `updated_at` e guarda de transições de estado no mesmo espírito da que já existe em `agent_task_drafts`.
- Ferramentas novas em `src/lib/mcp/tools/`, registadas em `src/lib/mcp/index.ts`; helpers partilhados em `src/lib/mcp/` (fila, custos, operações, travel plan) para não duplicar regras.
- Execução das acções aprovadas corre no cliente, reutilizando `send-booking-email`, `wetravel-create-payment-link`, `generate-email`, `parse-lead-email`, `generate-travel-plan`, `auto-fulfill-budget`, `search-destination-images` e `nethunt-push` — os mesmos caminhos da UI, sem lógica paralela.
- Manifest regenerado pelo extractor, com descrições em inglês e `readOnlyHint`/`destructiveHint` correctos. A app é publicada no fim (o Claude só vê as ferramentas depois de publicar — é por isso que ainda vê 5).
- Sem dependências novas.

## Aceitação

1. `import_lead_ai` cria a lead; a segunda chamada devolve `duplicate: true`.
2. `generate_travel_plan` cria nova versão sem apagar a anterior.
3. `upsert_costing_lines` com margem < 20% devolve erro.
4. `request_payment_link` aparece em Aprovações AI e só cria na WeTravel após aprovação.
5. `draft_fse_requests` gera um item por FSE.
6. `draft_client_email` com PDF anexado aparece na fila com pré-visualização.

Testes só com leads de teste, nunca com ficheiros reais de clientes.
