# Link Google Maps da rota exata nos Dados Gerais

Hoje, no bloco "Contexto extra para o Travel Planner" (Dados Gerais), só é possível anexar uma **imagem** da rota (`route_map_path`) e um PDF Exact Itinerary (`exact_itinerary_pdf_path`). Não existe campo para colar o link do Google Maps da rota partilhada, pelo que o Travel Planner não pode "beber" dessa informação.

## O que vai passar a existir

1. **Campo "Link Google Maps da rota exata"** no mesmo bloco dos Dados Gerais:
   - input de colar link + botão Guardar/Remover;
   - validação básica (aceita `google.com/maps/...`, `maps.app.goo.gl/...`);
   - pré-visualização imediata do mapa (iframe) quando o link é embutível, e lista dos pontos da rota detetados (A → B → C);
   - guardado na lead, logo persiste entre páginas.

2. **O Travel Planner usa a rota como base**: ao gerar o plano com IA, o link é enviado junto com os restantes dados. Os pontos extraídos do link (ordem das paragens/localidades) entram no prompt como sequência geográfica a respeitar — a rota serve de espinha dorsal e inspiração do programa, tal como o PDF base já faz. Se além do link existir imagem da rota ou PDF Exact, todos são usados (o PDF Exact continua a ser a fonte literal quando existe).

3. **Aproveitamento no itinerário**: o link da rota fica disponível como valor sugerido para o campo de mapa dos dias do programa, para que apareça na secção Mapa da proposta digital e no PDF (mecanismo de mapa por dia já existente).

## Nota técnica

- Migração: nova coluna `route_map_url text` em `public.leads` (nullable), sem alterações de RLS/grants (política existente da tabela cobre-a).
- `src/components/leads/LeadContextAttachments.tsx`: novo slot com input do link, uso de `parseGoogleMapsUrl`/`toMapEmbedSrc` de `src/lib/mapEmbed.ts` para preview + waypoints; grava em `leads.route_map_url`.
- `src/pages/LeadDetailPage.tsx`: passa `routeMapUrl` ao componente de anexos e ao `TravelPlanProposal`.
- `src/components/trip/TravelPlanProposal.tsx`: envia `routeMapUrl` + `routeWaypoints` no body do invoke de `generate-travel-plan`; usa o link como default de `mapUrl` do primeiro dia quando vazio.
- `supabase/functions/generate-travel-plan/index.ts`: aceita `routeMapUrl`/`routeWaypoints` e injeta um bloco "EXACT GOOGLE MAPS ROUTE" no prompt (sequência de paragens a seguir), com prioridade abaixo do Exact Itinerary PDF. Redeploy da função.
