## Diagnóstico confirmado

O erro atual vem da função de geração do Travel Plan a falhar por **limite de memória excedido** quando existe PDF anexado como “Exact Itinerary”.

Hoje o fluxo faz isto:

1. descarrega o PDF do storage;
2. carrega o ficheiro inteiro em memória;
3. converte tudo para base64;
4. envia o PDF completo para o modelo multimodal;
5. se o PDF for pesado, repetido, com imagens/scans, ou grande demais, a função rebenta antes de concluir.

Resultado: no frontend aparece apenas “Edge Function returned a non-2xx status code”.

## Objetivo

Garantir que a geração **quase nunca falha** e, quando algo externo falhar, o agente humano recebe uma mensagem clara e uma alternativa operacional.

A lógica deve ser:

```text
PDF / mapa / notas humanas
        ↓
pré-processar contexto de forma leve
        ↓
gerar Travel Plan estruturado
        ↓
validar JSON
        ↓
se falhar, reparar / tentar fallback
        ↓
se ainda falhar, devolver erro claro e útil
```

## Plano de implementação

### 1. Separar leitura do PDF da geração final

Em vez de enviar sempre o PDF completo para o modelo final, criar um passo intermédio dentro da função:

- se houver Exact Itinerary PDF, primeiro tentar extrair/resumir a estrutura essencial:
  - número de dias;
  - cidade/base por dia;
  - título operacional do dia;
  - paragens principais;
  - experiências/serviços descritos;
  - noites;
  - notas importantes.

Depois, o gerador final recebe **texto estruturado leve**, não o PDF inteiro pesado.

Isto reduz muito memória, custo e falhas.

### 2. Criar fallback quando o PDF for pesado ou problemático

Adicionar proteções antes de processar o PDF:

- limite de tamanho seguro;
- se o PDF for demasiado grande, não carregar tudo cegamente;
- se a leitura multimodal falhar, tentar uma chamada alternativa apenas com o contexto textual disponível;
- se o PDF não puder ser interpretado, devolver mensagem clara: “PDF demasiado pesado / ilegível — exportar versão mais leve ou copiar o esqueleto para notas”.

### 3. Melhorar a cadeia de modelos

A função já tem fallback Lovable AI → Gemini direto → OpenAI → Claude, mas com PDF anexado os fallbacks atuais ficam fracos porque OpenAI/Claude estão a receber só texto e não o PDF.

Vou ajustar para:

- usar multimodal apenas quando necessário;
- se o PDF já foi convertido em estrutura textual, todos os modelos seguintes podem usar esse texto;
- manter Gemini pago como caminho principal para PDF/imagem;
- usar OpenAI/Claude como fallback real com o contexto já extraído.

### 4. Reduzir `max_tokens` e carga por tentativa

A função pede respostas muito grandes (`32768 tokens`) em todas as tentativas. Para propostas longas pode fazer sentido, mas aumenta risco de memória/timeouts.

Vou ajustar para um valor mais seguro e progressivo:

- tentativa normal com output controlado;
- se o programa tiver muitos dias, manter estrutura compacta;
- preservar qualidade sem pedir output excessivo logo à partida.

### 5. Tornar o erro visível e acionável no frontend

No Travel Planner, quando a função falhar, mostrar a causa real quando disponível:

- “PDF demasiado pesado”;
- “AI sem créditos / quota”;
- “modelo não conseguiu devolver JSON válido”;
- “timeout / memória excedida”.

Hoje o utilizador vê só erro genérico da função. Isso não ajuda a operação.

### 6. Guardar melhor o estado do Exact Itinerary

Após upload do PDF, validar no frontend:

- tipo PDF;
- tamanho máximo recomendado;
- mostrar nome/tamanho do ficheiro;
- aviso se for pesado;
- manter indicação clara de “Modo Exact ativo”.

### 7. Adicionar validação e reparação do JSON final

Depois da AI responder:

- validar se existem `trip_title`, `narrative`, `days`;
- garantir que cada dia tem `day_number`, `title`, `bullets`, `overnight`;
- normalizar bullets antigas/string/object;
- se o JSON vier parcial, tentar reparar de forma mais robusta;
- se o PDF indicar 10 dias, mas a AI devolver menos, tentar uma segunda geração só para completar dias em falta.

## Resultado esperado

Depois desta alteração:

- PDFs pequenos/médios devem gerar sempre com muito mais estabilidade;
- PDFs pesados deixam de rebentar a função por memória;
- Gemini pago continua a ser o motor principal;
- OpenAI/Claude passam a funcionar melhor como fallback porque recebem contexto textual limpo;
- o agente deixa de ver erro genérico e passa a ver uma explicação prática;
- o Travel Planner fica mais fiável para o fluxo real da equipa.

## Ficheiros a alterar

- `supabase/functions/generate-travel-plan/index.ts`
  - refatorar processamento de anexos;
  - adicionar pré-extração/normalização do PDF;
  - melhorar fallback AI;
  - melhorar erros.

- `src/components/trip/TravelPlanProposal.tsx`
  - mostrar erro real da função no toast;
  - melhorar mensagem quando há falha de geração.

- `src/components/leads/LeadContextAttachments.tsx`
  - mostrar nome/tamanho do PDF;
  - bloquear ou avisar PDFs demasiado pesados.

## Critério de sucesso

Testar com uma lead com Exact Itinerary PDF anexado e confirmar que:

1. a função já não falha por memória;
2. se o PDF for aceite, o Travel Plan segue o esqueleto do PDF;
3. se o PDF for problemático, a app explica o motivo;
4. a geração continua funcional sem PDF e com mapa/imagem.