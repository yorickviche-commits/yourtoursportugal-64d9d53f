# Travel Plan PDF: voltar ao layout original + secção de Hotéis + novas caixas

## 1. Voltar ao layout do PDF em anexo

O PDF que enviaste foi gerado pela impressão do navegador (Chromium) a partir da própria página do Travel Planner — é por isso que tem esse layout, tipografia e imagens. Na última alteração o botão PDF passou a construir o documento por código (jsPDF), o que produz um documento diferente e mais pobre.

Correção: o botão **PDF** do Travel Planner volta a imprimir a página in-place (o layout do anexo), mantendo o que já foi ganho nessa altura:
- nome de ficheiro `YT#### - Cliente - Programa - Datas`;
- substituição dos iframes do Google Maps por imagens estáticas da rota antes de imprimir;
- espera por fontes e imagens antes de abrir a impressão;
- restauro do DOM e do título no fim.

O anexo do email continua a usar o gerador atual (jsPDF), mas passa a incluir as mesmas secções novas (hotéis, preço por linhas, what's not included, next steps) para ficar o mais próximo possível.

## 2. Secção "Hotels Included" (2.ª página)

Quando o bloco de Alojamento do Costing está ativo (já existe essa função no Costing), passa a existir uma secção **Hotels Included** logo após o bloco de preço, antes do Dia 1 — tanto no PDF como no itinerário digital. Se não houver hotéis (ou o bloco estiver desativado no Costing), a secção simplesmente não aparece.

Conteúdo, igual ao PDF de exemplo:
- Por hotel: nome + cidade, e um parágrafo descritivo;
- Tabela: Hotel · Check-in · Check-out · Noites · Quartos · Valor;
- Linha final: "Alojamento, X noites, Y quartos, pequeno-almoço incluído" com o total;
- Nota de rodapé da tabela (quartos/regime/taxas + "clica no nome do hotel para ver no Google Maps").

Origem dos dados:
- **do Costing (automático)**: nome, noites e valor das linhas de hotel;
- **editável no Travel Planner**: descrição, URL do Google Maps, check-in, check-out e nº de quartos, com uma caixa por hotel. Guardado nos termos de fecho do plano, tal como as restantes caixas.

O nome do hotel fica clicável (link Google Maps) no itinerário digital e no PDF, quando o URL está preenchido.

## 3. Bloco de preço

O bloco Total Price passa a mostrar a divisão pedida:
- **Programa / itinerário e experiências** — valor;
- **Hotéis — N noites, Q quartos, pequeno-almoço incluído** — valor (só quando existem hotéis);
- **Total** para o grupo;
- **Por pessoa**.

Sem a linha de refeições avulsas (ex.: "3 regional lunches…") — esse valor entra no programa.

## 4. Novas caixas editáveis no fecho

Na secção de Preço & Condições do Travel Planner, duas novas caixas editáveis (texto rico, como as existentes), com texto por defeito no idioma do plano:
- **What's Not Included** — entre "What's Included / Accommodation" e as condições de pagamento;
- **Your next steps** — caixa destacada no fim, antes da despedida.

Ambas aparecem no itinerário digital e no PDF; se ficarem vazias, não são impressas.

## Detalhes técnicos

- `src/components/trip/TravelPlanProposal.tsx`: repor `handlePrintPdf` (print in-place) no botão PDF; `ClosingTerms` ganha `notIncluded`, `nextSteps` e `hotels[]` (name, city, description, mapUrl, checkIn, checkOut, rooms — merge por nome com as linhas de hotel vindas da prop `accommodation`); novo editor de hotéis e duas novas caixas de texto na secção de fecho; render da secção Hotels Included na pré-visualização (que é o que é impresso).
- `src/pages/LeadDetailPage.tsx`: `proposalAccommodation` passa a incluir também o valor (PVP) por linha de hotel, além de nome e noites.
- `src/pages/PublicProposalPage.tsx`: nova secção Hotels Included (descrições + tabela + links Maps) e render das caixas What's Not Included / Your next steps; bloco de preço com as duas linhas (programa / hotéis).
- `src/lib/proposalPdf.ts`: mesmas secções no gerador do anexo de email (hotéis com links, preço por linhas, not included, next steps).
- `src/lib/proposalPdfI18n.ts` / `src/lib/closingTermsI18n.ts`: novas etiquetas e textos por defeito (EN/PT/ES/FR/IT/DE) para hotéis, colunas da tabela, "What's Not Included" e "Your next steps".
- Sem alterações ao Costing.

## Verificação

Numa lead com hotéis no Costing (bloco ativo): imprimir o PDF e confirmar layout igual ao anexo, hotéis na 2.ª página com links Maps, preço em duas linhas + total + por pessoa, e as secções What's Not Included e Your next steps. Repetir com o bloco de hotéis desativado para confirmar que a secção desaparece.
