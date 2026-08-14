# Correções ao PDF do Travel Plan (nome, nitidez, preço NET)

## 1. Letras/PDF desfocados

Hoje o PDF é impresso a partir de um iframe escondido fora do ecrã, com uma cópia do itinerário. O Chrome trata esse conteúdo como uma captura rasterizada, o que produz texto e imagens desfocados em vez de texto vetorial.

Correção: imprimir diretamente a página (in-place), que já tem regras `@media print` preparadas para isolar o bloco do itinerário. Resultado: texto vetorial nítido, imagens à resolução original, cores exatas.

## 2. Nome do ficheiro sempre errado

Com a impressão a partir do iframe, o Chrome usa o título do documento de topo (a app), e não o do iframe — daí sair sem nome ou com nome errado.

Correção: ao imprimir in-place, o título do documento é definido para `YTid - Nome Cliente - Nome Programa - Datas` (datas formatadas no idioma escolhido no plano), impresso, e o título anterior é restaurado no fim. Mantém-se a limpeza de caracteres inválidos e o limite de comprimento.

## 3. B2B: "Preço Total NET" no PDF

No itinerário digital o rótulo já muda quando a lead é B2B. No bloco de preço do Travel Plan (que é o que vai para o PDF) está fixo em "Preço Total".

Correção: quando a lead é B2B, o rótulo passa a ser a versão NET no idioma da proposta (EN/PT/ES/FR/IT/DE), tanto na pré-visualização como no PDF impresso.

## Detalhes técnicos

- `src/components/trip/TravelPlanProposal.tsx`:
  - `handlePrintPdf`: remover o caminho do iframe escondido; passar a usar sempre o fluxo in-place já existente (substituir os `[data-map-embed]` pelas imagens estáticas da rota, esperar `document.fonts.ready` + carregamento das imagens, `document.title = filename`, `window.print()`, restaurar DOM e título no `afterprint`).
  - Bloco de preço (linha ~2075): usar `netPricing ? getPdfDict(language).totalPriceNet : t.totalPrice`.
- Sem alterações a `proposalPdf.ts` (o PDF enviado por email já respeita `closing.netPricing`), ao layout, cores, ou conteúdo das secções.

## Verificação

Imprimir um plano PT de uma lead B2B: confirmar nome `YT#### - Cliente - Programa - Datas`, texto nítido/selecionável e rótulo "PREÇO TOTAL NET".
