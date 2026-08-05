# PDF da proposta no idioma do programa

## Problema confirmado
`src/lib/proposalPdf.ts` escreve todos os textos fixos em inglês ("Tailored Travel Plan", "Summary & Day-by-Day", "ITINERARY & INCLUDED:", "Route map — Day X", "Open route in Google Maps →", "TOTAL PRICE", "BOOK NOW", "What's Included", "Reservation & Payment Conditions", "Cancellations & Refund Conditions", "Important Notes", "What Our Clients Say", "See All Reviews", "About Your Tours Portugal" + parágrafo). O itinerário digital resolve estes textos via `getProposalDict(language)`, logo os dois canais divergem: o PDF anexado ao email sai sempre em inglês mesmo em propostas PT/ES/FR/IT/DE.

## Proposta de alteração
1. **Dicionário**: acrescentar em `src/lib/proposalI18n.ts` as chaves que só existem no PDF (`pdfHeaderTitle`, `interactiveVersion`, `routeMapDay`, `openRouteMaps`, `totalPrice`, `paymentConditions`, `cancellationConditions`, `importantNotes`, `seeAllReviews`, `trustedBy`) para os 6 idiomas já suportados (en/pt/es/fr/it/de), reaproveitando as chaves existentes onde já há equivalente (`programDayByDay`, `itineraryIncludes`, `bookNow`, `travellersSay`, `aboutUs`, `aboutBody`).
2. **Gerador**: em `src/lib/proposalPdf.ts`, resolver `const t = getProposalDict(proposal.language)` no início e substituir cada literal inglês pela chave correspondente (incluindo a página final de reviews/sobre nós e os títulos dos dias).
3. **Chamadas**: garantir que `language` faz parte do `ProposalLite` passado em `EmailComposerDialog.tsx` (linha 206) e em `CommunicationsWorkspace.tsx` (linha 146), com fallback `'en'`.
4. **Sem alterações** ao layout, ordem das secções, nome do ficheiro, cores ou estrutura do PDF — apenas os textos mudam de idioma.

## Verificação
Gerar o PDF de uma proposta com `language = 'pt'` e outra com `'en'` e confirmar que os cabeçalhos, secções de condições e página final aparecem no idioma correto, com layout inalterado.
