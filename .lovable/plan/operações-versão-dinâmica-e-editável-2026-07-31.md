# Operações — versão dinâmica e editável

Objetivo: a tabela de Operações passa a ter conteúdo próprio, editável e gravável com botão, independente do Travel Planner e do Costing — mas alimentada por eles na origem.

## O que muda

### 1. Itens vêm do Travel Planner (editáveis)
- As linhas de cada dia passam a ser construídas a partir do Travel Planner da versão ativa (dia, título do dia, atividades por período), em vez do Costing.
- Cada linha fica com **título/atividade editável** diretamente em Operações. A edição é local até gravar e nunca reescreve o Travel Planner.
- Novas linhas podem ser adicionadas manualmente por dia e removidas.

### 2. Título da atividade bem visível
- A coluna Atividade passa a ser a mais larga, com **quebra de linha** (sem truncar) e texto ligeiramente maior/negrito, para se poder validar a redação.

### 3. FSE (fornecedor)
- Valor inicial herdado do que estiver definido no Costing para a atividade correspondente.
- Em Operações pode ser **alterado ou escolhido da lista de fornecedores**, com opção de adicionar novo FSE, reutilizando o componente de pesquisa de fornecedores já existente.

### 4. Valor NET fixo + Custo Real editável
- **NET (€)**: puxado do Costing, apresentado em modo leitura (fixo, referência).
- Nova coluna **Custo Real (€)**: editável e gravável, com indicação visual de desvio (verde se ≤ NET, vermelho se > NET) e total por dia.

### 5. Botão Gravar + aviso de alterações pendentes
- Barra "Gestão Operacional" ganha botão **Gravar** (com estado "alterações não gravadas") e atalho Ctrl/Cmd+S.
- Reutiliza-se o guard já existente de alterações não gravadas para mostrar aviso ao sair/fechar/mudar de página (dentro da plataforma e ao fechar o browser), com opção de gravar antes de sair.
- Alterações de estado (Reserva/Pagamento/Fatura) continuam a gravar de imediato, como hoje; os campos de texto/valores entram no ciclo do botão Gravar.

## Detalhes técnicos

- **Migração** em `lead_operations`: adicionar `activity_title text`, `supplier text`, `pax integer`, `net_value numeric`, `real_cost numeric`, `sort_order integer`, `source text default 'planner'`. Mantém-se a chave `(lead_id, item_key)`.
- `item_key` estável por linha: `d{dia}-{slug(título)}` para linhas do planner e `d{dia}-manual-{uuid}` para linhas criadas em Operações, para que a gravação não se perca ao regenerar o planner.
- `useLeadOperationsQuery.ts`: alargar `DbLeadOperation` aos novos campos e adicionar uma mutação de gravação em lote (`upsert` de várias linhas) + eliminação de linhas manuais.
- `OperacoesTab` em `src/pages/LeadDetailPage.tsx`: extrair para `src/components/leads/LeadOperationsEditor.tsx` (o ficheiro já tem ~1.5k linhas), com estado local `days` inicializado por merge: planner (estrutura) → costing (FSE, pax, NET) → `lead_operations` (overrides gravados, que têm prioridade).
- Grelha reajustada: `Hora | Atividade (flex, wrap) | FSE | Pax | NET | Custo Real | Reserva | Pagamento | Fatura | ações`, com fallback em cartões no mobile.
- `useUnsavedChangesGuard` ligado ao `dirty` local; sync do Google Calendar continua a ser disparado após gravação.
