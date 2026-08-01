# Geração de imagem AI: ChatGPT como principal + prompt editável com contexto do programa

## Objetivo
1. A geração AI de imagens passa a usar a nossa API OpenAI (ChatGPT) como fornecedor principal, com Gemini como fallback.
2. A imagem de capa gerada deve ser uma colagem/composição do destino e das experiências incluídas no programa.
3. O agente pode escrever instruções próprias numa caixa de texto ANTES de gerar, e a AI tem isso em conta além do day-by-day do programa.

## O que muda

### 1. Ordem de fornecedores (backend)
Na função `search-destination-images`, a cadeia de fallback para o modo `generate` passa a ser:
1. OpenAI (`gpt-image-1`) — principal
2. Gemini direto — fallback
3. Lovable AI Gateway — último recurso

Mensagens de erro de quota/billing continuam a ser mostradas ao agente como hoje.

### 2. Prompt aberto e editável no diálogo "AI Generate"
No separador **AI Generate** do seletor de imagem:
- Passa a mostrar uma **caixa de texto** pré-preenchida com o prompt base (destino + tipo de imagem + estilo de colagem quando é capa).
- O agente pode editar/acrescentar instruções livremente antes de clicar em **Gerar Imagem AI**.
- Um resumo (read-only, colapsável) mostra o contexto do programa que será enviado — dias e experiências — para o agente saber o que a AI vai considerar.

### 3. Contexto do programa enviado à AI
O Travel Planner passa ao seletor de imagem um resumo do day-by-day (Dia N — título/subtítulo + itens/experiências principais, mais destino e nº de dias). Esse resumo é anexado ao prompt do agente na chamada de geração.

### 4. Estilo "colagem" na imagem de capa
Para a imagem de capa, o prompt base pede uma composição/colagem editorial elegante que combine paisagens do destino com as experiências incluídas no programa, orientação landscape, sem texto nem marcas de água. As imagens por dia mantêm o estilo fotográfico atual.

## Notas técnicas
- `supabase/functions/search-destination-images/index.ts`: reordenar chamadas em `generateWithAI`; aceitar `prompt` (livre) e `programContext` no body e usá-los na composição do prompt final em vez do prompt fixo quando fornecidos.
- `src/components/trip/ProposalImagePicker.tsx`: novas props `basePrompt` e `programContext`; estado do textarea inicializado com o prompt base; envio de `prompt` + `programContext` na invocação.
- `src/components/trip/TravelPlanProposal.tsx`: construir o resumo do day-by-day e passar `programContext` + `basePrompt` (variante colagem para a capa) aos dois usos do `ProposalImagePicker`.
- Sem alterações de base de dados nem no PDF/itinerário digital.
