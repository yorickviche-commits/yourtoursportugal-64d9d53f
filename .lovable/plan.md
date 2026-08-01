# Bloco "Reviews + Sobre Nós" na última página do PDF

Objetivo: o PDF gerado do Travel Plan termina com o mesmo bloco de reviews e "Sobre nós" que já existe no itinerário digital, sempre no idioma do programa. Tudo o resto (design, estrutura, nome do ficheiro, secção de preços/condições) fica exatamente igual.

## O que é adicionado

No fim do programa (depois das condições e mensagem de fecho), numa nova página do PDF:

1. **Banner "OUR REVIEWS"** — a mesma imagem já usada no itinerário digital, em 16:9, com link para a página de reviews do site.
2. **"O que os nossos clientes dizem"** — título traduzido + os 4 depoimentos com estrelas já definidos no dicionário do idioma do programa, em cartões limpos (o widget Elfsight não imprime, por isso usam-se os depoimentos internos, iguais aos do dicionário do itinerário digital).
3. **"Sobre a Your Tours Portugal"** — título + texto institucional traduzido, com contactos (email e website) em texto discreto, sem botões coloridos que não fazem sentido em papel.

O bloco aparece tanto na pré-visualização do Travel Plan (modo leitura) como na impressão/PDF, com quebra de página antes, para ficar sempre como última página.

## Detalhes técnicos

- `src/components/trip/TravelPlanProposal.tsx`: novo bloco no fim do `data-print-root`, com `print:break-before-page`, usando `t` (já obtido via `getLabels(language)`) para `travellersSay`, `reviewsList`, `aboutUs`, `aboutBody`, `website`. Import do asset `@/assets/our-reviews-banner.png.asset.json`. Cores de fundo com `printColorAdjust: 'exact'` onde necessário.
- Nada muda no `handlePrintPdf` nem no nome do ficheiro.
- `src/lib/proposalPdf.ts` (PDF anexado por email, jsPDF): mantém a página de reviews existente e ganha, abaixo do botão "See All Reviews", um pequeno bloco "About Your Tours Portugal" com o mesmo texto, para consistência.
