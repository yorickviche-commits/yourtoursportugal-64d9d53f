# Dados Gerais sempre refletidos na proposta + drag & drop de fotos

## Problema 1 — nº de pax / crianças / datas ficam congelados

Verificado no código: a linha de participantes ("2 adults + 1 child") e o intervalo de datas são
escritos na proposta apenas quando se grava o **Travel Planner**. Ao gravar os **Dados Gerais**
(`Guardar` na ficha da lead) só se atualiza a lead e o snapshot da versão — a proposta digital e o
travel plan dessa versão continuam com os valores antigos, e o PDF lê exatamente esses valores.
Por isso o itinerário digital mostra sempre o pax do primeiro save.

### Correção
Ao gravar os Dados Gerais da versão LIVE, sincronizar em seguida, para essa mesma versão:
- `travel_plans.pax`, `start_date`, `end_date`
- `proposals.participants`, `date_range`

A linha de participantes é gerada com a mesma função de idioma já usada no Travel Planner
(adult/adulto/adulte…), extraída para um helper partilhado para não duplicar lógica.
As datas seguem a mesma regra atual: usam as datas dos dias do plano se existirem, caso contrário
as datas de viagem dos Dados Gerais.

Para versões arquivadas (consulta) o comportamento mantém-se: grava só o snapshot da versão, e a
proposta dessa versão é sincronizada da mesma forma (cada versão tem a sua proposta, os links das
outras versões nunca são tocados).

Assim, gravar nos Dados Gerais passa a atualizar imediatamente o link do cliente e o PDF.

## Problema 2 — arrastar uma foto abre-a em vez de a carregar

Verificado: a caixa de upload diz "or Drag and Drop, Copy and Paste Files" mas não tem qualquer
tratamento de drop nem de colar — o browser assume o comportamento predefinido e abre a imagem.

### Correção
Adicionar drop e colar (Ctrl+V) às caixas de upload de imagem, com o mesmo comportamento do
seletor de ficheiros já existente (validação de tipo imagem, destaque visual ao arrastar):
- seletor de imagens do Travel Planner (capa e imagens de cada dia)
- caixa de upload dentro do editor de itinerário

## Ficheiros

- `src/pages/LeadDetailPage.tsx` — após gravar, sincronizar `travel_plans` e `proposals` da versão.
- `src/components/trip/TravelPlanProposal.tsx` — extrair o helper de linha de participantes/datas.
- `src/lib/proposalVersion.ts` (ou novo `src/lib/participantsLabel.ts`) — helper partilhado.
- `src/components/trip/ProposalImagePicker.tsx` — drag & drop + paste.
- `src/components/itinerary/ItineraryEditor.tsx` — drag & drop + paste.

Sem alterações de base de dados e sem novas dependências.

## Verificação

- Alterar pax e datas nos Dados Gerais, gravar, abrir o link público e o PDF: valores novos.
- Repetir numa segunda versão e confirmar que a versão anterior mantém os seus valores.
- Arrastar e colar uma imagem: carrega na proposta sem abrir noutro separador.
